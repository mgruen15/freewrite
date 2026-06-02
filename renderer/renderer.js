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
        this.detailScreen = document.getElementById('detail-screen');
        
        this.sessionConfig = document.getElementById('session-config');
        
        this.timerInput = document.getElementById('timer-input');
        this.tagsInput = document.getElementById('tags-input');
        
        this.libraryBtn = document.getElementById('library-btn');
        this.startBtn = document.getElementById('start-btn');
        this.abortBtn = document.getElementById('abort-btn');
        this.libraryBackBtn = document.getElementById('library-back-btn');
        this.detailBackBtn = document.getElementById('detail-back-btn');
        
        this.historyList = document.getElementById('history-list');
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

        this.initEventListeners();
    }

    initEventListeners() {
        // Navigation
        this.libraryBtn.addEventListener('click', () => this.showLibrary());
        this.libraryBackBtn.addEventListener('click', () => {
            this.libraryScreen.classList.add('hidden');
            this.setupScreen.classList.remove('hidden');
        });
        this.detailBackBtn.addEventListener('click', () => {
            this.detailScreen.classList.add('hidden');
            this.libraryScreen.classList.remove('hidden');
        });

        // Session Actions
        this.startBtn.addEventListener('click', () => this.startSession());
        this.abortBtn.addEventListener('click', () => this.handleAbort());
        this.closeBtn.addEventListener('click', () => this.resetToSetup());

        // No-Backspace Logic
        this.canvas.addEventListener('keydown', (e) => {
            const blockedKeys = ['Backspace', 'Delete'];
            const isUndo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z';

            if (blockedKeys.includes(e.key) || isUndo) {
                e.preventDefault();
                this.handleBlockedInput();
            }
        });
    }

    async showLibrary() {
        this.setupScreen.classList.add('hidden');
        this.libraryScreen.classList.remove('hidden');
        
        const history = await window.electronAPI.getHistory();
        this.renderHistory(history);
    }

    renderHistory(history) {
        this.historyList.innerHTML = '';
        
        if (history.length === 0) {
            this.historyList.innerHTML = '<p style="text-align: center; color: #999; margin-top: 40px;">No sessions yet.</p>';
            return;
        }

        // Sort by timestamp descending
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
        if (confirm('Finish session early? Your writing will be preserved.')) {
            this.endSession();
        }
    }

    startSession() {
        const duration = parseInt(this.timerInput.value) || 10;
        const tags = this.tagsInput.value.split(',').map(t => t.trim()).filter(t => t);

        this.sessionData = {
            duration,
            tags,
            startTime: new Date()
        };

        // UI Transition
        this.setupScreen.classList.add('hidden');
        this.writingScreen.classList.remove('hidden');
        
        this.canvas.value = '';
        this.canvas.focus();

        // Timer Setup
        this.timer = new Timer(
            duration,
            (seconds) => this.updateTimerUI(seconds),
            () => this.endSession()
        );
        this.updateTimerUI(duration * 60);
        this.timer.start();
    }

    updateTimerUI(seconds) {
        this.timerDisplay.textContent = this.timer.getFormattedTime();
        
        // Wind-down phase (last 60 seconds)
        if (seconds <= 60) {
            this.timerDisplay.classList.add('pulse');
        } else {
            this.timerDisplay.classList.remove('pulse');
        }
    }

    handleBlockedInput() {
        // Soft visual/audio feedback
        this.canvas.classList.add('input-blocked');
        setTimeout(() => this.canvas.classList.remove('input-blocked'), 100);
        
        // In a real Electron app, we could use shell.beep() or a custom sound
        // For now, we'll stick to the CSS feedback
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    async endSession() {
        const elapsedSeconds = this.timer.getElapsedSeconds();
        this.timer.stop();
        
        const body = this.canvas.value;
        const wordCount = body.trim().split(/\s+/).filter(w => w).length;

        // Create structured session record
        const sessionRecord = {
            id: this.generateUUID(),
            timestamp: new Date().toISOString(),
            duration_minutes: {
                planned: this.sessionData.duration,
                actual: parseFloat((elapsedSeconds / 60).toFixed(2))
            },
            word_count: wordCount,
            tags: this.sessionData.tags,
            body: body,
            // AI fields initialized as null/empty
            themes: [],
            emotion_signal: null,
            summary: null,
            open_questions: [],
            entities: { people: [], projects: [], places: [] }
        };

        // Save to local storage
        try {
            await window.electronAPI.saveSession(sessionRecord);
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
        if (this.timer) this.timer.stop();
        this.writingScreen.classList.add('hidden');
        this.endScreen.classList.add('hidden');
        this.setupScreen.classList.remove('hidden');
        this.sessionData = null;
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new SessionManager();
});
