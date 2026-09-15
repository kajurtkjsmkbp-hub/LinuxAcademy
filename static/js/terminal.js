/**
 * Interactive Linux Terminal Component
 * Handles input events, cursor, auto-complete, history, and rendering.
 */

class LinuxTerminal {
    constructor(containerId, shell) {
        this.container = document.getElementById(containerId);
        this.shell = shell;
        this.history = [];
        this.historyIndex = -1;
        this.currentInput = '';
        this.isExecuting = false;

        this.initUI();
    }

    initUI() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="term-window">
                <div class="term-titlebar">
                    <div class="term-traffic-lights">
                        <span class="light light-red" title="Tutup"></span>
                        <span class="light light-yellow" title="Minimalkan"></span>
                        <span class="light light-green" title="Maksimalkan"></span>
                    </div>
                    <div class="term-title">
                        <i class="bi bi-terminal-fill"></i>
                        <span>student@linux-lab: ~ (bash)</span>
                    </div>
                    <div class="term-actions">
                        <button class="term-btn" id="btn-term-clear" title="Bersihkan Layar (Ctrl+L)"><i class="bi bi-eraser-fill"></i></button>
                        <button class="term-btn" id="btn-term-reset" title="Reset Lab ke Awal"><i class="bi bi-arrow-counterclockwise"></i></button>
                        <button class="term-btn" id="btn-term-fullscreen" title="Layar Penuh"><i class="bi bi-arrows-fullscreen"></i></button>
                    </div>
                </div>

                <div class="term-toolbar-mobile">
                    <button class="term-quick-btn" id="qbtn-tab">⇥ Tab</button>
                    <button class="term-quick-btn" id="qbtn-ctrlc">^C</button>
                    <button class="term-quick-btn" id="qbtn-up">▲</button>
                    <button class="term-quick-btn" id="qbtn-down">▼</button>
                    <button class="term-quick-btn" id="qbtn-clear">Clear</button>
                    <button class="term-quick-btn" id="qbtn-help">Help</button>
                </div>

