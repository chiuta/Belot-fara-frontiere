// BELOT FĂRĂ FRONTIERE 2.1.0 — explicația sugestiei AI + intrarea „Belot de Ardeal (reguli de confirmat)” în atlas.
// Rulare: node tests/explicatii-ai.test.mjs
import {launch, check, summary} from "./_lib.mjs";

const {browser, page, st} = await launch({reducedMotion: "reduce"});
await page.waitForTimeout(700);

console.log("1. AI.hintWhy exportat");
const fn = await page.evaluate(() => typeof window.BELOT_AI.hintWhy);
check("AI.hintWhy este exportat", fn === "function", fn);

console.log("2. sugestie în joc real: mesaj cu explicație");
await page.evaluate(() => window.__BFF.playVariant("ro"));
await page.waitForTimeout(300);
const act = () => page.evaluate(() => {
  const A = window.__BFF.App, s = A.st;
  if (!s || A.shown) return "wait";
  if (s.turn !== 0) return "idle";
  if (s.phase === "bid") { const bs = [...document.querySelectorAll("#bidpanel:not([hidden]) button.btn")], b = bs.find(x => /^(Pas|Dalje)/i.test(x.textContent.trim())) || bs[0]; if (b) { b.click(); return "bid"; } return "nobid"; }
  return "idle";
});
let guard = 0, ready = false;
while (guard++ < 400) {
  const s = await page.evaluate(() => { const A = window.__BFF.App; return A.st ? {ph: A.st.phase, turn: A.st.turn, trick: A.st.trick.length} : null; });
  if (s && s.ph === "play" && s.turn === 0) { ready = true; break; }
  if (s && s.ph === "end") break;
  await act(); await page.waitForTimeout(50);
}
check("s-a ajuns la o carte de jucat de către om", ready);
if (ready) {
  const info = await page.evaluate(() => {
    const A = window.__BFF.App, AI = window.BELOT_AI, B = window.__BFF.B;
    const r1 = B.makeRng(12345), r2 = B.makeRng(12345);
    const h = AI.hint(A.st, r1), w = AI.hintWhy(A.st, r2);
    return {same: h === w.card, kind: w.info.kind, scores: w.info.scores.length, worlds: w.info.worlds, sorted: w.info.scores.every((x, i, a) => i === 0 || a[i - 1].ev >= x.ev), chosenInScores: w.info.scores.some(x => x.card === w.card)};
  });
  check("hintWhy alege aceeași carte ca hint() cu același seed", info.same, info);
  check("explicația are scoruri sortate și include cartea aleasă", info.scores >= 1 && info.sorted && info.chosenInScores, info);
  await page.click("#hintbtn");
  await page.waitForFunction(() => !/Calculez|Computing/.test(document.querySelector("#status").textContent), null, {timeout: 20000});
  const msg = await page.textContent("#status");
  check("mesajul sugestiei conține explicația (lumi simulate / singura carte / levata decisă)", /lumi simulate|Singura carte legală|deja decisă|Monte-Carlo/.test(msg), msg);
  if (info.kind === "mc") check("în regim Monte-Carlo apar diferența medie și alternativele", /lumi simulate/.test(msg) && /alternative:/.test(msg) && /[+-]\d+\.\d/.test(msg), msg);
  await page.evaluate(() => window.__BFF.setLang("en"));
  await page.click("#hintbtn").catch(() => {});
  await page.waitForTimeout(1500);
  const en = await page.textContent("#status");
  check("în engleză: mesajul este tradus", /simulated worlds|only legal card|already decided|Hint/.test(en), en);
}

console.log("3. atlas: Belot de Ardeal — reguli de confirmat");
await page.evaluate(() => window.__BFF.setLang("ro"));
await page.waitForTimeout(300);
await page.click("#tab-atlas");
await page.fill("#q", "Ardeal");
await page.waitForTimeout(300);
const cards = await page.locator(".acard").allInnerTexts();
check("căutând «Ardeal» apare intrarea din atlas", cards.length === 1 && /Belot de Ardeal/.test(cards[0]), cards.map(c => c.slice(0, 60)));
check("intrarea spune explicit «reguli de confirmat» și e doar în atlas", cards.length === 1 && /reguli de confirmat/.test(cards[0]) && /Doar în atlas/.test(cards[0]) && !/Jucabil/.test(cards[0]), cards[0]);
await page.fill("#q", "");
check("0 erori de pagină/CSP și 0 cereri de rețea", st.errs.length === 0 && st.net.length === 0, [st.errs, st.net]);
await browser.close();
summary();
