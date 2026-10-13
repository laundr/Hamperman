export default class Socials {
  constructor() {
    this.copyButton = document.getElementById('copy-score');
    this.copyButton.onclick = async () => {
      try {
        await navigator.clipboard.writeText(this.text);
        document.getElementById('share-message').textContent = 'Score copied!';
      } catch {
        document.getElementById('share-message').textContent = this.text;
      }
    };
  }

  endGame(score) {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    this.text = `I scored ${Math.round(score)} in Hamperman's endless laundry run! Can you beat it? ${url.href}`;
    const twitter = document.getElementById('share-twitter');
    twitter.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(this.text)}`;
    document.getElementById('share-facebook').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url.href)}`;
    document.getElementById('share-message').textContent = '';
  }
}
