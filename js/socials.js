export default class Socials {
  constructor() {
    this.copyButton = document.getElementById('copy-score');
    this.copyButton.onclick = async () => {
      const message = `${this.text} ${this.url}`;
      try {
        await navigator.clipboard.writeText(message);
        document.getElementById('share-message').textContent = 'Score copied!';
      } catch {
        document.getElementById('share-message').textContent = message;
      }
    };

    // Phones get the system share sheet (Messages, WhatsApp, ...), which shows the link preview.
    const shareButton = document.getElementById('native-share');
    shareButton.hidden = !navigator.share;
    shareButton.onclick = () => navigator.share({ title: 'Hamperman', text: this.text, url: this.url }).catch(() => {});
  }

  endGame(score) {
    const points = Math.round(score);
    // This URL's link preview shows the score: see api/score.mjs.
    this.url = `https://laundr.io/hamperman/score/${points}`;
    this.text = `I scored ${points.toLocaleString('en-US')} in Hamperman. Can you beat it?`;
    document.getElementById('share-twitter').href =
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(this.text)}&url=${encodeURIComponent(this.url)}`;
    document.getElementById('share-facebook').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.url)}`;
    document.getElementById('share-message').textContent = '';
  }
}
