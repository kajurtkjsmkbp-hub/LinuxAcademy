/**
 * Linux Shell & Command Interpreter
 * Parses pipelines, redirections, variables, and executes Linux coreutils.
 */

class LinuxShell {
    constructor(vfs) {
        this.vfs = vfs;
        this.cwd = '/home/student';
        this.oldCwd = '/home/student';
        this.user = 'student';
        this.hostname = 'linux-lab';
        this.env = {
            USER: 'student',
            HOME: '/home/student',
            SHELL: '/bin/bash',
            TERM: 'xterm-256color',
            PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
            PWD: '/home/student'
        };
        this.history = [];
        this.lastExitCode = 0;
        this.activeNanoCallback = null;

        // Simulated Processes Table
        this.processes = [
            { pid: 1, user: 'root', cpu: '0.0', mem: '0.4', command: '/sbin/init splash' },
            { pid: 2, user: 'root', cpu: '0.0', mem: '0.0', command: '[kthreadd]' },
            { pid: 382, user: 'systemd+', cpu: '0.1', mem: '0.8', command: '/lib/systemd/systemd-resolved' },
            { pid: 615, user: 'root', cpu: '0.0', mem: '0.5', command: '/usr/sbin/cron -f -P' },
            { pid: 842, user: 'root', cpu: '0.0', mem: '0.7', command: 'sshd: /usr/sbin/sshd -D [listener]' },
            { pid: 1042, user: 'root', cpu: '0.0', mem: '1.2', command: 'nginx: master process /usr/sbin/nginx' },
            { pid: 1043, user: 'www-data', cpu: '0.2', mem: '1.5', command: 'nginx: worker process' },
            { pid: 1410, user: 'student', cpu: '0.0', mem: '1.1', command: 'sshd: student@pts/0' },
            { pid: 1411, user: 'student', cpu: '0.0', mem: '0.9', command: '-bash' },
            { pid: 2341, user: 'nobody', cpu: '98.5', mem: '8.4', command: '/tmp/.hidden/crypto_miner --pool stratum' }
        ];

        // Package Manager Installed Apps
        this.installedPackages = new Set(['bash', 'coreutils', 'grep', 'sed', 'nano', 'vim-tiny', 'curl', 'iproute2']);
    }

    getPrompt() {
        const symbol = this.user === 'root' ? '#' : '$';
        let displayPath = this.cwd;
        const homePath = this.user === 'root' ? '/root' : '/home/student';
        
        if (displayPath === homePath) {
            displayPath = '~';
        } else if (displayPath.startsWith(homePath + '/')) {
            displayPath = '~' + displayPath.slice(homePath.length);
        }

        return {
            user: this.user,
            hostname: this.hostname,
            path: displayPath,
            symbol: symbol,
            text: `${this.user}@${this.hostname}:${displayPath}${symbol} `
        };
    }

    // Main command execution dispatcher
    async execute(rawCommandLine) {
        const line = rawCommandLine.trim();
        if (!line) return { output: '', exitCode: 0 };

        this.history.push(line);

        // Handle sequential commands separated by ';' or '&&'
        if (line.includes('&&')) {
            const parts = line.split('&&');
            let combinedOutput = '';
            for (const part of parts) {
                const res = await this.executeSubline(part.trim());
                if (res.output) combinedOutput += (combinedOutput ? '\n' : '') + res.output;
                this.lastExitCode = res.exitCode;
                if (res.exitCode !== 0) break;
            }
            return { output: combinedOutput, exitCode: this.lastExitCode };
        } else if (line.includes(';')) {
            const parts = line.split(';');
            let combinedOutput = '';
            for (const part of parts) {
                const res = await this.executeSubline(part.trim());
                if (res.output) combinedOutput += (combinedOutput ? '\n' : '') + res.output;
                this.lastExitCode = res.exitCode;
            }
            return { output: combinedOutput, exitCode: this.lastExitCode };
        }

        const res = await this.executeSubline(line);
        this.lastExitCode = res.exitCode;
        return res;
    }

