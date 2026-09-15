/**
 * Linux Virtual File System (VFS)
 * Implements a hierarchical in-memory filesystem with nodes, permissions, and initial state.
 */

class VirtualFileSystem {
    constructor() {
        this.root = null;
        this.scenario = 'sandbox';
        this.init();
    }

    init(scenario = 'sandbox') {
        this.scenario = scenario;
        const now = new Date().toISOString();

        // Base Root Node
        this.root = {
            name: '',
            type: 'dir',
            mode: '755',
            owner: 'root',
            group: 'root',
            mtime: now,
            children: {}
        };

        // Standard FHS Directories
        const standardDirs = [
            'bin', 'boot', 'dev', 'etc', 'home', 'lib', 'lib64',
            'media', 'mnt', 'opt', 'proc', 'root', 'run', 'sbin',
            'srv', 'sys', 'tmp', 'usr', 'var'
        ];

        for (const dir of standardDirs) {
            this.mkdir(`/${dir}`, true, '755', 'root', 'root');
        }

        // Subdirectories
        this.mkdir('/home/student', true, '755', 'student', 'student');
        this.mkdir('/var/log', true, '755', 'root', 'root');
        this.mkdir('/var/log/nginx', true, '755', 'root', 'root');
        this.mkdir('/var/backup', true, '755', 'root', 'root');
        this.mkdir('/usr/bin', true, '755', 'root', 'root');
        this.mkdir('/usr/local', true, '755', 'root', 'root');
        this.mkdir('/etc/nginx', true, '755', 'root', 'root');
        this.mkdir('/tmp', true, '777', 'root', 'root');

        // Populate standard realistic files
        this.createFile('/etc/os-release', 
`NAME="Ubuntu"
VERSION="24.04 LTS (Noble Numbat)"
ID=ubuntu
ID_LIKE=debian
PRETTY_NAME="Ubuntu 24.04 LTS"
VERSION_ID="24.04"
HOME_URL="https://www.ubuntu.com/"
SUPPORT_URL="https://help.ubuntu.com/"
BUG_REPORT_URL="https://bugs.launchpad.net/ubuntu/"
`, '644', 'root', 'root');

        this.createFile('/etc/hostname', 'linux-lab\n', '644', 'root', 'root');
        
        this.createFile('/etc/hosts', 
`127.0.0.1   localhost
127.0.1.1   linux-lab
::1         localhost ip6-localhost ip6-loopback
`, '644', 'root', 'root');

        this.createFile('/etc/passwd',
`root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
sys:x:3:3:sys:/dev:/usr/sbin/nologin
sync:x:4:65534:sync:/bin:/bin/sync
games:x:5:60:games:/usr/games:/usr/sbin/nologin
man:x:6:12:man:/var/cache/man:/usr/sbin/nologin
mail:x:8:8:mail:/var/mail:/usr/sbin/nologin
news:x:9:9:news:/var/spool/news:/usr/sbin/nologin
uucp:x:10:10:uucp:/var/spool/uucp:/usr/sbin/nologin
nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin
systemd-resolve:x:101:103:systemd Resolver,,,:/run/systemd/resolve:/usr/sbin/nologin
student:x:1000:1000:Linux Student,,,:/home/student:/bin/bash
developer:x:1001:1001:App Developer,,,:/home/developer:/bin/bash
sysadmin:x:1002:1002:System Administrator,,,:/home/sysadmin:/bin/bash
`, '644', 'root', 'root');

        this.createFile('/etc/group',
`root:x:0:
daemon:x:1:
bin:x:2:
sys:x:3:
adm:x:4:student
sudo:x:27:student
student:x:1000:
developer:x:1001:
sysadmin:x:1002:
`, '644', 'root', 'root');

        // /var/log/syslog with realistic log lines
        this.createFile('/var/log/syslog',
`Sep 15 08:00:01 linux-lab systemd[1]: Starting Daily apt download activities...
Sep 15 08:00:05 linux-lab systemd[1]: apt-daily.service: Deactivated successfully.
Sep 15 08:12:33 linux-lab kernel: [    0.000000] Linux version 6.8.0-generic (buildd@linux)
Sep 15 08:15:10 linux-lab sshd[842]: Server listening on 0.0.0.0 port 22.
Sep 15 08:22:45 linux-lab systemd[1]: Started NGINX High Performance Web Server.
Sep 15 08:30:12 linux-lab nginx[1042]: [INFO] Worker process 1043 started.
Sep 15 08:35:19 linux-lab kernel: [  120.441] Memory buffer cache sync completed.
Sep 15 09:10:02 linux-lab systemd[1]: [CRITICAL] Storage volume /dev/sdb1 latency spike detected!
Sep 15 09:14:22 linux-lab nginx[1043]: [ERROR] Connection timed out while connecting to upstream
Sep 15 09:20:00 linux-lab database[1105]: [CRITICAL] Database replica sync failure on node-2!
Sep 15 09:45:11 linux-lab sshd[1410]: Accepted publickey for student from 192.168.1.50 port 52310
Sep 15 10:00:01 linux-lab CRON[1520]: (root) CMD (/usr/local/bin/healthcheck.sh)
Sep 15 10:15:43 linux-lab systemd[1]: [CRITICAL] Kernel out-of-memory killer invoked on worker pool
`, '644', 'root', 'root');

        // Nginx access log
        this.createFile('/var/log/nginx/access.log',
`192.168.1.50 - - [15/Sep/2026:08:30:20 +0700] "GET / HTTP/1.1" 200 612 "-" "Mozilla/5.0"
192.168.1.50 - - [15/Sep/2026:08:30:22 +0700] "GET /style.css HTTP/1.1" 200 1423 "-" "Mozilla/5.0"
10.0.0.99 - - [15/Sep/2026:08:45:10 +0700] "GET /admin HTTP/1.1" 403 162 "-" "curl/8.5.0"
10.0.0.99 - - [15/Sep/2026:08:45:15 +0700] "POST /api/login HTTP/1.1" 500 52 "-" "Python-requests"
10.0.0.99 - - [15/Sep/2026:08:46:01 +0700] "GET /index.php?id=1%20UNION%20SELECT HTTP/1.1" 400 230 "-" "sqlmap/1.7"
192.168.1.100 - - [15/Sep/2026:09:00:00 +0700] "GET /api/status HTTP/1.1" 200 45 "-" "UptimeRobot"
`, '644', 'root', 'root');

        // Challenge 1 secret key
        this.createFile('/var/backup/.secret_key', 'FLAG{L1NUX_H1DD3N_F1L3_FOUND_992}\n', '644', 'root', 'root');

        // Home student files
        this.createFile('/home/student/.bashrc', 
`# ~/.bashrc: executed by bash(1) for non-login shells.
export PS1='\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ '
alias ll='ls -la'
alias la='ls -A'
alias l='ls -CF'
alias cls='clear'
`, '644', 'student', 'student');

        this.createFile('/home/student/.profile', 
`# ~/.profile: executed by Bourne-compatible login shells.
if [ -n "$BASH_VERSION" ]; then
    if [ -f "$HOME/.bashrc" ]; then
        . "$HOME/.bashrc"
    fi
fi
`, '644', 'student', 'student');

        this.createFile('/home/student/welcome.txt',
`=============================================================
  SELAMAT DATANG DI VIRTUAL LINUX LAB (LMS LINUX INDONESIA)
=============================================================
Lingkungan ini merupakan simulator Linux interaktif dengan
Virtual File System (VFS) berbasis browser.

Tips Cepat:
- Ketik 'help' untuk melihat daftar perintah yang didukung.
- Tekan tombol [Tab] untuk auto-complete nama file atau direktori.
- Gunakan panah [Atas/Bawah] untuk melihat riwayat perintah.
- Ketik 'nano nama_file' untuk mengedit teks secara langsung!
- Ketik 'neofetch' untuk melihat informasi sistem.

Selamat belajar dan berlatih menguasai Linux! 🚀
`, '644', 'student', 'student');

        this.createFile('/home/student/sample_data.csv',
`id,name,department,salary
1,Budi Santoso,IT,12000000
2,Siti Rahma,HRD,8500000
3,Ahmad Fauzi,IT,14000000
4,Dewi Lestari,Finance,11000000
5,Eko Prasetyo,IT,9500000
6,Rina Anggraini,Marketing,9000000
`, '644', 'student', 'student');

        // Populate scenario-specific assets
        this.applyScenario(scenario);
    }

