// Small DOM helpers shared by the game page.

export const byId = (id) => document.getElementById(id);

// blocks appear one after the other as the game goes on, and stay visible
const revealed = new Set();

export function reveal(id) {
  if (revealed.has(id)) return;
  const element = byId(id);
  if (!element) return;
  element.style.display = "flex";
  revealed.add(id);
}

export function hideAllExceptMain() {
  revealed.clear();
  document.querySelectorAll("main article").forEach((article) => {
    article.style.display = article.id === "main-game-container" ? "" : "none";
  });
}

let toastTimeout = null;

export function showToast(message) {
  const toast = byId("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 3000);
}
