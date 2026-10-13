export function readStored(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

export function writeStored(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

export default class Leaderboard {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.maxEntries = 10;
    try {
      const data = JSON.parse(readStored('leaderboard', '[]'));
      this.scores = (Array.isArray(data) ? data : [])
        .filter(entry => entry && /^[A-Z]{1,3}$/.test(entry.name) && Number.isFinite(entry.score) && entry.score >= 0)
        .sort((a, b) => b.score - a.score).slice(0, this.maxEntries);
    } catch { this.scores = []; }
    this.initials = readStored('hamperman-initials', '');
    if (!/^[A-Z]{1,3}$/.test(this.initials)) this.initials = '';
    this.best = Math.max(Number(readStored('hamperman-best', '0')) || 0, this.scores[0]?.score || 0);
    if (!Number.isFinite(this.best)) this.best = 0;
  }

  recordBest(score) {
    const isBest = score > this.best;
    if (isBest) {
      this.best = score;
      writeStored('hamperman-best', String(score));
    }
    return isBest;
  }

  isHighScore(score) {
    return score > 0 && (this.scores.length < this.maxEntries || score > this.scores[this.scores.length - 1].score);
  }

  addScore(name, score) {
    this.scores.push({ name, score });
    this.scores.sort((a, b) => b.score - a.score);
    this.scores = this.scores.slice(0, this.maxEntries);
    this.initials = name;
    const saved = writeStored('leaderboard', JSON.stringify(this.scores));
    writeStored('hamperman-initials', name);
    return saved;
  }

  showLeaderboard() {
    this.container.replaceChildren();
    const title = document.createElement('h3');
    title.textContent = 'HIGH SCORES';
    title.title = 'Scores saved on this device';
    this.container.append(title);
    if (!this.scores.length) {
      const empty = document.createElement('p');
      empty.textContent = 'NO SCORES YET';
      this.container.append(empty);
      return;
    }
    const list = document.createElement('ol');
    for (const entry of this.scores) {
      const row = document.createElement('li');
      const name = document.createElement('span');
      const score = document.createElement('strong');
      name.textContent = entry.name;
      score.textContent = Math.round(entry.score).toLocaleString();
      row.append(name, score);
      list.append(row);
    }
    this.container.append(list);
  }

  showNameEntry(score) {
    const form = document.getElementById('name-entry-form');
    const input = document.getElementById('name-input');
    const message = document.getElementById('name-message');
    form.hidden = !this.isHighScore(score);
    input.value = this.initials;
    message.textContent = '';
    input.oninput = () => {
      input.value = input.value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 3);
      input.setCustomValidity('');
    };
    form.onsubmit = event => {
      event.preventDefault();
      const name = input.value.trim().toUpperCase();
      if (!/^[A-Z]{1,3}$/.test(name)) {
        input.setCustomValidity('Enter 1–3 letters.');
        input.reportValidity();
        return;
      }
      const saved = this.addScore(name, score);
      form.hidden = true;
      message.textContent = saved ? 'SCORE SAVED' : 'SAVED THIS SESSION ONLY';
      this.showLeaderboard();
      document.getElementById('replay-button').focus({ preventScroll: true });
    };
    document.getElementById('skip-score').onclick = () => {
      form.hidden = true;
      document.getElementById('replay-button').focus({ preventScroll: true });
    };
    this.showLeaderboard();
  }

  hide() {
    document.getElementById('name-entry-form').hidden = true;
  }
}
