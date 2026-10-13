export default class Windows {
  constructor() {
    this.overlay = document.getElementById('game-overlay');
    this.panels = [...document.querySelectorAll('.game-panel')];
    this.hint = document.getElementById('game-hint');
    this.hintRemaining = 0;
    this.puns = ['That was quite a tumble!', 'Wanna dry again?', 'Everything just unfolded!'];
    fetch('inputData/lose_puns.txt').then(response => {
      if (!response.ok) throw new Error('Puns unavailable');
      return response.text();
    }).then(text => {
      const puns = text.split(/\r?\n/).map(pun => pun.trim()).filter(Boolean);
      if (puns.length) this.puns = puns;
    }).catch(() => {});
  }

  show(name) {
    this.overlay.hidden = !name;
    this.overlay.classList.toggle('end-overlay', name === 'end');
    for (const panel of this.panels) panel.hidden = panel.id !== `${name}-panel`;
  }

  showHint(text, duration = 5) {
    this.hint.textContent = text;
    this.hintRemaining = duration;
    this.hint.hidden = false;
  }

  update(dt) {
    this.hintRemaining -= dt;
    if (this.hintRemaining <= 0) this.hint.hidden = true;
  }

  clearHint() { this.hint.hidden = true; this.hintRemaining = 0; }

  showGameOver(score, seconds, tokens, isBest) {
    document.getElementById('end-title').textContent = 'GAME OVER';
    document.getElementById('end-best').hidden = !isBest;
    document.getElementById('end-pun').textContent = this.puns[Math.floor(Math.random() * this.puns.length)];
    document.getElementById('end-score').textContent = Math.round(score).toLocaleString();
    document.getElementById('end-stats').textContent = `TIME ${Math.floor(seconds)}s / TOKENS ${tokens}`;
    document.getElementById('end-panel').classList.toggle('personal-best', isBest);
    this.show('end');
    document.getElementById('replay-button').focus({ preventScroll: true });
  }
}