    applyScenario(scenario) {
        if (scenario === 'permission_audit') {
            this.mkdir('/home/student/audit_project', true, '777', 'student', 'student');
            this.createFile('/home/student/audit_project/database.env', 'DB_PASS=SuperSecretP@ssw0rd!\nDB_USER=root\n', '777', 'student', 'student');
            this.createFile('/home/student/audit_project/id_rsa', '-----BEGIN OPENSSH PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END OPENSSH PRIVATE KEY-----\n', '777', 'student', 'student');
            this.createFile('/home/student/deploy.sh', '#!/bin/bash\necho "Deploying code..."\n', '777', 'student', 'student');
        } else if (scenario === 'scripting_playground') {
            this.createFile('/home/student/loop_example.sh', 
`#!/bin/bash
for i in {1..5}; do
    echo "Counter: \$i"
done
`, '755', 'student', 'student');

            this.createFile('/home/student/check_file.sh',
`#!/bin/bash
TARGET="/etc/passwd"
if [ -f "\$TARGET" ]; then
    echo "\$TARGET exists!"
else
    echo "\$TARGET not found"
fi
`, '755', 'student', 'student');
        } else if (scenario === 'syslog_investigation') {
            this.createFile('/home/student/investigation_notes.txt', 
`Instruksi:
1. Periksa file /var/log/nginx/access.log untuk melihat IP penyerang.
2. Gunakan grep untuk memfilter error 500 dan 400.
3. Catat temuan Anda di file ini.
`, '644', 'student', 'student');
        }
    }

