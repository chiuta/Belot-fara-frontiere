// Belot: fișa „ro” conține 3 exemple pentru situații disputate, în RO și EN. Rulare: node tests/exemple-disputate.test.mjs
import {launch, check, summary} from "./_lib.mjs";
const {browser, page, st} = await launch({reducedMotion: "reduce"});
await page.waitForTimeout(600);
const html = await page.content();
const txt = await page.evaluate(() => document.body.innerText);
check("pagina se încarcă fără erori", st.errs.length === 0, st.errs);
const src = (await import("node:fs")).readFileSync(new URL("../index.html", import.meta.url), "utf8");
for (const k of ["Exemplu 1 (partener", "Exemplu 2 (anun", "Exemplu 3 (la jum", "Example 1 (partner", "Example 2 (equal", "Example 3 (half"]) check("sursa conține «" + k + "…»", src.includes(k));
await browser.close(); summary();
