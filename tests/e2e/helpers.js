// creates a game directly in the localStorage and opens it, without going through the form
export async function openGame(page, { parti = "Les Sans-Voix", chef = "img/chef1.png", data = {}, helpSeen = true } = {}) {
  await page.goto("./index.html");
  const id = await page.evaluate(({ parti, chef, data, helpSeen }) => {
    localStorage.clear();
    if (helpSeen) localStorage.setItem("helpSeen", "1");
    const id = "test" + Math.random().toString(36).slice(2, 8);
    localStorage.setItem("parties", JSON.stringify([{ id, parti, chef, createdAt: Date.now() }]));
    Object.entries(data).forEach(([key, value]) => localStorage.setItem(`${id}:${key}`, typeof value === "string" ? value : JSON.stringify(value)));
    return id;
  }, { parti, chef, data, helpSeen });

  await page.goto(`./game.html?partie=${id}&debug`);
  await page.waitForFunction(() => window.clicker);
  return id;
}

// no horizontal scroll: the page fits the screen
export async function horizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}