    // Path normalization and resolution
    resolvePath(pathStr, cwd = '/home/student') {
        if (!pathStr) return cwd;
        pathStr = pathStr.trim();

        // Handle ~ shortcut for home
        if (pathStr === '~' || pathStr.startsWith('~/')) {
            pathStr = '/home/student' + pathStr.slice(1);
        }

        let parts;
        if (pathStr.startsWith('/')) {
            parts = pathStr.split('/').filter(p => p.length > 0);
        } else {
            const cwdParts = cwd.split('/').filter(p => p.length > 0);
            const inputParts = pathStr.split('/').filter(p => p.length > 0);
            parts = cwdParts.concat(inputParts);
        }

        const resolved = [];
        for (const part of parts) {
            if (part === '.') {
                continue;
            } else if (part === '..') {
                if (resolved.length > 0) resolved.pop();
            } else {
                resolved.push(part);
            }
        }

        return '/' + resolved.join('/');
    }

    // Traverse to a node
    getNode(absPath) {
        if (absPath === '/') return this.root;
        const parts = absPath.split('/').filter(p => p.length > 0);
        let curr = this.root;

        for (const part of parts) {
            if (!curr || curr.type !== 'dir' || !curr.children[part]) {
                return null;
            }
            curr = curr.children[part];
        }
        return curr;
    }

    getParentNode(absPath) {
        const parts = absPath.split('/').filter(p => p.length > 0);
        if (parts.length === 0) return null; // Root has no parent
        parts.pop();
        const parentPath = '/' + parts.join('/');
        return this.getNode(parentPath);
    }

    getBaseName(absPath) {
        const parts = absPath.split('/').filter(p => p.length > 0);
        return parts.length > 0 ? parts[parts.length - 1] : '';
    }

