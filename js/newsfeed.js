// newsfeed.js — renders announcement/patch-note cards from a JSON feed.
// Ships pointed at the local data/news.json placeholder feed; swap
// FEED_URL for a real endpoint whenever one exists (e.g. your own
// changelog API) — the render logic doesn't change either way.

const FEED_URL = "./data/news.json";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  } catch (err) {
    return iso;
  }
}

export async function renderNewsfeed(container) {
  container.innerHTML = `<p class="newsfeed-loading">Memuat berita...</p>`;
  try {
    const res = await fetch(FEED_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Gagal memuat feed");
    const items = await res.json();
    if (!Array.isArray(items) || !items.length) {
      container.innerHTML = `<p class="newsfeed-empty">Belum ada berita.</p>`;
      return;
    }
    container.innerHTML = "";
    items
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach((item) => {
        const card = document.createElement("article");
        card.className = "news-card";
        card.innerHTML = `
          <div class="news-card-date">${formatDate(item.date)}</div>
          <h3 class="news-card-title">${item.title}</h3>
          <p class="news-card-summary">${item.summary}</p>
        `;
        container.appendChild(card);
      });
  } catch (err) {
    container.innerHTML = `<p class="newsfeed-empty">Berita tidak tersedia saat ini.</p>`;
  }
}
