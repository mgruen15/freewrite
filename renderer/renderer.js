class Timer {
    constructor(durationMinutes, onTick, onComplete) {
        this.durationSeconds = durationMinutes * 60;
        this.remainingSeconds = this.durationSeconds;
        this.onTick = onTick;
        this.onComplete = onComplete;
        this.interval = null;
    }

    start() {
        this.interval = setInterval(() => {
            this.remainingSeconds--;
            this.onTick(this.remainingSeconds);

            if (this.remainingSeconds <= 0) {
                this.stop();
                this.onComplete();
            }
        }, 1000);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    getFormattedTime() {
        const minutes = Math.floor(this.remainingSeconds / 60);
        const seconds = this.remainingSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    getElapsedSeconds() {
        return this.durationSeconds - this.remainingSeconds;
    }
}

class SessionManager {
    constructor() {
        this.setupScreen = document.getElementById('setup-screen');
        this.writingScreen = document.getElementById('writing-screen');
        this.endScreen = document.getElementById('end-screen');
        this.libraryScreen = document.getElementById('library-screen');
        this.statsScreen = document.getElementById('stats-screen');
        this.detailScreen = document.getElementById('detail-screen');
        
        this.sessionConfig = document.getElementById('session-config');
        
        this.timerInput = document.getElementById('timer-input');
        
        this.libraryBtn = document.getElementById('library-btn');
        this.statsBtn = document.getElementById('stats-btn');
        this.startBtn = document.getElementById('start-btn');
        this.abortBtn = document.getElementById('abort-btn');
        this.libraryBackBtn = document.getElementById('library-back-btn');
        this.statsBackBtn = document.getElementById('stats-back-btn');
        this.detailBackBtn = document.getElementById('detail-back-btn');
        this.exportBtn = document.getElementById('export-btn');
        
        this.historyList = document.getElementById('history-list');
        this.historySearch = document.getElementById('history-search');
        this.statsGrid = document.getElementById('stats-grid');
        this.detailDate = document.getElementById('detail-date');
        this.detailStats = document.getElementById('detail-stats');
        this.detailBody = document.getElementById('detail-body');
        
        this.canvas = document.getElementById('paper-canvas');
        this.timerDisplay = document.getElementById('timer-display');
        
        this.summaryTime = document.getElementById('summary-time');
        this.summaryWords = document.getElementById('summary-words');
        this.closeBtn = document.getElementById('close-btn');

        this.timer = null;
        this.sessionData = null;
        this.allHistory = [];
        this.autoSaveInterval = null;
        this.backspaceCount = 0;

        this.initEventListeners();
        this.checkRecovery();
    }

    initEventListeners() {
        // Navigation
        this.libraryBtn.addEventListener('click', () => this.showLibrary());
        this.statsBtn.addEventListener('click', () => this.showStats());
        
        this.libraryBackBtn.addEventListener('click', () => {
            this.libraryScreen.classList.add('hidden');
            this.setupScreen.classList.remove('hidden');
        });
        this.statsBackBtn.addEventListener('click', () => {
            this.statsScreen.classList.add('hidden');
            this.setupScreen.classList.remove('hidden');
        });
        this.detailBackBtn.addEventListener('click', () => {
            this.detailScreen.classList.add('hidden');
            this.libraryScreen.classList.remove('hidden');
        });

        // Search
        this.historySearch.addEventListener('input', (e) => this.handleSearch(e.target.value));

        // Export
        this.exportBtn.addEventListener('click', () => this.handleExport());

        // Session Actions
        this.startBtn.addEventListener('click', () => this.startSession());
        this.abortBtn.addEventListener('click', () => this.handleAbort());
        this.closeBtn.addEventListener('click', () => this.resetToSetup());

        // No-Backspace Logic (with 3-strike allowance)
        this.canvas.addEventListener('keydown', (e) => {
            const isUndo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z';

            if (e.key === 'Backspace') {
                this.backspaceCount++;
                if (this.backspaceCount > 3) {
                    e.preventDefault();
                    this.handleBlockedInput();
                }
                return;
            }

            if (e.key === 'Delete' || isUndo) {
                e.preventDefault();
                this.handleBlockedInput();
                return;
            }

            // Reset count if it's a character or space
            if (e.key.length === 1 || e.key === 'Enter') {
                this.backspaceCount = 0;
            }
        });
    }

    async checkRecovery() {
        const recoveredSession = await window.electronAPI.checkRecovery();
        if (recoveredSession && recoveredSession.body) {
            if (confirm('It looks like the app closed unexpectedly. Would you like to recover your last session?')) {
                this.setupScreen.classList.add('hidden');
                this.writingScreen.classList.remove('hidden');
                this.canvas.value = recoveredSession.body;
                this.backspaceCount = 0;
                
                this.sessionData = {
                    duration: recoveredSession.duration || 10,
                    startTime: new Date()
                };

                this.timer = new Timer(
                    this.sessionData.duration,
                    (seconds) => this.updateTimerUI(seconds),
                    () => this.endSession()
                );
                this.timer.start();
                this.startAutoSave();
            } else {
                await window.electronAPI.clearTemp();
            }
        }
    }

    startAutoSave() {
        this.stopAutoSave();
        this.autoSaveInterval = setInterval(async () => {
            if (this.sessionData && this.canvas.value.trim()) {
                await window.electronAPI.autoSave({
                    body: this.canvas.value,
                    duration: this.sessionData.duration,
                    timestamp: new Date().toISOString()
                });
            }
        }, 30000);
    }

    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    async handleExport() {
        try {
            const result = await window.electronAPI.exportHistory();
            if (result.success) {
                console.log('Export successful');
            }
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export history.');
        }
    }

    async showLibrary() {
        this.setupScreen.classList.add('hidden');
        this.libraryScreen.classList.remove('hidden');
        this.historySearch.value = '';
        
        this.allHistory = await window.electronAPI.getHistory();
        this.renderHistory(this.allHistory);
    }

    async showStats() {
        this.setupScreen.classList.add('hidden');
        this.statsScreen.classList.remove('hidden');
        
        const history = await window.electronAPI.getHistory();
        const stats = this.calculateStats(history);
        this.renderStats(stats);
    }

    calculateStats(history) {
        if (!history || history.length === 0) return null;

        const totalWords = history.reduce((sum, s) => sum + (s.word_count || 0), 0);
        const totalMinutes = history.reduce((sum, s) => sum + (s.duration_minutes.actual || 0), 0);
        const avgWords = Math.round(totalWords / history.length);
        const avgTime = (totalMinutes / history.length).toFixed(1);
        const longestSession = Math.max(...history.map(s => s.word_count || 0));
        
        // Words per minute (velocity)
        const wordsPerMinute = totalMinutes > 0 ? (totalWords / totalMinutes).toFixed(1) : 0;

        // Calculate Streak
        const dates = history
            .map(s => new Date(s.timestamp).toDateString())
            .filter((v, i, a) => a.indexOf(v) === i)
            .map(d => new Date(d))
            .sort((a, b) => b - a);

        let streak = 0;
        let today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let lastDate = dates[0];
        if (lastDate) {
            const diff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
            if (diff <= 1) {
                streak = 1;
                for (let i = 1; i < dates.length; i++) {
                    const dayDiff = Math.floor((dates[i-1] - dates[i]) / (1000 * 60 * 60 * 24));
                    if (dayDiff === 1) {
                        streak++;
                    } else {
                        break;
                    }
                }
            }
        }

        return {
            totalWords,
            totalSessions: history.length,
            avgWords,
            totalMinutes: Math.round(totalMinutes),
            avgTime,
            longestSession,
            streak,
            wpm: wordsPerMinute
        };
    }

    renderStats(stats) {
        this.statsGrid.innerHTML = '';
        
        if (!stats) {
            this.statsGrid.innerHTML = '<p style="text-align: center; color: #999; grid-column: 1/-1; margin-top: 40px;">Write your first session to see statistics.</p>';
            return;
        }

        const items = [
            { label: 'Current Streak', value: `${stats.streak} Days`, highlight: true },
            { label: 'Total Words Written', value: stats.totalWords.toLocaleString() },
            { label: 'Writing Time', value: `${stats.totalMinutes} Min` },
            { label: 'Daily Average', value: `${stats.avgWords} Words` },
            { label: 'Writing Velocity', value: `${stats.wpm} WPM` },
            { label: 'Sessions Completed', value: stats.totalSessions },
            { label: 'Longest Sprint', value: `${stats.longestSession} Words` }
        ];

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = `stat-card ${item.highlight ? 'highlight' : ''}`;
            card.innerHTML = `
                <span class="stat-value">${item.value}</span>
                <span class="stat-label">${item.label}</span>
            `;
            this.statsGrid.appendChild(card);
        });
    }

    handleSearch(query) {
        const lowerQuery = query.toLowerCase().trim();
        if (!lowerQuery) {
            this.renderHistory(this.allHistory);
            return;
        }

        const filtered = this.allHistory.filter(session => 
            session.body.toLowerCase().includes(lowerQuery) ||
            (session.summary && session.summary.toLowerCase().includes(lowerQuery)) ||
            (session.tags && session.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
        );
        
        this.renderHistory(filtered, true);
    }

    renderHistory(history, isSearch = false) {
        this.historyList.innerHTML = '';
        
        if (!history || history.length === 0) {
            const message = isSearch ? 'No matches found.' : 'No sessions yet.';
            this.historyList.innerHTML = `<p style="text-align: center; color: #999; margin-top: 40px;">${message}</p>`;
            return;
        }

        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        history.forEach(session => {
            const item = document.createElement('div');
            item.className = 'history-item';
            
            const date = new Date(session.timestamp).toLocaleDateString(undefined, {
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            
            item.innerHTML = `
                <div class="item-date">${date}</div>
                <div class="item-preview">${session.body.substring(0, 100)}...</div>
                <div class="item-stats">${session.word_count} words • ${session.duration_minutes.actual}m</div>
            `;
            
            item.addEventListener('click', () => this.showDetail(session));
            this.historyList.appendChild(item);
        });
    }

    showDetail(session) {
        this.libraryScreen.classList.add('hidden');
        this.detailScreen.classList.remove('hidden');
        
        const date = new Date(session.timestamp).toLocaleDateString(undefined, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        
        this.detailDate.textContent = date;
        this.detailStats.textContent = `${session.word_count} words • ${session.duration_minutes.actual}m actual • ${session.duration_minutes.planned}m planned`;
        this.detailBody.textContent = session.body;
    }

    handleAbort() {
        const wordCount = this.canvas.value.trim().split(/\s+/).filter(w => w).length;
        const message = wordCount > 0 
            ? 'Finish session early? Your writing will be preserved.' 
            : 'Abort session? Nothing has been written yet.';
            
        if (confirm(message)) {
            this.endSession();
        }
    }

    startSession() {
        const duration = parseInt(this.timerInput.value) || 10;

        this.sessionData = {
            duration,
            startTime: new Date()
        };

        this.setupScreen.classList.add('hidden');
        this.writingScreen.classList.remove('hidden');
        
        this.canvas.value = '';
        this.canvas.focus();
        this.backspaceCount = 0;

        this.timer = new Timer(
            duration,
            (seconds) => this.updateTimerUI(seconds),
            () => this.endSession()
        );
        this.updateTimerUI(duration * 60);
        this.timer.start();
        this.startAutoSave();
    }

    updateTimerUI(seconds) {
        this.timerDisplay.textContent = this.timer.getFormattedTime();
        if (seconds <= 60) {
            this.timerDisplay.classList.add('pulse');
        } else {
            this.timerDisplay.classList.remove('pulse');
        }
    }

    handleBlockedInput() {
        this.canvas.classList.add('input-blocked');
        setTimeout(() => this.canvas.classList.remove('input-blocked'), 100);
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    async endSession() {
        this.stopAutoSave();
        const elapsedSeconds = this.timer.getElapsedSeconds();
        this.timer.stop();
        
        const body = this.canvas.value;
        const wordCount = body.trim().split(/\s+/).filter(w => w).length;

        if (wordCount === 0) {
            await window.electronAPI.clearTemp();
            this.resetToSetup();
            return;
        }

        const sessionRecord = {
            id: this.generateUUID(),
            timestamp: new Date().toISOString(),
            duration_minutes: {
                planned: this.sessionData.duration,
                actual: parseFloat((elapsedSeconds / 60).toFixed(2))
            },
            word_count: wordCount,
            tags: [],
            body: body,
            themes: [],
            emotion_signal: null,
            summary: null,
            open_questions: [],
            entities: { people: [], projects: [], places: [] }
        };

        try {
            await window.electronAPI.saveSession(sessionRecord);
            await window.electronAPI.clearTemp();
            console.log('Session saved successfully');
        } catch (error) {
            console.error('Failed to save session:', error);
        }

        this.writingScreen.classList.add('hidden');
        this.endScreen.classList.remove('hidden');

        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        const timeStr = minutes > 0 
            ? `${minutes}m ${seconds}s` 
            : `${seconds} seconds`;

        this.summaryTime.textContent = timeStr;
        this.summaryWords.textContent = `${wordCount} words`;
    }

    resetToSetup() {
        this.stopAutoSave();
        if (this.timer) this.timer.stop();
        this.writingScreen.classList.add('hidden');
        this.endScreen.classList.add('hidden');
        this.setupScreen.classList.remove('hidden');
        this.sessionData = null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SessionManager();
});