    // File & Directory Operations
    mkdir(absPath, pFlag = false, mode = '755', owner = 'student', group = 'student') {
        const parts = absPath.split('/').filter(p => p.length > 0);
        let curr = this.root;
        let builtPath = '';

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            builtPath += '/' + part;
            
            if (!curr.children[part]) {
                if (!pFlag && i < parts.length - 1) {
                    return { success: false, error: `mkdir: cannot create directory '${absPath}': No such file or directory` };
                }
                curr.children[part] = {
                    name: part,
                    type: 'dir',
                    mode: mode,
                    owner: owner,
                    group: group,
                    mtime: new Date().toISOString(),
                    children: {}
                };
            } else if (curr.children[part].type !== 'dir') {
                return { success: false, error: `mkdir: cannot create directory '${absPath}': Not a directory` };
            }
            curr = curr.children[part];
        }

        return { success: true, node: curr };
    }

    createFile(absPath, content = '', mode = '644', owner = 'student', group = 'student') {
        const parent = this.getParentNode(absPath);
        const name = this.getBaseName(absPath);

        if (!parent || parent.type !== 'dir') {
            return { success: false, error: `No such file or directory: ${absPath}` };
        }

        if (parent.children[name]) {
            // Already exists, update mtime
            parent.children[name].mtime = new Date().toISOString();
            if (content !== null && content !== undefined) {
                parent.children[name].content = content;
            }
            return { success: true, node: parent.children[name] };
        }

        const node = {
            name: name,
            type: 'file',
            mode: mode,
            owner: owner,
            group: group,
            mtime: new Date().toISOString(),
            content: content
        };

        parent.children[name] = node;
        return { success: true, node: node };
    }

    writeFile(absPath, content, append = false) {
        let node = this.getNode(absPath);
        if (!node) {
            const res = this.createFile(absPath, content);
            return res;
        }

        if (node.type === 'dir') {
            return { success: false, error: `${absPath}: Is a directory` };
        }

        if (append) {
            node.content = (node.content || '') + content;
        } else {
            node.content = content;
        }
        node.mtime = new Date().toISOString();
        return { success: true, node: node };
    }

    readFile(absPath) {
        const node = this.getNode(absPath);
        if (!node) {
            return { success: false, error: `cat: ${absPath}: No such file or directory` };
        }
        if (node.type === 'dir') {
            return { success: false, error: `cat: ${absPath}: Is a directory` };
        }
        return { success: true, content: node.content || '' };
    }

    removeNode(absPath, recursive = false, force = false) {
        if (absPath === '/') {
            return { success: false, error: 'rm: it is dangerous to operate recursively on /' };
        }

        const parent = this.getParentNode(absPath);
        const name = this.getBaseName(absPath);

        if (!parent || !parent.children[name]) {
            if (force) return { success: true };
            return { success: false, error: `rm: cannot remove '${absPath}': No such file or directory` };
        }

        const target = parent.children[name];
        if (target.type === 'dir') {
            const hasChildren = Object.keys(target.children).length > 0;
            if (!recursive) {
                return { success: false, error: `rm: cannot remove '${absPath}': Is a directory` };
            }
        }

        delete parent.children[name];
        return { success: true };
    }

    copyNode(srcPath, destPath, recursive = false) {
        const srcNode = this.getNode(srcPath);
        if (!srcNode) {
            return { success: false, error: `cp: cannot stat '${srcPath}': No such file or directory` };
        }

        if (srcNode.type === 'dir' && !recursive) {
            return { success: false, error: `cp: -r not specified; omitting directory '${srcPath}'` };
        }

        let targetDir = this.getNode(destPath);
        let targetName;

        if (targetDir && targetDir.type === 'dir') {
            targetName = srcNode.name;
        } else {
            targetDir = this.getParentNode(destPath);
            targetName = this.getBaseName(destPath);
        }

        if (!targetDir || targetDir.type !== 'dir') {
            return { success: false, error: `cp: cannot create '${destPath}': No such file or directory` };
        }

        // Deep clone helper
        const clone = (node, newName) => {
            if (node.type === 'file') {
                return {
                    name: newName || node.name,
                    type: 'file',
                    mode: node.mode,
                    owner: node.owner,
                    group: node.group,
                    mtime: new Date().toISOString(),
                    content: node.content
                };
            } else {
                const newDir = {
                    name: newName || node.name,
                    type: 'dir',
                    mode: node.mode,
                    owner: node.owner,
                    group: node.group,
                    mtime: new Date().toISOString(),
                    children: {}
                };
                for (const childName of Object.keys(node.children)) {
                    newDir.children[childName] = clone(node.children[childName]);
                }
                return newDir;
            }
        };

        targetDir.children[targetName] = clone(srcNode, targetName);
        return { success: true };
    }

    moveNode(srcPath, destPath) {
        const cpRes = this.copyNode(srcPath, destPath, true);
        if (!cpRes.success) return cpRes;
        return this.removeNode(srcPath, true, true);
    }

    chmod(absPath, modeStr) {
        const node = this.getNode(absPath);
        if (!node) {
            return { success: false, error: `chmod: cannot access '${absPath}': No such file or directory` };
        }

        // Handle numeric mode like 755, 644, 600, 777
        if (/^[0-7]{3,4}$/.test(modeStr)) {
            node.mode = modeStr.slice(-3);
            return { success: true };
        }

        // Handle symbolic mode (+x, -w, u+x, go-w, etc.)
        let currentMode = parseInt(node.mode, 8);
        let u = (currentMode >> 6) & 7;
        let g = (currentMode >> 3) & 7;
        let o = currentMode & 7;

        if (modeStr === '+x') {
            u |= 1; g |= 1; o |= 1;
        } else if (modeStr === '-x') {
            u &= ~1; g &= ~1; o &= ~1;
        } else if (modeStr === '+w') {
            u |= 2;
        } else if (modeStr === '-w') {
            u &= ~2; g &= ~2; o &= ~2;
        } else if (modeStr === '+r') {
            u |= 4; g |= 4; o |= 4;
        } else if (modeStr === 'u+x') {
            u |= 1;
        }

        node.mode = `${u}${g}${o}`;
        return { success: true };
    }

    chown(absPath, userGroupStr) {
        const node = this.getNode(absPath);
        if (!node) {
            return { success: false, error: `chown: cannot access '${absPath}': No such file or directory` };
        }

        let [user, group] = userGroupStr.split(':');
        if (user) node.owner = user;
        if (group) node.group = group;
        return { success: true };
    }

    // Helper: mode to string (e.g. 755 -> -rwxr-xr-x)
    modeToString(type, mode) {
        const oct = mode ? parseInt(mode.slice(-3), 8) : 0o644;
        const prefix = type === 'dir' ? 'd' : '-';
        
        const triplet = (val) => {
            let str = '';
            str += (val & 4) ? 'r' : '-';
            str += (val & 2) ? 'w' : '-';
            str += (val & 1) ? 'x' : '-';
            return str;
        };

        const u = triplet((oct >> 6) & 7);
        const g = triplet((oct >> 3) & 7);
        const o = triplet(oct & 7);

        return `${prefix}${u}${g}${o}`;
    }

    // Generate Tree View
    getTreeString(absPath = '/') {
        const startNode = this.getNode(absPath);
        if (!startNode) return `${absPath} [error opening dir]`;
        if (startNode.type !== 'dir') return `${absPath}\n0 directories, 1 file`;

        let lines = [absPath];
        let dirCount = 0;
        let fileCount = 0;

        const buildTree = (node, prefix) => {
            const keys = Object.keys(node.children).sort();
            keys.forEach((key, index) => {
                const isLast = index === keys.length - 1;
                const child = node.children[key];
                const connector = isLast ? '└── ' : '├── ';
                const childPrefix = isLast ? '    ' : '│   ';

                lines.push(`${prefix}${connector}${child.name}`);
                if (child.type === 'dir') {
                    dirCount++;
                    buildTree(child, prefix + childPrefix);
                } else {
                    fileCount++;
                }
            });
        };

        buildTree(startNode, '');
        lines.push(`\n${dirCount} directories, ${fileCount} files`);
        return lines.join('\n');
    }
}

// Global VFS instance
window.vfs = new VirtualFileSystem();
