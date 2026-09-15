/**
 * In-Terminal Nano Text Editor
 * Provides an authentic GNU nano editor experience inside the browser terminal.
 */

class NanoEditor {
    constructor() {
        this.currentPath = null;
        this.isOpen = false;
        this.container = null;
        this.textarea = null;
        this.statusEl = null;
        this.titleEl = null;
        this.initDOM();
    }

    initDOM() {
        // Create container if not exists
        let modal = document.getElementById('nano-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'nano-modal';
            modal.className = 'nano-modal-container hidden';
            modal.innerHTML = `
                <div class="nano-window">
                    <div class="nano-header">
                        <span class="nano-brand">GNU nano 7.2</span>
                        <span class="nano-filename" id="nano-filename-display">New Buffer</span>
                        <span class="nano-modified" id="nano-modified-indicator"></span>
                    </div>
                    <div class="nano-body">
                        <textarea id="nano-textarea" spellcheck="false" autocomplete="off" wrap="off"></textarea>
                    </div>
                    <div class="nano-status" id="nano-status-bar">
                        Ketik teks Anda. Tekan Ctrl+O untuk menyimpan, Ctrl+X untuk keluar.
                    </div>
                    <div class="nano-shortcuts">
                        <button class="nano-btn" id="nano-btn-save"><span class="shortcut-key">^O</span> Simpan (WriteOut)</button>
                        <button class="nano-btn" id="nano-btn-exit"><span class="shortcut-key">^X</span> Keluar (Exit)</button>
                        <button class="nano-btn" id="nano-btn-clear"><span class="shortcut-key">^K</span> Bersihkan</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        this.container = modal;
        this.textarea = document.getElementById('nano-textarea');
        this.statusEl = document.getElementById('nano-status-bar');
        this.titleEl = document.getElementById('nano-filename-display');
        this.modifiedIndicator = document.getElementById('nano-modified-indicator');

        // Events
        document.getElementById('nano-btn-save').addEventListener('click', () => this.save());
        document.getElementById('nano-btn-exit').addEventListener('click', () => this.exit());
        document.getElementById('nano-btn-clear').addEventListener('click', () => {
            this.textarea.value = '';
            this.updateModified(true);
        });

        this.textarea.addEventListener('input', () => {
            this.updateModified(true);
        });

        // Keyboard navigation (Ctrl+O, Ctrl+X, Tab)
        this.textarea.addEventListener('keydown', (e) => {
            if (e.ctrlKey && (e.key === 'o' || e.key === 'O')) {
                e.preventDefault();
                this.save();
            } else if (e.ctrlKey && (e.key === 'x' || e.key === 'X')) {
                e.preventDefault();
                this.exit();
            } else if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.textarea.selectionStart;
                const end = this.textarea.selectionEnd;
                this.textarea.value = this.textarea.value.substring(0, start) + '    ' + this.textarea.value.substring(end);
                this.textarea.selectionStart = this.textarea.selectionEnd = start + 4;
                this.updateModified(true);
            }
        });
    }

    open(absPath) {
        this.currentPath = absPath;
        this.titleEl.textContent = `File: ${absPath}`;
        this.updateModified(false);

        // Load existing content from VFS or start empty
        const fileRes = window.vfs.readFile(absPath);
        if (fileRes.success) {
            this.textarea.value = fileRes.content;
            this.statusEl.textContent = `Membaca ${fileRes.content.split('\n').length} baris dari file ${absPath}`;
        } else {
            this.textarea.value = '';
            this.statusEl.textContent = `[ File Baru: ${absPath} ]`;
        }

        this.container.classList.remove('hidden');
        this.isOpen = true;
        setTimeout(() => {
            this.textarea.focus();
        }, 100);
    }

    save() {
        if (!this.currentPath) return;
        const content = this.textarea.value;
        const res = window.vfs.writeFile(this.currentPath, content, false);
        if (res.success) {
            this.statusEl.textContent = `[ Berhasil menulis ${content.split('\n').length} baris ke '${this.currentPath}' ]`;
            this.updateModified(false);
            if (window.terminalInstance) {
                window.terminalInstance.printLine(`[nano: File '${this.currentPath}' disimpan.]`, 'color-success');
            }
            if (window.lms) {
                window.lms.checkTasks();
            }
        } else {
            this.statusEl.textContent = `[ Gagal menyimpan: ${res.error} ]`;
        }
    }

    exit() {
        this.container.classList.add('hidden');
        this.isOpen = false;
        if (window.terminalInstance) {
            window.terminalInstance.focusInput();
            window.terminalInstance.prompt();
        }
    }

    updateModified(isModified) {
        if (isModified) {
            this.modifiedIndicator.textContent = 'Modified';
        } else {
            this.modifiedIndicator.textContent = '';
        }
    }
}

// Instantiate and expose globally
window.nanoEditor = new NanoEditor();
window.openNanoEditor = (path) => window.nanoEditor.open(path);
