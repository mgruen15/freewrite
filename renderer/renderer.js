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
}

class SessionManager {
    constructor() {
        this.setupScreen = document.getElementById('setup-screen');
        this.writingScreen = document.getElementById('writing-screen');
        this.endScreen = document.getElementById('end-screen');
        
        this.timerInput = document.getElementById('timer-input');
        this.promptInput = document.getElementById('prompt-input');
        this.tagsInput = document.getElementById('tags-input');
        this.startBtn = document.getElementById('start-btn');
        
        this.canvas = document.getElementById('paper-canvas');
        this.timerDisplay = document.getElementById('timer-display');
        this.activePrompt = document.getElementById('active-prompt');
        
        this.summaryTime = document.getElementById('summary-time');
        this.summaryWords = document.getElementById('summary-words');
        this.closeBtn = document.getElementById('close-btn');

        this.timer = null;
        this.sessionData = null;

        this.initEventListeners();
    }

    initEventListeners() {
        this.startBtn.addEventListener('click', () => this.startSession());
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

    startSession() {
        const duration = parseInt(this.timerInput.value) || 10;
        const prompt = this.promptInput.value;
        const tags = this.tagsInput.value.split(',').map(t => t.trim()).filter(t => t);

        this.sessionData = {
            duration,
            prompt,
            tags,
            startTime: new Date()
        };

        // UI Transition
        this.setupScreen.classList.add('hidden');
        this.writingScreen.classList.remove('hidden');
        
        if (prompt) {
            this.activePrompt.textContent = prompt;
            this.activePrompt.classList.remove('hidden');
        } else {
            this.activePrompt.classList.add('hidden');
        }

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

    endSession() {
        this.timer.stop();
        this.writingScreen.classList.add('hidden');
        this.endScreen.classList.remove('hidden');

        const wordCount = this.canvas.value.trim().split(/\s+/).filter(w => w).length;
        this.summaryTime.textContent = `${this.sessionData.duration} minutes`;
        this.summaryWords.textContent = `${wordCount} words`;
    }

    resetToSetup() {
        this.endScreen.classList.add('hidden');
        this.setupScreen.classList.remove('hidden');
        this.sessionData = null;
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new SessionManager();
});
