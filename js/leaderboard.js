export default class Leaderboard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scores = this.getScores();
        this.maxEntries = 10;
    }

    getScores() {
        const scores = localStorage.getItem('leaderboard');
        return scores ? JSON.parse(scores) : [];
    }

    saveScores() {
        localStorage.setItem('leaderboard', JSON.stringify(this.scores));
    }

    isHighScore(score) {
        if (this.scores.length < this.maxEntries) {
            return true;
        }
        const lowestScore = this.scores[this.scores.length - 1].score;
        return score > lowestScore;
    }

    addScore(name, score) {
        this.scores.push({ name, score });
        this.scores.sort((a, b) => b.score - a.score);
        if (this.scores.length > this.maxEntries) {
            this.scores.pop();
        }
        this.saveScores();
    }

    showLeaderboard() {
        this.container.innerHTML = this.createLeaderboardHTML();
        this.container.style.display = 'block';
    }

    hideLeaderboard() {
        this.container.style.display = 'none';
    }

    createLeaderboardHTML() {
        let html = '<h2>Leaderboard</h2><ol>';
        this.scores.forEach(entry => {
            html += `<li>${entry.name} - ${Math.round(entry.score)}</li>`;
        });
        html += '</ol>';

        return html;
    }

    showNameEntry(score, restartButton, callback) {
        restartButton.interactive = false;
        this.container.innerHTML = this.createNameEntryHTML(score);
        this.container.style.display = 'block';

        const form = document.getElementById('name-entry-form');
        const nameInput = document.getElementById('name-input');

        const handleSubmit = (e) => {
            e.preventDefault();
            const name = nameInput.value.toUpperCase();
            if (name && /^[A-Z]{1,3}$/.test(name)) {
                this.addScore(name, score);
                restartButton.interactive = true;
                callback();
            } else {
                alert('Please enter 1-3 uppercase letters.');
            }
        };

        form.addEventListener('submit', handleSubmit);

        const keydownHandler = (e) => {
            if (e.key === ' ' && document.getElementById('name-entry-form')) {
                e.preventDefault();
                handleSubmit(e);
                window.removeEventListener('keydown', keydownHandler);
            }
        };
        window.addEventListener('keydown', keydownHandler);
    }

    createNameEntryHTML(score) {
        return `
            <h2>New High Score!</h2>
            <p>Your score: ${Math.round(score)}</p>
            <form id="name-entry-form">
                <input type="text" id="name-input" placeholder="Enter your name (3 letters)" maxlength="3" pattern="[A-Z]{3}" required>
                <button type="submit">Submit</button>
            </form>
        `;
    }
}
