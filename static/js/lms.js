/**
 * Linux LMS Controller & Gamification Engine
 * Handles guided curriculum, lab task verification, interactive quizzes, and certificates.
 */

class LMSController {
    constructor() {
        this.currentModule = null;
        this.storageKey = (window.currentUser && window.currentUser.id) 
            ? `linux_lms_student_state_u${window.currentUser.id}` 
            : 'linux_lms_student_state_v1';
        this.state = this.loadState();

        this.initUI();
        this.syncFromServer();
    }

    loadState() {
        const saved = localStorage.getItem(this.storageKey);
        let defaultName = (window.currentUser && window.currentUser.fullname) 
            ? window.currentUser.fullname 
            : 'Pelajar Linux';

        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (window.currentUser && window.currentUser.fullname) {
                    parsed.studentName = window.currentUser.fullname;
                }
                return parsed;
            } catch (e) {
                console.error('Error loading state:', e);
            }
        }
        return {
            studentName: defaultName,
            completedModules: [],
            completedTasks: [],
            quizScores: {},
            solvedChallenges: [],
            totalPoints: 0
        };
    }

    async syncFromServer() {
        if (!window.currentUser || window.currentUser.role !== 'siswa') return;
        try {
            const res = await fetch('/api/progress');
            if (res.ok) {
                const serverData = await res.json();
                let updated = false;

                // Merge completed modules
                if (serverData.completed_modules) {
                    serverData.completed_modules.forEach(m => {
                        if (!this.state.completedModules.includes(m)) {
                            this.state.completedModules.push(m);
                            updated = true;
                        }
                    });
                }

                // Merge tasks
                if (serverData.completed_tasks) {
                    serverData.completed_tasks.forEach(t => {
                        if (!this.state.completedTasks.includes(t)) {
                            this.state.completedTasks.push(t);
                            updated = true;
                        }
                    });
                }

                // Merge challenges
                if (serverData.solved_challenges) {
                    serverData.solved_challenges.forEach(c => {
                        if (!this.state.solvedChallenges.includes(c)) {
                            this.state.solvedChallenges.push(c);
                            updated = true;
                        }
                    });
                }

                // Merge quiz scores
                if (serverData.quiz_scores) {
                    for (const [k, v] of Object.entries(serverData.quiz_scores)) {
                        if (!this.state.quizScores[k] || this.state.quizScores[k] < v) {
                            this.state.quizScores[k] = v;
                            updated = true;
                        }
                    }
                }

                if (serverData.total_points && serverData.total_points > this.state.totalPoints) {
                    this.state.totalPoints = serverData.total_points;
                    updated = true;
                }

                if (updated) {
                    localStorage.setItem(this.storageKey, JSON.stringify(this.state));
                    this.updateGlobalStatsUI();
                    this.renderTasks();
                    this.updateModuleProgress();
                }
            }
        } catch (e) {
            console.warn('Sync from server failed:', e);
        }
    }

    saveState() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.state));
        this.updateGlobalStatsUI();
        this.syncToServer();
    }

    syncToServer() {
        if (!window.currentUser || window.currentUser.role !== 'siswa') return;
        fetch('/api/progress/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                completedModules: this.state.completedModules,
                completedTasks: this.state.completedTasks,
                solvedChallenges: this.state.solvedChallenges,
                quizScores: this.state.quizScores,
                totalPoints: this.state.totalPoints
            })
        }).catch(err => console.warn('Sync to server failed:', err));
    }

    initUI() {
        this.updateGlobalStatsUI();
        this.bindGlobalEvents();
    }

    bindGlobalEvents() {
        // Run in terminal buttons
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-run-cmd');
            if (btn && window.terminalInstance) {
                const cmd = btn.getAttribute('data-cmd');
                if (cmd) {
                    window.terminalInstance.runCommand(cmd);
                }
            }
        });

        // Student name update
        const nameInput = document.getElementById('student-name-input');
        if (nameInput) {
            nameInput.value = this.state.studentName || '';
            nameInput.addEventListener('change', () => {
                this.state.studentName = nameInput.value.trim() || 'Pelajar Linux';
                this.saveState();
            });
        }
    }

    setCurrentModule(moduleData) {
        this.currentModule = moduleData;
        this.renderTasks();
        this.renderQuiz();
        this.checkTasks();
        this.updateModuleProgress();
    }

    // Lab Tasks Rendering & Verification
    renderTasks() {
        const container = document.getElementById('lab-tasks-list');
        if (!container || !this.currentModule || !this.currentModule.lab_tasks) return;

        container.innerHTML = this.currentModule.lab_tasks.map((task, idx) => {
            const isCompleted = this.state.completedTasks.includes(task.id);
            const statusBadge = isCompleted 
                ? '<span class="task-badge badge-done"><i class="bi bi-check-circle-fill"></i> Selesai</span>'
                : '<span class="task-badge badge-pending"><i class="bi bi-circle"></i> Tertunda</span>';

            return `
                <div class="task-item ${isCompleted ? 'task-done' : ''}" id="task-card-${task.id}">
                    <div class="task-header">
                        <span class="task-number">${idx + 1}</span>
                        <div class="task-desc">${task.text}</div>
                        ${statusBadge}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Called after every terminal command run
    onCommandExecuted(cmdString, result) {
        this.checkTasks();
    }

    // Evaluates task status against VFS & command history
    checkTasks() {
        if (!this.currentModule || !this.currentModule.lab_tasks) return;

        let anyNewCompleted = false;

        this.currentModule.lab_tasks.forEach(task => {
            if (this.state.completedTasks.includes(task.id)) return;

            let passed = false;

            if (task.check_type === 'last_command') {
                const last = window.shell.history[window.shell.history.length - 1];
                if (last && last.trim().startsWith(task.expected)) {
                    passed = true;
                }
            } else if (task.check_type === 'command_history') {
                const found = window.shell.history.some(cmd => cmd.trim().includes(task.expected));
                if (found) passed = true;
            } else if (task.check_type === 'file_exists') {
                const node = window.vfs.getNode(task.path);
                if (node) {
                    if (task.is_dir !== undefined) {
                        passed = task.is_dir ? node.type === 'dir' : node.type === 'file';
                    } else {
                        passed = true;
                    }
                }
            } else if (task.check_type === 'file_content') {
                const node = window.vfs.getNode(task.path);
                if (node && node.type === 'file' && node.content) {
                    passed = node.content.includes(task.contains);
                }
            } else if (task.check_type === 'file_permission') {
                const node = window.vfs.getNode(task.path);
                if (node && node.type === 'file') {
                    if (task.has_exec) {
                        passed = node.mode.includes('7') || node.mode.includes('5') || node.mode.includes('1');
                    }
                }
            } else if (task.check_type === 'file_mode') {
                const node = window.vfs.getNode(task.path);
                if (node && node.type === 'file') {
                    passed = node.mode === task.expected_mode;
                }
            }

            if (passed) {
                this.state.completedTasks.push(task.id);
                anyNewCompleted = true;
                this.showToast(`Tugas Praktik Selesai! 🎉`, `Berhasil menyelesaikan: ${task.text.replace(/<[^>]*>?/gm, '')}`);
            }
        });

        if (anyNewCompleted) {
            this.saveState();
            this.renderTasks();
            this.updateModuleProgress();
        }
    }

    // Quiz Rendering & Grading
    renderQuiz() {
        const container = document.getElementById('module-quiz-container');
        if (!container || !this.currentModule || !this.currentModule.quiz) return;

        const modId = this.currentModule.id;
        const previousScore = this.state.quizScores[modId];

        let headerHtml = `
            <div class="quiz-header">
                <h3><i class="bi bi-patch-question-fill text-warning"></i> Kuis Evaluasi Modul</h3>
                <p>Jawab pertanyaan berikut untuk menguji pemahaman teori Linux Anda.</p>
                ${previousScore !== undefined ? `<div class="quiz-score-badge">Skor Sebelumnya: <strong>${previousScore}%</strong></div>` : ''}
            </div>
        `;

        let questionsHtml = this.currentModule.quiz.map((q, qIdx) => `
            <div class="quiz-card" id="quiz-card-${qIdx}">
                <div class="quiz-question">${qIdx + 1}. ${q.question}</div>
                <div class="quiz-options">
                    ${q.options.map((opt, optIdx) => `
                        <label class="quiz-option-label">
                            <input type="radio" name="quiz_q_${qIdx}" value="${optIdx}">
                            <span>${opt}</span>
                        </label>
                    `).join('')}
                </div>
                <div class="quiz-explanation hidden" id="quiz-expl-${qIdx}"></div>
            </div>
        `).join('');

        let footerHtml = `
            <div class="quiz-actions">
                <button class="btn btn-primary" id="btn-submit-quiz"><i class="bi bi-send-check"></i> Kirim Jawaban Kuis</button>
                <div id="quiz-result-summary" class="quiz-result-summary hidden"></div>
            </div>
        `;

        container.innerHTML = headerHtml + questionsHtml + footerHtml;

        document.getElementById('btn-submit-quiz')?.addEventListener('click', () => this.gradeQuiz());
    }

    gradeQuiz() {
        if (!this.currentModule || !this.currentModule.quiz) return;

        const quiz = this.currentModule.quiz;
        let correctCount = 0;
        let allAnswered = true;

        quiz.forEach((q, idx) => {
            const selected = document.querySelector(`input[name="quiz_q_${idx}"]:checked`);
            const explEl = document.getElementById(`quiz-expl-${idx}`);
            const cardEl = document.getElementById(`quiz-card-${idx}`);

            if (!selected) {
                allAnswered = false;
                return;
            }

            const chosenIdx = parseInt(selected.value, 10);
            explEl.classList.remove('hidden');

            if (chosenIdx === q.answer) {
                correctCount++;
                cardEl.classList.add('quiz-card-correct');
                cardEl.classList.remove('quiz-card-wrong');
                explEl.innerHTML = `<span class="text-success"><i class="bi bi-check-circle-fill"></i> Benar!</span> ${q.explanation}`;
            } else {
                cardEl.classList.add('quiz-card-wrong');
                cardEl.classList.remove('quiz-card-correct');
                explEl.innerHTML = `<span class="text-danger"><i class="bi bi-x-circle-fill"></i> Kurang tepat.</span> Jawaban benar: <strong>${q.options[q.answer]}</strong>.<br>${q.explanation}`;
            }
        });

        if (!allAnswered) {
            alert('Harap jawab semua pertanyaan kuis sebelum mengirim!');
            return;
        }

        const scorePercent = Math.round((correctCount / quiz.length) * 100);
        this.state.quizScores[this.currentModule.id] = scorePercent;

        const summaryEl = document.getElementById('quiz-result-summary');
        summaryEl.classList.remove('hidden');

        if (scorePercent >= 70) {
            if (!this.state.completedModules.includes(this.currentModule.id)) {
                this.state.completedModules.push(this.currentModule.id);
            }
            summaryEl.innerHTML = `
                <div class="alert alert-success">
                    <h4><i class="bi bi-trophy-fill"></i> Selamat! Anda Lulus Kuis!</h4>
                    <p>Skor Anda: <strong>${scorePercent}%</strong> (${correctCount} dari ${quiz.length} benar). Modul ini resmi terselesaikan!</p>
                    <p style="margin-top:10px; font-size:13px;"><i class="bi bi-arrow-clockwise"></i> Halaman akan dimuat ulang dalam 3 detik untuk membuka modul selanjutnya...</p>
                </div>
            `;
            this.showToast('Kuis Selesai! 🏆', `Skor Anda: ${scorePercent}%! Modul terselesaikan.`);
            
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } else {
            summaryEl.innerHTML = `
                <div class="alert alert-warning">
                    <h4><i class="bi bi-exclamation-circle-fill"></i> Perlu Latihan Lagi</h4>
                    <p>Skor Anda: <strong>${scorePercent}%</strong> (Minimal kelulusan 70%). Silakan ulangi bacaan materi dan coba lagi.</p>
                </div>
            `;
        }

        this.saveState();
        this.updateModuleProgress();
    }

    updateModuleProgress() {
        if (!this.currentModule) return;

        const totalTasks = this.currentModule.lab_tasks ? this.currentModule.lab_tasks.length : 0;
        const finishedTasks = this.currentModule.lab_tasks 
            ? this.currentModule.lab_tasks.filter(t => this.state.completedTasks.includes(t.id)).length 
            : 0;

        const hasPassedQuiz = (this.state.quizScores[this.currentModule.id] || 0) >= 70;

        const pBar = document.getElementById('module-progress-bar');
        const pText = document.getElementById('module-progress-text');

        const totalSteps = totalTasks + 1; // tasks + quiz
        const completedSteps = finishedTasks + (hasPassedQuiz ? 1 : 0);
        const percent = Math.round((completedSteps / totalSteps) * 100);

        if (pBar) pBar.style.width = `${percent}%`;
        if (pText) pText.textContent = `${percent}% Selesai`;
    }

    updateGlobalStatsUI() {
        const completedModsCount = this.state.completedModules.length;
        const totalPoints = (this.state.completedTasks.length * 20) + 
                            (this.state.solvedChallenges.length * 100) + 
                            (completedModsCount * 50);

        const modCountEl = document.getElementById('stat-completed-modules');
        const pointCountEl = document.getElementById('stat-total-points');
        const tasksCountEl = document.getElementById('stat-completed-tasks');

        if (modCountEl) modCountEl.textContent = completedModsCount;
        if (pointCountEl) pointCountEl.textContent = totalPoints;
        if (tasksCountEl) tasksCountEl.textContent = this.state.completedTasks.length;
    }

    showToast(title, message) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'toast-card';
        toast.innerHTML = `
            <div class="toast-icon"><i class="bi bi-bell-fill"></i></div>
            <div class="toast-body">
                <div class="toast-title">${title}</div>
                <div class="toast-msg">${message}</div>
            </div>
        `;

        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-show');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('toast-show');
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }
}

// Global LMS instance
window.lms = new LMSController();