                <div class="term-body" id="term-output-area">
                    <div class="term-welcome-banner">
                        <pre class="term-ascii-logo">
   _     _                  _      __  __ ____  
  | |   (_)_ __  _   ___  _| |    |  \\/  / ___| 
  | |   | | '_ \\| | | \\ \\/ / |    | |\\/| \\___ \\ 
  | |___| | | | | |_| |>  <| |___ | |  | |___) |
  |_____|_|_| |_|\\__,_/_/\\_\\_____||_|  |_|____/ 
                        </pre>
                        <p class="term-welcome-text">
                            Selamat datang di <strong>Linux Virtual Lab</strong> (v2.4 LTS).<br>
                            Ketik <span class="badge-cmd">help</span> untuk daftar perintah, atau klik tombol latihan di modul materi.
                        </p>
                    </div>
                    <div id="term-history-log"></div>
                    <div class="term-input-line" id="term-active-line">
                        <span class="term-prompt-label" id="term-prompt-label"></span>
                        <div class="term-input-wrapper">
                            <input type="text" id="term-input-box" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
                            <span class="term-cursor"></span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.outputArea = this.container.querySelector('#term-output-area');
        this.historyLog = this.container.querySelector('#term-history-log');
        this.inputBox = this.container.querySelector('#term-input-box');
        this.promptLabel = this.container.querySelector('#term-prompt-label');

        this.updatePrompt();
        this.bindEvents();
        this.focusInput();
    }

    updatePrompt() {
        const p = this.shell.getPrompt();
        const userClass = p.user === 'root' ? 'prompt-root' : 'prompt-user';
        this.promptLabel.innerHTML = `<span class="${userClass}">${p.user}@${p.hostname}</span>:<span class="prompt-path">${p.path}</span><span class="prompt-symbol">${p.symbol}</span>&nbsp;`;
        
        // Update Titlebar
        const titleSpan = this.container.querySelector('.term-title span');
        if (titleSpan) {
            titleSpan.textContent = `${p.user}@${p.hostname}: ${p.path} (bash)`;
        }
    }

    bindEvents() {
        // Focus input on terminal body click
        this.outputArea.addEventListener('click', () => {
            this.focusInput();
        });

        // Keydown handling
        this.inputBox.addEventListener('keydown', async (e) => {
            if (this.isExecuting) return;

            if (e.key === 'Enter') {
                e.preventDefault();
                const cmd = this.inputBox.value;
                this.inputBox.value = '';
                await this.runCommand(cmd);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistory(-1);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistory(1);
            } else if (e.key === 'Tab') {
                e.preventDefault();
                this.handleTabComplete();
            } else if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
                e.preventDefault();
                this.cancelInput();
            } else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
                e.preventDefault();
                this.clearScreen();
            }
        });

        // Quick button controls
        document.getElementById('btn-term-clear')?.addEventListener('click', () => this.clearScreen());
        document.getElementById('qbtn-clear')?.addEventListener('click', () => this.clearScreen());
        
        document.getElementById('btn-term-reset')?.addEventListener('click', () => {
            if (confirm('Apakah Anda yakin ingin me-reset seluruh Virtual File System ke kondisi awal?')) {
                window.vfs.init(window.vfs.scenario || 'sandbox');
                this.clearScreen();
                this.printLine('Virtual File System telah di-reset ke kondisi awal.', 'color-success');
                this.prompt();
            }
        });

        document.getElementById('btn-term-fullscreen')?.addEventListener('click', () => {
            const win = this.container.querySelector('.term-window');
            win.classList.toggle('term-fullscreen');
            this.scrollToBottom();
        });

        document.getElementById('qbtn-tab')?.addEventListener('click', () => this.handleTabComplete());
        document.getElementById('qbtn-ctrlc')?.addEventListener('click', () => this.cancelInput());
        document.getElementById('qbtn-up')?.addEventListener('click', () => this.navigateHistory(-1));
        document.getElementById('qbtn-down')?.addEventListener('click', () => this.navigateHistory(1));
        document.getElementById('qbtn-help')?.addEventListener('click', () => this.runCommand('help'));
    }

    focusInput() {
        setTimeout(() => {
            if (this.inputBox) this.inputBox.focus();
        }, 50);
    }

    scrollToBottom() {
        if (this.outputArea) {
            this.outputArea.scrollTop = this.outputArea.scrollHeight;
        }
    }

    clearScreen() {
        this.historyLog.innerHTML = '';
        this.prompt();
    }

    cancelInput() {
        const line = document.createElement('div');
        line.className = 'term-log-entry';
        line.innerHTML = `<span class="term-prompt-log">${this.promptLabel.innerHTML}</span><span>${this.inputBox.value}^C</span>`;
        this.historyLog.appendChild(line);
        this.inputBox.value = '';
        this.prompt();
    }

    prompt() {
        this.updatePrompt();
        this.scrollToBottom();
        this.focusInput();
    }

    printLine(text, className = '') {
        const line = document.createElement('div');
        line.className = `term-output-line ${className}`;
        line.innerHTML = text;
        this.historyLog.appendChild(line);
        this.scrollToBottom();
    }

    async runCommand(cmdString) {
        cmdString = cmdString.trim();

        // Print command in history log
        const logEntry = document.createElement('div');
        logEntry.className = 'term-log-entry';
        logEntry.innerHTML = `<span class="term-prompt-log">${this.promptLabel.innerHTML}</span><span class="term-cmd-text">${this.escapeHtml(cmdString)}</span>`;
        this.historyLog.appendChild(logEntry);

        if (!cmdString) {
            this.prompt();
            return;
        }

        // Add to history
        this.history.push(cmdString);
        this.historyIndex = this.history.length;

        this.isExecuting = true;
        const res = await this.shell.execute(cmdString);
        this.isExecuting = false;

        if (res.output === '__CLEAR__') {
            this.clearScreen();
            return;
        } else if (res.output === '__NANO_OPENED__') {
            // Nano is open, no extra output needed
            return;
        } else if (res.output) {
            const outEntry = document.createElement('div');
            outEntry.className = 'term-output-block';
            outEntry.innerHTML = res.output;
            this.historyLog.appendChild(outEntry);
        }

        // Notify LMS of executed command for automated task checks
        if (window.lms) {
            window.lms.onCommandExecuted(cmdString, res);
        }

        this.prompt();
    }

    navigateHistory(direction) {
        if (this.history.length === 0) return;

        this.historyIndex += direction;
        if (this.historyIndex < 0) {
            this.historyIndex = 0;
        } else if (this.historyIndex >= this.history.length) {
            this.historyIndex = this.history.length;
            this.inputBox.value = '';
            return;
        }

        this.inputBox.value = this.history[this.historyIndex] || '';
        setTimeout(() => {
            this.inputBox.selectionStart = this.inputBox.selectionEnd = this.inputBox.value.length;
        }, 10);
    }

    handleTabComplete() {
        const text = this.inputBox.value;
        if (!text) return;

        const parts = text.split(' ');
        const lastWord = parts[parts.length - 1];

        if (parts.length === 1) {
            // Complete command name
            const allCmds = [
                'pwd', 'cd', 'ls', 'mkdir', 'rmdir', 'touch', 'rm', 'cp', 'mv',
                'cat', 'head', 'tail', 'more', 'less', 'echo', 'grep', 'wc',
                'sort', 'uniq', 'find', 'chmod', 'chown', 'whoami', 'id',
                'groups', 'su', 'sudo', 'ps', 'top', 'kill', 'killall', 'df',
                'free', 'uptime', 'uname', 'date', 'hostname', 'history',
                'ip', 'ifconfig', 'ping', 'curl', 'apt', 'neofetch', 'tree',
                'nano', 'help', 'man', 'clear'
            ];

            const matches = allCmds.filter(c => c.startsWith(lastWord));
            if (matches.length === 1) {
                this.inputBox.value = matches[0] + ' ';
            } else if (matches.length > 1) {
                this.printLine(matches.join('   '), 'color-info');
            }
        } else {
            // Complete file or directory path
            let searchDir = this.shell.cwd;
            let prefix = lastWord;

            if (lastWord.includes('/')) {
                const slashIdx = lastWord.lastIndexOf('/');
                const dirPart = lastWord.substring(0, slashIdx);
                prefix = lastWord.substring(slashIdx + 1);
                searchDir = this.shell.vfs.resolvePath(dirPart, this.shell.cwd);
            }

            const dirNode = this.shell.vfs.getNode(searchDir);
            if (dirNode && dirNode.type === 'dir') {
                const names = Object.keys(dirNode.children).filter(n => n.startsWith(prefix));
                if (names.length === 1) {
                    const matchName = names[0];
                    const isDir = dirNode.children[matchName].type === 'dir';
                    const replacement = lastWord.substring(0, lastWord.lastIndexOf('/') + 1) + matchName + (isDir ? '/' : ' ');
                    parts[parts.length - 1] = replacement;
                    this.inputBox.value = parts.join(' ');
                } else if (names.length > 1) {
                    this.printLine(names.join('   '), 'color-info');
                }
            }
        }
    }

    escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Instantiate global terminal
window.initTerminal = function(containerId) {
    window.terminalInstance = new LinuxTerminal(containerId, window.shell);
    return window.terminalInstance;
};