    // Handles single statement with possible pipes and redirection
    async executeSubline(subline) {
        if (!subline) return { output: '', exitCode: 0 };

        // Handle redirection (> or >>)
        let redirectFile = null;
        let appendMode = false;
        let commandPart = subline;

        if (subline.includes('>>')) {
            const parts = subline.split('>>');
            commandPart = parts[0].trim();
            redirectFile = parts[1].trim();
            appendMode = true;
        } else if (subline.includes('>')) {
            const parts = subline.split('>');
            commandPart = parts[0].trim();
            redirectFile = parts[1].trim();
            appendMode = false;
        }

        // Handle Pipelines (|)
        const pipelineStages = commandPart.split('|').map(s => s.trim()).filter(s => s.length > 0);
        let pipeInput = '';
        let stageResult = { output: '', exitCode: 0 };

        for (const stage of pipelineStages) {
            stageResult = await this.runSingleCommand(stage, pipeInput);
            if (stageResult.exitCode !== 0 && !stageResult.output) {
                break;
            }
            pipeInput = stageResult.output;
        }

        // Apply redirection if present
        if (redirectFile) {
            const cleanTarget = redirectFile.split(' ')[0].replace(/['"]/g, '');
            const targetPath = this.vfs.resolvePath(cleanTarget, this.cwd);
            const writeRes = this.vfs.writeFile(targetPath, (pipeInput || '') + '\n', appendMode);
            if (!writeRes.success) {
                return { output: writeRes.error, exitCode: 1 };
            }
            return { output: '', exitCode: 0 };
        }

        return stageResult;
    }

    // Parse command line into arguments with variable expansion and quote handling
    parseArgs(cmdStr) {
        // Expand environment variables
        cmdStr = cmdStr.replace(/\$([A-Za-z0-9_?]+)/g, (match, varName) => {
            if (varName === '?') return String(this.lastExitCode);
            return this.env[varName] !== undefined ? this.env[varName] : '';
        });

        const args = [];
        let current = '';
        let inQuote = null;

        for (let i = 0; i < cmdStr.length; i++) {
            const ch = cmdStr[i];
            if (inQuote) {
                if (ch === inQuote) {
                    inQuote = null;
                } else {
                    current += ch;
                }
            } else if (ch === '"' || ch === "'") {
                inQuote = ch;
            } else if (/\s/.test(ch)) {
                if (current.length > 0) {
                    args.push(current);
                    current = '';
                }
            } else {
                current += ch;
            }
        }
        if (current.length > 0) args.push(current);
        return args;
    }

    // Run single command with optional stdin
    async runSingleCommand(cmdStr, stdin = '') {
        const args = this.parseArgs(cmdStr);
        if (args.length === 0) return { output: '', exitCode: 0 };

        let cmd = args[0];

        // Handle sudo prefix
        let isSudo = false;
        if (cmd === 'sudo') {
            isSudo = true;
            args.shift();
            if (args.length === 0) {
                return { output: 'usage: sudo command', exitCode: 1 };
            }
            cmd = args[0];
        }

        // Script execution via ./script.sh or sh script.sh
        if (cmd.startsWith('./') || cmd === 'bash' || cmd === 'sh') {
            return this.cmd_execute_script(args, isSudo);
        }

        // Command mapping
        const handlers = {
            'pwd': this.cmd_pwd,
            'cd': this.cmd_cd,
            'ls': this.cmd_ls,
            'mkdir': this.cmd_mkdir,
            'rmdir': this.cmd_rmdir,
            'touch': this.cmd_touch,
            'rm': this.cmd_rm,
            'cp': this.cmd_cp,
            'mv': this.cmd_mv,
            'cat': this.cmd_cat,
            'head': this.cmd_head,
            'tail': this.cmd_tail,
            'more': this.cmd_cat,
            'less': this.cmd_cat,
            'echo': this.cmd_echo,
            'grep': this.cmd_grep,
            'wc': this.cmd_wc,
            'sort': this.cmd_sort,
            'uniq': this.cmd_uniq,
            'find': this.cmd_find,
            'chmod': this.cmd_chmod,
            'chown': this.cmd_chown,
            'whoami': this.cmd_whoami,
            'id': this.cmd_id,
            'groups': this.cmd_groups,
            'su': this.cmd_su,
            'ps': this.cmd_ps,
            'top': this.cmd_top,
            'kill': this.cmd_kill,
            'killall': this.cmd_killall,
            'df': this.cmd_df,
            'free': this.cmd_free,
            'uptime': this.cmd_uptime,
            'uname': this.cmd_uname,
            'date': this.cmd_date,
            'hostname': this.cmd_hostname,
            'history': this.cmd_history,
            'ip': this.cmd_ip,
            'ifconfig': this.cmd_ifconfig,
            'ping': this.cmd_ping,
            'curl': this.cmd_curl,
            'apt': this.cmd_apt,
            'apt-get': this.cmd_apt,
            'neofetch': this.cmd_neofetch,
            'tree': this.cmd_tree,
            'nano': this.cmd_nano,
            'help': this.cmd_help,
            'man': this.cmd_man,
            'clear': () => ({ output: '__CLEAR__', exitCode: 0 }),
            'cls': () => ({ output: '__CLEAR__', exitCode: 0 }),
            'exit': () => ({ output: 'logout\n[Session ended]', exitCode: 0 })
        };

        if (handlers[cmd]) {
            try {
                return await handlers[cmd].call(this, args.slice(1), stdin, isSudo);
            } catch (err) {
                return { output: `${cmd}: internal error: ${err.message}`, exitCode: 1 };
            }
        }

        return { output: `bash: ${cmd}: command not found`, exitCode: 127 };
    }

    // Core Command Implementations
    cmd_pwd(args) {
        return { output: this.cwd, exitCode: 0 };
    }

    cmd_cd(args) {
        let target = args[0] || '~';
        if (target === '-') {
            target = this.oldCwd;
        }

        const resolved = this.vfs.resolvePath(target, this.cwd);
        const node = this.vfs.getNode(resolved);

        if (!node) {
            return { output: `bash: cd: ${target}: No such file or directory`, exitCode: 1 };
        }
        if (node.type !== 'dir') {
            return { output: `bash: cd: ${target}: Not a directory`, exitCode: 1 };
        }

        this.oldCwd = this.cwd;
        this.cwd = resolved;
        this.env.PWD = resolved;
        return { output: '', exitCode: 0 };
    }

    cmd_ls(args) {
        let showAll = false;
        let showLong = false;
        let human = false;
        const targets = [];

        for (const arg of args) {
            if (arg.startsWith('-')) {
                if (arg.includes('a')) showAll = true;
                if (arg.includes('l')) showLong = true;
                if (arg.includes('h')) human = true;
            } else {
                targets.push(arg);
            }
        }

        const targetPath = targets[0] ? this.vfs.resolvePath(targets[0], this.cwd) : this.cwd;
        const node = this.vfs.getNode(targetPath);

        if (!node) {
            return { output: `ls: cannot access '${targets[0]}': No such file or directory`, exitCode: 2 };
        }

        if (node.type === 'file') {
            if (showLong) {
                const perm = this.vfs.modeToString('file', node.mode);
                const size = node.content ? node.content.length : 0;
                return { output: `${perm} 1 ${node.owner} ${node.group} ${size.toString().padStart(5)} Sep 15 11:00 ${node.name}`, exitCode: 0 };
            }
            return { output: node.name, exitCode: 0 };
        }

        let names = Object.keys(node.children).sort();
        if (showAll) {
            names = ['.', '..', ...names];
        } else {
            names = names.filter(n => !n.startsWith('.'));
        }

        if (showLong) {
            const lines = [`total ${names.length * 4}`];
            for (const name of names) {
                let child = null;
                let isDir = false;
                let mode = '755';
                let owner = 'student';
                let group = 'student';
                let size = 4096;

                if (name === '.') {
                    child = node;
                    isDir = true;
                    mode = node.mode;
                    owner = node.owner;
                    group = node.group;
                } else if (name === '..') {
                    const parent = this.vfs.getParentNode(targetPath) || node;
                    child = parent;
                    isDir = true;
                    mode = parent.mode;
                    owner = parent.owner;
                    group = parent.group;
                } else {
                    child = node.children[name];
                    isDir = child.type === 'dir';
                    mode = child.mode;
                    owner = child.owner;
                    group = child.group;
                    size = isDir ? 4096 : (child.content ? child.content.length : 0);
                }

                const perm = this.vfs.modeToString(isDir ? 'dir' : 'file', mode);
                const colorClass = isDir ? 'color-dir' : (mode.includes('7') || mode.includes('1') ? 'color-exec' : '');
                lines.push(`${perm} 2 ${owner.padEnd(8)} ${group.padEnd(8)} ${size.toString().padStart(6)} Sep 15 11:00 <span class="${colorClass}">${name}</span>`);
            }
            return { output: lines.join('\n'), exitCode: 0 };
        }

        // Column style
        const formatted = names.map(name => {
            const child = node.children[name];
            const isDir = child ? child.type === 'dir' : (name === '.' || name === '..');
            const isExec = child && child.type === 'file' && (child.mode.includes('7') || child.mode.includes('1'));
            if (isDir) return `<span class="color-dir">${name}</span>`;
            if (isExec) return `<span class="color-exec">${name}</span>`;
            return name;
        });

        return { output: formatted.join('   '), exitCode: 0 };
    }

    cmd_mkdir(args) {
        let pFlag = false;
        const dirs = [];

        for (const arg of args) {
            if (arg === '-p' || arg === '--parents') {
                pFlag = true;
            } else if (!arg.startsWith('-')) {
                dirs.push(arg);
            }
        }

        if (dirs.length === 0) {
            return { output: 'mkdir: missing operand\nTry \'mkdir --help\' for more information.', exitCode: 1 };
        }

        for (const dir of dirs) {
            const absPath = this.vfs.resolvePath(dir, this.cwd);
            const res = this.vfs.mkdir(absPath, pFlag, '755', this.user, this.user);
            if (!res.success) return { output: res.error, exitCode: 1 };
        }

        return { output: '', exitCode: 0 };
    }

    cmd_rmdir(args) {
        if (args.length === 0) return { output: 'rmdir: missing operand', exitCode: 1 };
        for (const arg of args) {
            const absPath = this.vfs.resolvePath(arg, this.cwd);
            const node = this.vfs.getNode(absPath);
            if (!node) return { output: `rmdir: failed to remove '${arg}': No such file or directory`, exitCode: 1 };
            if (node.type !== 'dir') return { output: `rmdir: failed to remove '${arg}': Not a directory`, exitCode: 1 };
            if (Object.keys(node.children).length > 0) return { output: `rmdir: failed to remove '${arg}': Directory not empty`, exitCode: 1 };
            this.vfs.removeNode(absPath, false, false);
        }
        return { output: '', exitCode: 0 };
    }

    cmd_touch(args) {
        if (args.length === 0) return { output: 'touch: missing file operand', exitCode: 1 };
        for (const arg of args) {
            const absPath = this.vfs.resolvePath(arg, this.cwd);
            const res = this.vfs.createFile(absPath, '', '644', this.user, this.user);
            if (!res.success) return { output: `touch: cannot touch '${arg}': ${res.error}`, exitCode: 1 };
        }
        return { output: '', exitCode: 0 };
    }

    cmd_rm(args) {
        let recursive = false;
        let force = false;
        const targets = [];

        for (const arg of args) {
            if (arg.startsWith('-')) {
                if (arg.includes('r') || arg.includes('R')) recursive = true;
                if (arg.includes('f')) force = true;
            } else {
                targets.push(arg);
            }
        }

        if (targets.length === 0) {
            return { output: 'rm: missing operand', exitCode: 1 };
        }

        for (const target of targets) {
            const absPath = this.vfs.resolvePath(target, this.cwd);
            const res = this.vfs.removeNode(absPath, recursive, force);
            if (!res.success && !force) {
                return { output: res.error, exitCode: 1 };
            }
        }
        return { output: '', exitCode: 0 };
    }

    cmd_cp(args) {
        let recursive = false;
        const targets = [];

        for (const arg of args) {
            if (arg.startsWith('-')) {
                if (arg.includes('r') || arg.includes('R')) recursive = true;
            } else {
                targets.push(arg);
            }
        }

        if (targets.length < 2) {
            return { output: 'cp: missing file operand\nTry \'cp --help\' for more information.', exitCode: 1 };
        }

        const src = this.vfs.resolvePath(targets[0], this.cwd);
        const dest = this.vfs.resolvePath(targets[1], this.cwd);
        const res = this.vfs.copyNode(src, dest, recursive);

        return { output: res.success ? '' : res.error, exitCode: res.success ? 0 : 1 };
    }

    cmd_mv(args) {
        if (args.length < 2) {
            return { output: 'mv: missing file operand', exitCode: 1 };
        }
        const src = this.vfs.resolvePath(args[0], this.cwd);
        const dest = this.vfs.resolvePath(args[1], this.cwd);
        const res = this.vfs.moveNode(src, dest);
        return { output: res.success ? '' : res.error, exitCode: res.success ? 0 : 1 };
    }

    cmd_cat(args, stdin) {
        if (args.length === 0) {
            return { output: stdin || '', exitCode: 0 };
        }

        let output = '';
        for (const arg of args) {
            const absPath = this.vfs.resolvePath(arg, this.cwd);
            const res = this.vfs.readFile(absPath);
            if (!res.success) {
                return { output: res.error, exitCode: 1 };
            }
            output += (output ? '\n' : '') + res.content;
        }
        return { output: output.trimEnd(), exitCode: 0 };
    }

    cmd_head(args, stdin) {
        let numLines = 10;
        let filePath = null;

        for (let i = 0; i < args.length; i++) {
            if (args[i] === '-n' && args[i + 1]) {
                numLines = parseInt(args[i + 1], 10) || 10;
                i++;
            } else if (!args[i].startsWith('-')) {
                filePath = args[i];
            }
        }

        let content = stdin;
        if (filePath) {
            const absPath = this.vfs.resolvePath(filePath, this.cwd);
            const res = this.vfs.readFile(absPath);
            if (!res.success) return { output: res.error, exitCode: 1 };
            content = res.content;
        }

        const lines = (content || '').split('\n').slice(0, numLines);
        return { output: lines.join('\n'), exitCode: 0 };
    }

    cmd_tail(args, stdin) {
        let numLines = 10;
        let filePath = null;

        for (let i = 0; i < args.length; i++) {
            if (args[i] === '-n' && args[i + 1]) {
                numLines = parseInt(args[i + 1], 10) || 10;
                i++;
            } else if (!args[i].startsWith('-')) {
                filePath = args[i];
            }
        }

        let content = stdin;
        if (filePath) {
            const absPath = this.vfs.resolvePath(filePath, this.cwd);
            const res = this.vfs.readFile(absPath);
            if (!res.success) return { output: res.error, exitCode: 1 };
            content = res.content;
        }

        const allLines = (content || '').split('\n');
        const lines = allLines.slice(Math.max(0, allLines.length - numLines));
        return { output: lines.join('\n'), exitCode: 0 };
    }

    cmd_echo(args) {
        return { output: args.join(' '), exitCode: 0 };
    }

    cmd_grep(args, stdin) {
        let ignoreCase = false;
        let invert = false;
        let showLineNum = false;
        let pattern = null;
        let file = null;

        for (let i = 0; i < args.length; i++) {
            const a = args[i];
            if (a.startsWith('-')) {
                if (a.includes('i')) ignoreCase = true;
                if (a.includes('v')) invert = true;
                if (a.includes('n')) showLineNum = true;
            } else if (!pattern) {
                pattern = a;
            } else {
                file = a;
            }
        }

        if (!pattern) return { output: 'usage: grep [-ivn] pattern [file]', exitCode: 1 };

        let content = stdin;
        if (file) {
            const absPath = this.vfs.resolvePath(file, this.cwd);
            const res = this.vfs.readFile(absPath);
            if (!res.success) return { output: res.error, exitCode: 1 };
            content = res.content;
        }

        const lines = (content || '').split('\n');
        const flags = ignoreCase ? 'i' : '';
        const regex = new RegExp(pattern, flags);
        const matches = [];

        lines.forEach((line, idx) => {
            const isMatch = regex.test(line);
            if ((isMatch && !invert) || (!isMatch && invert)) {
                matches.push(showLineNum ? `${idx + 1}:${line}` : line);
            }
        });

        return { output: matches.join('\n'), exitCode: matches.length > 0 ? 0 : 1 };
    }

    cmd_wc(args, stdin) {
        let countLines = false;
        let countWords = false;
        let countBytes = false;
        let file = null;

        for (const a of args) {
            if (a.startsWith('-')) {
                if (a.includes('l')) countLines = true;
                if (a.includes('w')) countWords = true;
                if (a.includes('c')) countBytes = true;
            } else {
                file = a;
            }
        }

        if (!countLines && !countWords && !countBytes) {
            countLines = true;
            countWords = true;
            countBytes = true;
        }

        let content = stdin;
        if (file) {
            const absPath = this.vfs.resolvePath(file, this.cwd);
            const res = this.vfs.readFile(absPath);
            if (!res.success) return { output: res.error, exitCode: 1 };
            content = res.content;
        }

        const lines = (content || '').split('\n').length - 1;
        const words = (content || '').trim().split(/\s+/).filter(w => w.length > 0).length;
        const bytes = (content || '').length;

        const results = [];
        if (countLines) results.push(lines);
        if (countWords) results.push(words);
        if (countBytes) results.push(bytes);
        if (file) results.push(file);

        return { output: results.join(' '), exitCode: 0 };
    }

    cmd_sort(args, stdin) {
        let reverse = false;
        let numeric = false;
        let file = null;

        for (const a of args) {
            if (a.startsWith('-')) {
                if (a.includes('r')) reverse = true;
                if (a.includes('n')) numeric = true;
            } else {
                file = a;
            }
        }

        let content = stdin;
        if (file) {
            const absPath = this.vfs.resolvePath(file, this.cwd);
            const res = this.vfs.readFile(absPath);
            if (!res.success) return { output: res.error, exitCode: 1 };
            content = res.content;
        }

        let lines = (content || '').split('\n').filter(l => l.length > 0);
        lines.sort((a, b) => {
            if (numeric) {
                const nA = parseFloat(a) || 0;
                const nB = parseFloat(b) || 0;
                return nA - nB;
            }
            return a.localeCompare(b);
        });

        if (reverse) lines.reverse();
        return { output: lines.join('\n'), exitCode: 0 };
    }

    cmd_uniq(args, stdin) {
        let content = stdin;
        if (args[0]) {
            const absPath = this.vfs.resolvePath(args[0], this.cwd);
            const res = this.vfs.readFile(absPath);
            if (!res.success) return { output: res.error, exitCode: 1 };
            content = res.content;
        }

        const lines = (content || '').split('\n');
        const unique = [];
        for (let i = 0; i < lines.length; i++) {
            if (i === 0 || lines[i] !== lines[i - 1]) {
                unique.push(lines[i]);
            }
        }
        return { output: unique.join('\n'), exitCode: 0 };
    }

    cmd_find(args) {
        let rootSearch = '.';
        let namePattern = null;

        for (let i = 0; i < args.length; i++) {
            if (args[i] === '-name' && args[i + 1]) {
                namePattern = args[i + 1].replace(/['"]/g, '');
                i++;
            } else if (!args[i].startsWith('-')) {
                rootSearch = args[i];
            }
        }

        const startPath = this.vfs.resolvePath(rootSearch, this.cwd);
        const node = this.vfs.getNode(startPath);
        if (!node) return { output: `find: '${rootSearch}': No such file or directory`, exitCode: 1 };

        const results = [];
        const regex = namePattern ? new RegExp('^' + namePattern.replace(/\*/g, '.*') + '$') : null;

        const traverse = (currNode, currPath) => {
            if (!regex || regex.test(currNode.name)) {
                results.push(currPath);
            }
            if (currNode.type === 'dir') {
                for (const childName of Object.keys(currNode.children).sort()) {
                    const nextPath = currPath === '/' ? `/${childName}` : `${currPath}/${childName}`;
                    traverse(currNode.children[childName], nextPath);
                }
            }
        };

        traverse(node, rootSearch);
        return { output: results.join('\n'), exitCode: 0 };
    }

    cmd_chmod(args) {
        if (args.length < 2) {
            return { output: 'chmod: missing operand\nTry \'chmod --help\' for more information.', exitCode: 1 };
        }
        const mode = args[0];
        for (let i = 1; i < args.length; i++) {
            const absPath = this.vfs.resolvePath(args[i], this.cwd);
            const res = this.vfs.chmod(absPath, mode);
            if (!res.success) return { output: res.error, exitCode: 1 };
        }
        return { output: '', exitCode: 0 };
    }

    cmd_chown(args) {
        if (args.length < 2) {
            return { output: 'chown: missing operand', exitCode: 1 };
        }
        const userGroup = args[0];
        for (let i = 1; i < args.length; i++) {
            const absPath = this.vfs.resolvePath(args[i], this.cwd);
            const res = this.vfs.chown(absPath, userGroup);
            if (!res.success) return { output: res.error, exitCode: 1 };
        }
        return { output: '', exitCode: 0 };
    }

    cmd_whoami() {
        return { output: this.user, exitCode: 0 };
    }

    cmd_id(args) {
        const u = args[0] || this.user;
        if (u === 'root') {
            return { output: 'uid=0(root) gid=0(root) groups=0(root)', exitCode: 0 };
        }
        return { output: 'uid=1000(student) gid=1000(student) groups=1000(student),4(adm),27(sudo)', exitCode: 0 };
    }

    cmd_groups() {
        if (this.user === 'root') return { output: 'root', exitCode: 0 };
        return { output: 'student adm sudo', exitCode: 0 };
    }

    cmd_su(args) {
        const target = args[0] || 'root';
        if (target === 'root') {
            this.user = 'root';
            this.env.USER = 'root';
            this.env.HOME = '/root';
            return { output: 'Switching to superuser root mode.', exitCode: 0 };
        } else if (target === 'student') {
            this.user = 'student';
            this.env.USER = 'student';
            this.env.HOME = '/home/student';
            return { output: 'Back to student user mode.', exitCode: 0 };
        }
        return { output: `su: user ${target} does not exist`, exitCode: 1 };
    }

    cmd_ps(args) {
        const lines = ['USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND'];
        for (const p of this.processes) {
            lines.push(
                `${p.user.padEnd(10)} ${p.pid.toString().padStart(5)} ${p.cpu.padStart(4)} ${p.mem.padStart(4)}  ` +
                `108442  4096 pts/0    S+   11:00   0:00 ${p.command}`
            );
        }
        return { output: lines.join('\n'), exitCode: 0 };
    }

    cmd_top() {
        return {
            output: 
`top - 11:45:10 up 2:15,  1 user,  load average: 0.15, 0.22, 0.18
Tasks:  10 total,   1 running,   9 sleeping,   0 stopped,   0 zombie
%Cpu(s):  1.5 us,  0.8 sy,  0.0 ni, 97.4 id,  0.2 wa,  0.0 hi,  0.1 si
MiB Mem :   7950.4 total,   3412.1 free,   2180.5 used,   2357.8 buff/cache
MiB Swap:   2048.0 total,   2048.0 free,      0.0 used.   5420.2 avail Mem

   PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
  2341 nobody    20   0  512400  84200   2100 R  98.5   8.4   1:42.10 crypto_miner
  1043 www-data  20   0   89200  12400   4500 S   0.2   1.5   0:02.12 nginx
   842 root      20   0   18400   6100   2800 S   0.0   0.7   0:00.35 sshd
  1411 student   20   0   14200   7200   3200 S   0.0   0.9   0:00.18 bash
`,
            exitCode: 0
        };
    }

    cmd_kill(args) {
        if (args.length === 0) return { output: 'kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ...', exitCode: 1 };
        let pid = parseInt(args[args.length - 1], 10);
        const initialLen = this.processes.length;
        this.processes = this.processes.filter(p => p.pid !== pid);

        if (this.processes.length < initialLen) {
            return { output: `[Process ${pid} terminated]`, exitCode: 0 };
        }
        return { output: `bash: kill: (${pid}) - No such process`, exitCode: 1 };
    }

    cmd_killall(args) {
        if (args.length === 0) return { output: 'killall: missing process name', exitCode: 1 };
        const name = args[0];
        const initialLen = this.processes.length;
        this.processes = this.processes.filter(p => !p.command.includes(name));

        if (this.processes.length < initialLen) {
            return { output: `[Terminated processes matching '${name}']`, exitCode: 0 };
        }
        return { output: `${name}: no process found`, exitCode: 1 };
    }

    cmd_df(args) {
        return {
            output: 
`Filesystem      Size  Used Avail Use% Mounted on
udev            3.9G     0  3.9G   0% /dev
tmpfs           796M  1.4M  795M   1% /run
/dev/sda1        50G   14G   34G  30% /
tmpfs           3.9G     0  3.9G   0% /dev/shm
tmpfs           5.0M     0  5.0M   0% /run/lock
/dev/sda15      105M  6.1M   99M   6% /boot/efi
`,
            exitCode: 0
        };
    }

    cmd_free(args) {
        return {
            output:
`               total        used        free      shared  buff/cache   available
Mem:            7950        2180        3412          24        2357        5420
Swap:           2048           0        2048
`,
            exitCode: 0
        };
    }

    cmd_uptime() {
        return { output: ' 11:46:14 up  2:16,  1 user,  load average: 0.08, 0.15, 0.12', exitCode: 0 };
    }

    cmd_uname(args) {
        if (args.includes('-a')) {
            return { output: 'Linux linux-lab 6.8.0-40-generic #40-Ubuntu SMP PREEMPT_DYNAMIC x86_64 x86_64 x86_64 GNU/Linux', exitCode: 0 };
        }
        if (args.includes('-r')) {
            return { output: '6.8.0-40-generic', exitCode: 0 };
        }
        return { output: 'Linux', exitCode: 0 };
    }

    cmd_date() {
        return { output: new Date().toString(), exitCode: 0 };
    }

    cmd_hostname() {
        return { output: this.hostname, exitCode: 0 };
    }

    cmd_history() {
        return {
            output: this.history.map((line, idx) => `${(idx + 1).toString().padStart(5)}  ${line}`).join('\n'),
            exitCode: 0
        };
    }

    cmd_ip(args) {
        return {
            output:
`1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000
    link/ether 52:54:00:12:34:56 brd ff:ff:ff:ff:ff:ff
    inet 192.168.1.105/24 brd 192.168.1.255 scope global dynamic eth0
       valid_lft 86340sec preferred_lft 86340sec
`,
            exitCode: 0
        };
    }

    cmd_ifconfig() {
        return this.cmd_ip();
    }

    async cmd_ping(args) {
        const host = args[0] || '8.8.8.8';
        const lines = [
            `PING ${host} (${host}) 56(84) bytes of data.`,
            `64 bytes from ${host}: icmp_seq=1 ttl=118 time=14.2 ms`,
            `64 bytes from ${host}: icmp_seq=2 ttl=118 time=13.8 ms`,
            `64 bytes from ${host}: icmp_seq=3 ttl=118 time=14.5 ms`,
            `64 bytes from ${host}: icmp_seq=4 ttl=118 time=13.9 ms`,
            `--- ${host} ping statistics ---`,
            `4 packets transmitted, 4 received, 0% packet loss, time 3004ms`,
            `rtt min/avg/max/mdev = 13.811/14.112/14.524/0.278 ms`
        ];
        return { output: lines.join('\n'), exitCode: 0 };
    }

    async cmd_curl(args) {
        const url = args.find(a => !a.startsWith('-')) || 'https://linux-lms.local';
        return {
            output:
`HTTP/1.1 200 OK
Date: ${new Date().toUTCString()}
Server: NGINX/1.24.0 (Ubuntu)
Content-Type: application/json; charset=utf-8
Content-Length: 68

{"status": "success", "message": "Virtual Linux Lab REST API is healthy"}`,
            exitCode: 0
        };
    }

    cmd_apt(args, stdin, isSudo) {
        const sub = args[0];
        const pkg = args[1];

        if (sub === 'update') {
            return {
                output:
`Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease
Get:2 http://archive.ubuntu.com/ubuntu noble-updates InRelease [126 kB]
Get:3 http://security.ubuntu.com/ubuntu noble-security InRelease [126 kB]
Fetched 252 kB in 1s (320 kB/s)
Reading package lists... Done
Building dependency tree... Done
All packages are up to date.`,
                exitCode: 0
            };
        } else if (sub === 'install') {
            if (!pkg) return { output: 'apt install: missing package name', exitCode: 1 };
            this.installedPackages.add(pkg);
            return {
                output:
`Reading package lists... Done
Building dependency tree... Done
The following NEW packages will be installed:
  ${pkg}
0 upgraded, 1 newly installed, 0 to remove.
Need to get 142 kB of archives.
Selecting previously unselected package ${pkg}.
Setting up ${pkg} ...
Processing triggers for man-db ...
Package '${pkg}' installed successfully!`,
                exitCode: 0
            };
        }
        return { output: 'apt: usage: apt [update | install <pkg> | remove <pkg>]', exitCode: 1 };
    }

    cmd_neofetch() {
        return {
            output:
`<span style="color:#e95420">            .-/+oossssoo+/-.               </span><span style="color:#50fa7b">student</span>@<span style="color:#50fa7b">linux-lab</span>
<span style="color:#e95420">        \`:+ssssssssssssssssss+:\`           </span>-----------------
<span style="color:#e95420">      -+ssssssssssssssssssyyssss+-         </span><span style="color:#ffb86c">OS:</span> Ubuntu 24.04 LTS x86_64
<span style="color:#e95420">    .ossssssssssssssssssdMMMNysssso.       </span><span style="color:#ffb86c">Host:</span> Virtual Linux Lab Container
<span style="color:#e95420">   /ssssssssssshdmmNNmmyNMMMMhssssss/      </span><span style="color:#ffb86c">Kernel:</span> 6.8.0-generic
<span style="color:#e95420">  +ssssssssshmydMMMMMMMNddddyssssssss+     </span><span style="color:#ffb86c">Uptime:</span> 2 hours, 16 mins
<span style="color:#e95420"> /sssssssshNMMMyhhyyyyhmNMMMNhssssssss/    </span><span style="color:#ffb86c">Packages:</span> 542 (dpkg)
<span style="color:#e95420">.ssssssssdMMMNhsssssssssshNMMMdssssssss.   </span><span style="color:#ffb86c">Shell:</span> bash 5.2.21
<span style="color:#e95420">+sssshhhyNMMNyssssssssssssyNMMMysssssss+   </span><span style="color:#ffb86c">Terminal:</span> xterm-256color
<span style="color:#e95420">ossyNMMMNyMMhsssssssssssssshmmmhssssssso   </span><span style="color:#ffb86c">CPU:</span> AMD EPYC 7763 (4) @ 2.44GHz
<span style="color:#e95420">ossyNMMMNyMMhsssssssssssssshmmmhssssssso   </span><span style="color:#ffb86c">Memory:</span> 2180MiB / 7950MiB
<span style="color:#e95420">+sssshhhyNMMNyssssssssssssyNMMMysssssss+   </span>
<span style="color:#e95420">.ssssssssdMMMNhsssssssssshNMMMdssssssss.   <span style="background:#000;color:#fff">&nbsp;</span><span style="background:#f55;color:#fff">&nbsp;</span><span style="background:#5f5;color:#fff">&nbsp;</span><span style="background:#ff5;color:#fff">&nbsp;</span><span style="background:#55f;color:#fff">&nbsp;</span><span style="background:#f5f;color:#fff">&nbsp;</span><span style="background:#5ff;color:#fff">&nbsp;</span><span style="background:#fff;color:#000">&nbsp;</span></span>
<span style="color:#e95420"> /sssssssshNMMMyhhyyyyhdNMMMNhssssssss/    </span>
<span style="color:#e95420">  +sssssssssdmydMMMMMMMMddddyssssssss+     </span>
<span style="color:#e95420">   /ssssssssssshdmNNNNmyNMMMMhssssss/      </span>
<span style="color:#e95420">    .ossssssssssssssssssdMMMNysssso.       </span>
<span style="color:#e95420">      -+sssssssssssssssssyyyssss+-         </span>
<span style="color:#e95420">        \`:+ssssssssssssssssss+:\`           </span>
<span style="color:#e95420">            .-/+oossssoo+/-.               </span>`,
            exitCode: 0
        };
    }

    cmd_tree(args) {
        const target = args[0] || '.';
        const absPath = this.vfs.resolvePath(target, this.cwd);
        return { output: this.vfs.getTreeString(absPath), exitCode: 0 };
    }

    cmd_nano(args) {
        const filename = args[0];
        if (!filename) {
            return { output: 'nano: missing filename', exitCode: 1 };
        }
        const absPath = this.vfs.resolvePath(filename, this.cwd);
        
        // Trigger external nano editor event
        if (window.openNanoEditor) {
            window.openNanoEditor(absPath);
            return { output: '__NANO_OPENED__', exitCode: 0 };
        }
        return { output: 'nano: editor subsystem initialized', exitCode: 0 };
    }

    cmd_execute_script(args, isSudo) {
        let scriptPath = args[0];
        if (scriptPath === 'bash' || scriptPath === 'sh') {
            scriptPath = args[1];
        }
        if (!scriptPath) return { output: 'bash: missing script file', exitCode: 1 };

        const absPath = this.vfs.resolvePath(scriptPath, this.cwd);
        const fileNode = this.vfs.getNode(absPath);

        if (!fileNode) {
            return { output: `bash: ${scriptPath}: No such file or directory`, exitCode: 127 };
        }

        const lines = (fileNode.content || '').split('\n');
        let output = '';
        let exitCode = 0;

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) continue; // Skip comments and shebang

            // Simple variable assignment (e.g. VAR=val)
            const varMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
            if (varMatch) {
                const varName = varMatch[1];
                let val = varMatch[2].replace(/^["']|["']$/g, '');
                this.env[varName] = val;
                continue;
            }

            // Normal command run
            const res = this.runSingleCommand(line);
            if (res.output && res.output !== '__CLEAR__') {
                output += (output ? '\n' : '') + res.output;
            }
        }

        return { output: output || `Script '${scriptPath}' executed successfully.`, exitCode: exitCode };
    }

    cmd_help() {
        return {
            output:
`Linux LMS Virtual Shell (v2.4 - Ubuntu Simulator)
Daftar perintah yang didukung:

1. Navigasi & File:
   pwd, ls (-la), cd, mkdir (-p), rmdir, touch, rm (-rf), cp (-r), mv, tree
2. Baca & Manipulasi Teks:
   cat, head (-n), tail (-n), grep (-i, -v, -n), wc (-l, -w), sort (-r, -n), uniq, find, echo
3. Izin & User:
   chmod, chown, whoami, id, groups, su, sudo
4. Proses & Sistem:
   ps aux, top, kill, killall, df -h, free -m, uptime, uname -a, date, hostname, history
5. Jaringan & Paket:
   ip a, ifconfig, ping, curl, apt (update, install), neofetch
6. Editor Teks:
   nano <nama_file> (Membuka editor interaktif di dalam terminal!)
7. Shell Features:
   Pipeline (|), Output Redirection (> dan >>), Command Chaining (&&, ;), Tab Autocomplete.`,
            exitCode: 0
        };
    }

    cmd_man(args) {
        if (!args[0]) return { output: 'What manual page do you want?\nFor example, try \'man ls\'.', exitCode: 1 };
        return {
            output: `MANUAL PAGE FOR: ${args[0].toUpperCase()}(1)\nInformasi detail perintah '${args[0]}'. Silakan gunakan 'help' atau pelajari di tab Cheatsheet.`,
            exitCode: 0
        };
    }
}

// Global Shell instance
window.shell = new LinuxShell(window.vfs);
