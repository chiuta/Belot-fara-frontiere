// BELOT FĂRĂ FRONTIERE 2.0.0 — masă în echipă (P2P, gazdă + până la 3 oaspeți) și reluarea mâinii.
// Rulare: node tests/fff-v2.test.mjs   (WebRTC local: Chromium cu --allow-loopback-in-peer-connection)
import {readFileSync as __rf} from 'node:fs';
const APP = JSON.parse(__rf(new URL('../app.json', import.meta.url), 'utf8'));
import {launch, axeRun, hOverflow, check, summary} from "./_lib.mjs";

const RTC = ["--allow-loopback-in-peer-connection", "--disable-features=WebRtcHideLocalIpsWithMdns"];

// ---- automatizare a unui jucător uman prin interfață (pentru gazdă și pentru oaspeți)
const act = (page) => page.evaluate(() => {
  const A = window.__BFF.App, st = A.st;
  if (!st || A.shown || (A.net && A.net.waiting)) return "wait";
  const me = (A.net && A.net.role === "guest" && A.net.ready) ? A.net.me : 0;
  if (st.turn !== me) return "idle";
  if (st.phase === "bid") { const bs = [...document.querySelectorAll("#bidpanel:not([hidden]) button.btn")], b = (document.querySelector("#bidpanel .bidrow") ? bs.find(x => /^(Pas|Dalje)/i.test(x.textContent.trim())) : null) || bs[0]; if (b) { b.click(); return "bid"; } return "nobid"; }
  if (st.phase === "play") { const c = document.querySelector("#hand .card.legal"); if (c) { c.click(); return "play"; } return "nocard"; }
  return "idle";
});
const phase = (page) => page.evaluate(() => { const st = window.__BFF.App.st; return st ? st.phase : null; });

console.log("1. pornire și joc local neschimbat");
{
  const {browser, page, st} = await launch({reducedMotion: "reduce"});
  await page.waitForTimeout(800);
  check(`versiune ${APP.version} în meta`, (await page.getAttribute('meta[name="application-version"]', "content")) === APP.version && /^2\./.test(APP.version));
  await page.evaluate(() => window.__BFF.playVariant("ro"));
  await page.waitForTimeout(300);
  check("fără masă: butonul «Masă în echipă» există", (await page.locator("#tablebtn").count()) === 1);
  check("«Reluare mână» dezactivat până la prima mână", await page.locator("#replaybtn").isDisabled());
  let guard = 0;
  while ((await phase(page)) !== "end" && guard++ < 600) { await act(page); await page.waitForTimeout(40); }
  await page.waitForSelector("#resdlg[open]", {timeout: 20000});
  check("mâna locală se termină cu dialog de rezultat", true);
  check("dialogul de rezultat are «Reluare mână»", (await page.locator("#resdlg #rp-open").count()) === 1);
  await page.click("#resdlg #rp-open");
  await page.waitForSelector("#replaydlg[open]");
  const rc = await page.evaluate(() => { const r = window.__BFF.App.recap; return {n: r.tricks.length, init: r.init.map(h => h.length), pts: r.tricks.reduce((a, t) => a + t.pts, 0)}; });
  check("reluare: 4 mâini inițiale complete și levate jucate", rc.init.every(x => x === rc.init[0]) && rc.n === rc.init[0], rc);
  const l0 = await page.textContent("#rp-live");
  check("reluare: pasul 0 arată distribuirea", /Distribuirea/.test(l0), l0);
  check("reluare: «Înapoi» dezactivat la început", await page.locator("#rp-prev").isDisabled());
  for (let i = 0; i < rc.n; i++) await page.click("#rp-next");
  const l1 = await page.textContent("#rp-live");
  check("reluare: ultimul pas e ultima levată", new RegExp(`Levata ${rc.n} din ${rc.n}`).test(l1) && /Câștigă/.test(l1), l1);
  check("reluare: la final nu mai rămân cărți", (await page.locator("#replaydlg .rprow strong").allTextContents()).every(x => /· 0 /.test(x)));
  check("reluare: «Înainte» dezactivat la final", await page.locator("#rp-next").isDisabled());
  await page.click("#rp-prev");
  check("reluare: «Înapoi» merge", new RegExp(`Levata ${rc.n - 1} din`).test(await page.textContent("#rp-live")));
  await page.click("#replaydlg .btn:has-text('Închide')");
  check("0 erori", st.errs.length === 0, st.errs);
  check("0 cereri de rețea", st.net.length === 0, st.net);
  await browser.close();
}

console.log("2. masa în echipă cu 3 oaspeți simulați (gazda validează totul)");
{
  const {browser, page, st} = await launch({reducedMotion: "reduce"});
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__BFF.playVariant("ro"));
  const out = await page.evaluate(async () => {
    const A = window.__BFF.App, B = window.__BFF.B, N = window.__BFF.net;
    const mk = () => { const hs = {}; return {sent: [], open: true, on(ev, f) { (hs[ev] = hs[ev] || []).push(f); }, off() {}, send(o) { this.sent.push(JSON.parse(JSON.stringify(o))); return true; }, close() { (hs.close || []).slice().forEach(f => f("x")); }, emit(ev, a) { (hs[ev] || []).slice().forEach(f => f(a)); }}; };
    const F = {1: mk(), 2: mk(), 3: mk()};
    const rep = {leaks: [], maxLen: 0, rej: [], log: []};
    for (const k of [1, 2, 3]) N.hostAttach(k, F[k]);
    const lastSt = (k) => { for (let i = F[k].sent.length - 1; i >= 0; i--) if (F[k].sent[i].t === "st") return F[k].sent[i]; return null; };
    const guestState = (k) => { const m = lastSt(k); if (!m) return null; const st = Object.assign(B.newState(A.cfg), m.st); st.played = Uint8Array.from(m.st.played); st.cfg = A.cfg; return st; };
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    rep.hello = [1, 2, 3].map(k => F[k].sent[0] && F[k].sent[0].t === "hello" && F[k].sent[0].seat);
    // confidențialitate: la fiecare mesaj, mâinile celorlalți sunt mascate
    const audit = () => {
      for (const k of [1, 2, 3]) for (const m of F[k].sent) {
        if (m.t !== "st") continue;
        rep.maxLen = Math.max(rep.maxLen, JSON.stringify(m).length);
        m.st.hands.forEach((h, i) => { if (i !== k && h.some(c => c !== -1)) rep.leaks.push("hands:" + k + ":" + i); });
        if (m.st.phase !== "end") (m.st.initHands || []).forEach((h, i) => { if (i !== k && h.length) rep.leaks.push("init:" + k + ":" + i); });
        if (m.st.deckRest.length) rep.leaks.push("deck:" + k);
        if (m.st.belotHolder !== k && m.st.belotHolder >= 0) rep.leaks.push("belot:" + k);
      }
    };
    // înainte de automatizare: încercări invalide
    let t0 = Date.now();
    while (!(A.st && (A.st.phase === "bid" || A.st.phase === "play")) && Date.now() - t0 < 3000) await sleep(50);
    const before = JSON.stringify([A.st.turn, A.st.trick.length, A.st.tricks.length, A.st.bid]);
    const notTurn = [1, 2, 3].filter(k => k !== A.st.turn)[0];
    F[notTurn].emit("message", {t: "bid", act: {t: "pass"}});
    F[notTurn].emit("message", {t: "play", c: 0, decl: false});
    F[notTurn].emit("message", {t: "play", c: "x"});
    F[notTurn].emit("message", {t: "bogus"});
    F[notTurn].emit("message", null);
    await sleep(100);
    rep.rej.push(F[notTurn].sent.filter(m => m.t === "rej").length);
    rep.sameAfterInvalid = before === JSON.stringify([A.st.turn, A.st.trick.length, A.st.tricks.length, A.st.bid]);
    // jucătorul de la distanță nu e mutat de AI: dacă e rândul unui oaspete, așteptăm
    const waitSeat = () => A.st.turn >= 1 && A.st.turn <= 3 ? A.st.turn : 0;
    // automatizare: oaspeții și gazda joacă prin mesaje/interfață
    const doGuests = () => {
      const st = A.st; if (!st || A.shown) return;
      if (st.phase !== "bid" && st.phase !== "play") return;
      const k = st.turn; if (k < 1 || k > 3) return;
      const gs = guestState(k); if (!gs || gs.turn !== k) return;
      if (gs.phase === "bid") { const a = B.bidActions(gs); F[k].emit("message", {t: "bid", act: (k === 1 && a.find(x => x.t !== "pass")) || a.find(x => x.t === "pass") || a[0]}); }
      else { const legal = B.legalCards(gs); if (!legal.length) return; F[k].emit("message", {t: "play", c: legal[0], decl: true}); }
    };
    const doHost = () => {
      const st = A.st; if (!st || A.shown || st.turn !== 0) return;
      if (st.phase === "bid") { const bs = [...document.querySelectorAll("#bidpanel:not([hidden]) button.btn")], b = (document.querySelector("#bidpanel .bidrow") ? bs.find(x => /^(Pas|Dalje)/i.test(x.textContent.trim())) : null) || bs[0]; if (b) b.click(); }
      else if (st.phase === "play") { const c = document.querySelector("#hand .card.legal"); if (c) c.click(); }
    };
    // verificare: dacă e rândul unui oaspete, AI-ul nu mută în locul lui timp de 1,2 s
    t0 = Date.now(); let stalled = null;
    while (Date.now() - t0 < 8000) {
      doHost();
      const st = A.st;
      if (st && (st.phase === "bid" || st.phase === "play") && !A.shown && st.turn >= 1 && stalled === null) {
        const snap = JSON.stringify([st.turn, st.trick.length, st.tricks.length, st.bid]);
        await sleep(1200);
        stalled = snap === JSON.stringify([A.st.turn, A.st.trick.length, A.st.tricks.length, A.st.bid]);
        continue;
      }
      doGuests();
      if (A.st.phase === "end") break;
      await sleep(30);
    }
    rep.stalled = stalled;
    t0 = Date.now();
    while (A.st.phase !== "end" && Date.now() - t0 < 60000) { doHost(); doGuests(); await sleep(30); }
    rep.phase = A.st.phase;
    await sleep(2500);
    audit();
    rep.resMsgs = [1, 2, 3].map(k => F[k].sent.filter(m => m.t === "res").length);
    rep.totals = [1, 2, 3].map(k => { const r = F[k].sent.filter(m => m.t === "res")[0]; return r ? r.r.total.join(",") : null; });
    rep.hostTotal = A.st.result ? A.st.result.total.join(",") : null;
    rep.recapOk = !!(A.recap && A.recap.init && A.recap.tricks.length);
    rep.resOpen = document.querySelector("#resdlg").open;
    rep.guestRecapInRes = [1, 2, 3].every(k => { const r = F[k].sent.filter(m => m.t === "res")[0]; return r && r.recap && r.recap.init.every(h => h.length > 0); });
    rep.evKinds = [...new Set(F[1].sent.filter(m => m.t === "st").flatMap(m => m.ev.map(e => e.k)))].sort().join(",");
    const cut = (k) => { const i = F[k].sent.findIndex(m => m.t === "res"); return F[k].sent.slice(0, i + 1); };
    rep.seq = {2: cut(2), 3: cut(3)};
    rep.hostTotalArr = A.st.result.total.slice();
    rep.hostTakerTeam = A.st.result.takerTeam;
    // dacă un oaspete iese, locul revine AI și jocul continuă
    document.querySelector("#nexthand").click();
    t0 = Date.now(); while (!(A.st.phase === "bid" || A.st.phase === "play") && Date.now() - t0 < 3000) await sleep(30);
    F[2].close();
    rep.seat2gone = !A.net.guests[2];
    rep.humanFlags = lastSt(1) ? lastSt(1).human.join(",") : null;
    let moves = 0; t0 = Date.now(); const startTricks = () => A.st.tricks.length * 4 + A.st.trick.length;
    const base = startTricks();
    while (A.st.phase !== "end" && Date.now() - t0 < 60000) { doHost(); doGuests(); await sleep(30); }
    rep.afterLeave = A.st.phase;
    return rep;
  });
  check("fiecare oaspete primește «hello» cu locul lui", out.hello.join() === "1,2,3", out.hello);
  check("mesaje invalide (rând greșit / carte nelegală / gunoi) nu schimbă starea", out.sameAfterInvalid, out);
  check("acțiunea din afara rândului primește «rej»", out.rej[0] >= 1, out.rej);
  check("când e rândul unui oaspete, AI-ul nu mută în locul lui", out.stalled === true, out.stalled);
  check("mâna se termină cu 3 oaspeți + gazdă", out.phase === "end", out.phase);
  check("confidențialitate: nicio mână străină, nicio pachetă rămasă, deținătorul de belot mascat", out.leaks.length === 0, out.leaks.slice(0, 5));
  check("mesaje sub 64 KB (limita p2p)", out.maxLen > 0 && out.maxLen < 60000, out.maxLen);
  check("rezultatul ajunge la toți 3 oaspeții, identic cu al gazdei", out.resMsgs.every(x => x === 1) && out.totals.every(x => x === out.hostTotal), [out.resMsgs, out.totals, out.hostTotal]);
  check("rezultatul include datele pentru reluare", out.guestRecapInRes && out.recapOk);
  check("evenimentele de joc ajung la oaspeți", /bid/.test(out.evKinds) && /play/.test(out.evKinds) && /trick/.test(out.evKinds), out.evKinds);
  check("dialogul de rezultat al gazdei e deschis", out.resOpen);
  check("oaspetele care iese lasă locul AI-ului", out.seat2gone && out.humanFlags === "true,true,false,true", [out.seat2gone, out.humanFlags]);
  check("jocul continuă fără oaspetele plecat", out.afterLeave === "end", out.afterLeave);
  check("0 erori", st.errs.length === 0, st.errs);
  check("0 cereri de rețea", st.net.length === 0, st.net);
  await browser.close();
  // redăm mesajele primite de oaspeții de pe locurile 2 (partener) și 3 pe pagini noi: perspectivă, mână, orientarea Noi/Ei
  for (const k of [2, 3]) {
    const G = await launch({reducedMotion: "reduce"});
    await G.page.waitForTimeout(500);
    await G.page.evaluate(() => { const se = {open: true, h: {}, on(e, f) { this.h[e] = f; }, off() {}, send() { return true; }, close() {}}; window.__fs = se; window.__BFF.net.guestAttach(se); });
    const msgs = out.seq[k];
    const mid = msgs.findIndex(m => m.t === "st" && m.st.phase === "play" && m.st.turn === k && !m.shown);
    await G.page.evaluate((ms) => ms.forEach(m => window.__fs.h.message(m)), msgs.slice(0, mid + 1));
    const v = await G.page.evaluate(() => { const A = window.__BFF.App, B = window.__BFF.B; return {me: A.net.me, hand: document.querySelectorAll("#hand .card").length, legal: document.querySelectorAll("#hand .card.legal").length, want: B.legalCards(A.st).length, mine: A.st.hands[A.net.me].length, label: document.querySelector("#seat0 .nm").textContent}; });
    check(`oaspete loc ${k}: își vede mâna jos (${v.mine} cărți) și doar cărțile legale sunt active`, v.me === k && v.hand === v.mine && v.legal === v.want && v.legal > 0, v);
    check(`oaspete loc ${k}: eticheta de jos este «Tu»`, /Tu/.test(v.label), v.label);
    await G.page.evaluate((ms) => ms.forEach(m => window.__fs.h.message(m)), msgs.slice(mid + 1));
    await G.page.waitForSelector("#resdlg[open]", {timeout: 10000});
    const tg = await G.page.evaluate(() => { const rows = [...document.querySelectorAll("#resbody table.res:not(.sheet) tbody tr")]; const r = rows.find(x => /^Total/i.test(x.cells[0].textContent)); return [+r.cells[1].textContent, +r.cells[2].textContent]; });
    const exp = k % 2 ? [out.hostTotalArr[1], out.hostTotalArr[0]] : out.hostTotalArr;
    check(`oaspete loc ${k}: «Noi/Ei» orientat după echipa lui`, tg[0] === exp[0] && tg[1] === exp[1], [tg, exp]);
    check(`oaspete loc ${k}: reluarea mâinii are datele complete`, await G.page.evaluate(() => { const r = window.__BFF.App.recap; return !!r && r.init.every(h => h.length > 0) && r.tricks.length === r.init[0].length; }));
    check(`oaspete loc ${k}: 0 erori`, G.st.errs.length === 0, G.st.errs);
    await G.browser.close();
  }
}

console.log("2c. aceeași masă în toate variantele (licitații diferite)");
{
  const {browser, page, st} = await launch({reducedMotion: "reduce"});
  await page.waitForTimeout(800);
  for (const v of ["fr", "coinche", "bela", "klavA", "klavR", "jass"]) {
    await page.evaluate((v) => window.__BFF.playVariant(v), v);
    const r = await page.evaluate(async (v) => {
      const A = window.__BFF.App, B = window.__BFF.B, N = window.__BFF.net, sleep = (ms) => new Promise(r => setTimeout(r, ms));
      const mk = () => { const hs = {}; return {sent: [], open: true, on(ev, f) { (hs[ev] = hs[ev] || []).push(f); }, off() {}, send(o) { this.sent.push(JSON.parse(JSON.stringify(o))); return true; }, close() { (hs.close || []).slice().forEach(f => f("x")); }, emit(ev, a) { (hs[ev] || []).slice().forEach(f => f(a)); }}; };
      const F = {1: mk(), 2: mk(), 3: mk()};
      for (const k of [1, 2, 3]) N.hostAttach(k, F[k]);
      const last = (k) => { for (let i = F[k].sent.length - 1; i >= 0; i--) if (F[k].sent[i].t === "st") return F[k].sent[i]; return null; };
      const gs = (k) => { const m = last(k); if (!m) return null; const s = Object.assign(B.newState(A.cfg), m.st); s.played = Uint8Array.from(m.st.played); s.cfg = A.cfg; return s; };
      let t0 = Date.now();
      while (A.st.phase !== "end" && Date.now() - t0 < 90000) {
        const st = A.st;
        if (st && !A.shown) {
          if (st.turn === 0) { if (st.phase === "bid") { const bs = [...document.querySelectorAll("#bidpanel:not([hidden]) button.btn")], b = (document.querySelector("#bidpanel .bidrow") ? bs.find(x => /^(Pas|Dalje)/i.test(x.textContent.trim())) : null) || bs[0]; if (b) b.click(); } else if (st.phase === "play") { const c = document.querySelector("#hand .card.legal"); if (c) c.click(); } }
          else if (st.phase === "bid" || st.phase === "play") {
            const k = st.turn, g = gs(k);
            if (g && g.turn === k) { if (g.phase === "bid") { const a = B.bidActions(g); F[k].emit("message", {t: "bid", act: (k === 1 && a.find(x => x.t !== "pass")) || a.find(x => x.t === "pass") || a[0]}); } else { const l = B.legalCards(g); if (l.length) F[k].emit("message", {t: "play", c: l[0], decl: true}); } }
          }
        }
        await sleep(25);
      }
      await sleep(1800);
      let leaks = 0;
      for (const k of [1, 2, 3]) for (const m of F[k].sent) if (m.t === "st") { m.st.hands.forEach((h, i) => { if (i !== k && h.some(c => c !== -1)) leaks++; }); if (m.st.deckRest.length) leaks++; if (m.st.belotHolder !== k && m.st.belotHolder >= 0) leaks++; }
      return {phase: A.st.phase, leaks, res: [1, 2, 3].map(k => F[k].sent.filter(m => m.t === "res").length).join(), redeal: A.st.redeal};
    }, v);
    check(`variantă ${v}: mâna se termină la masă, fără scurgeri, rezultat trimis tuturor`, (r.phase === "end" || r.phase === "redeal") && r.leaks === 0 && (r.phase === "redeal" || r.res === "1,1,1"), r);
    await page.evaluate(() => window.__BFF.net.leave());
  }
  check("0 erori", st.errs.length === 0, st.errs);
  await browser.close();
}

console.log("3. două dispozitive reale (WebRTC): gazdă + oaspete pe locul 1");
{
  const A = await launch({args: RTC, reducedMotion: "reduce"}), G = await launch({args: RTC, reducedMotion: "reduce"});
  await A.page.waitForTimeout(600); await G.page.waitForTimeout(600);
  const sup = await A.page.evaluate(() => FFF.p2p.supported());
  check("WebRTC disponibil în test", sup);
  if (sup) {
    for (const P of [A, G]) await P.page.evaluate(() => window.__BFF.playVariant("ro"));
    const D = (p, role) => p.locator("dialog.fff-p2p [data-role=" + role + "]");
    await A.page.click("#tablebtn");
    check("fereastra mesei: 3 locuri cu «Invită»", (await A.page.locator("[data-invite]").count()) === 3);
    await A.page.click('[data-invite="1"]');
    await D(A.page, "optin").check(); await D(A.page, "mode-host").click(); await D(A.page, "gen-offer").click();
    await D(A.page, "offer-out").waitFor();
    const offer = await D(A.page, "offer-out").inputValue();
    await G.page.click("#tablebtn"); await G.page.click("#tb-join");
    await D(G.page, "optin").check(); await D(G.page, "mode-join").click();
    await D(G.page, "offer-in").fill(offer); await D(G.page, "gen-answer").click();
    await D(G.page, "answer-out").waitFor();
    const answer = await D(G.page, "answer-out").inputValue();
    await D(A.page, "answer-in").fill(answer); await D(A.page, "connect").click();
    await G.page.waitForFunction(() => window.__BFF.App.net && window.__BFF.App.net.ready && window.__BFF.App.st, null, {timeout: 20000});
    check("oaspetele s-a conectat pe locul 1", (await G.page.evaluate(() => window.__BFF.App.net.me)) === 1);
    check("oaspetele nu poate schimba setările meciului", await G.page.locator("#variantsel").isDisabled() && await G.page.locator("#newbtn").isHidden());
    check("sugestia e oprită la masă (gazdă și oaspete)", await A.page.locator("#hintbtn").isDisabled() && await G.page.locator("#hintbtn").isDisabled());
    const gv = await G.page.evaluate(() => { const A = window.__BFF.App; return {mine: A.st.hands[1].filter(c => c >= 0).length, others: [0, 2, 3].map(i => A.st.hands[i].every(c => c === -1))}; });
    check("oaspetele vede doar propria mână", gv.mine > 0 && gv.others.every(Boolean), gv);
    check("cărțile oaspetelui apar în interfața lui", (await G.page.locator("#hand .card").count()) === gv.mine);
    check("gazda vede aceeași stare (aceeași mână, aceeași dată)", await (async () => {
      const a = await A.page.evaluate(() => { const s = window.__BFF.App.st; return [s.dealer, s.hands[1].join()]; });
      const g = await G.page.evaluate(() => { const s = window.__BFF.App.st; return [s.dealer, s.hands[1].join()]; });
      return a[0] === g[0] && a[1] === g[1];
    })());
    // jucăm mâna: gazda, oaspetele (prin interfață) și 2 AI
    let guard = 0, endA = false;
    while (guard++ < 1500) {
      await act(A.page); await act(G.page);
      if ((await phase(A.page)) === "end") { endA = true; break; }
      await A.page.waitForTimeout(40);
    }
    check("mâna se termină pe dispozitive reale", endA);
    await A.page.waitForSelector("#resdlg[open]", {timeout: 20000});
    await G.page.waitForSelector("#resdlg[open]", {timeout: 20000});
    const tot = async (P) => P.page.evaluate(() => { const rows = [...document.querySelectorAll("#resbody table.res:not(.sheet) tbody tr")]; const r = rows.find(x => /^Total|^Total/i.test(x.cells[0].textContent)); return r ? [r.cells[1].textContent, r.cells[2].textContent] : null; });
    const ta = await tot(A), tg = await tot(G);
    check("rezultat afișat din perspectiva fiecăruia (Noi/Ei inversat pe locul 1)", ta && tg && ta[0] === tg[1] && ta[1] === tg[0], [ta, tg]);
    const sa = await A.page.textContent("#resbody .resmsg:nth-of-type(2)").catch(() => ""), sg = await G.page.textContent("#resbody .resmsg:nth-of-type(2)").catch(() => "");
    const scA = await A.page.evaluate(() => [document.querySelector("#sc0").textContent, document.querySelector("#sc1").textContent]);
    check("oaspetele așteaptă gazda pentru mâna următoare", /Gazda începe/.test(await G.page.textContent("#resbody")) && (await G.page.locator("#nexthand").count()) === 0);
    check("reluarea mâinii funcționează și la oaspete", await (async () => {
      await G.page.click("#resdlg #rp-open"); await G.page.waitForSelector("#replaydlg[open]");
      const n = await G.page.evaluate(() => window.__BFF.App.recap.tricks.length);
      for (let i = 0; i < n; i++) await G.page.click("#rp-next");
      return new RegExp(`Levata ${n} din ${n}`).test(await G.page.textContent("#rp-live"));
    })());
    await G.page.click("#replaydlg .btn:has-text('Închide')"); await G.page.click("#resdlg .btn:has-text('Închide')");
    // gazda începe mâna următoare → oaspetele primește o stare nouă
    const noA = await A.page.evaluate(() => window.__BFF.App.match.handNo);
    await A.page.click("#nexthand");
    await G.page.waitForFunction(() => { const A = window.__BFF.App; return A.st && A.st.phase !== "end"; }, null, {timeout: 15000});
    check("mâna următoare pornește și la oaspete (dialogul de rezultat se închide)", !(await G.page.evaluate(() => document.querySelector("#resdlg").open)));
    check("scorul gazdei și al oaspetelui concordă (orientat)", await (async () => {
      const a = await A.page.evaluate(() => [document.querySelector("#sc0").textContent, document.querySelector("#sc1").textContent]);
      const g = await G.page.evaluate(() => [document.querySelector("#sc0").textContent, document.querySelector("#sc1").textContent]);
      return a[0] === g[1] && a[1] === g[0];
    })());
    // oaspetele părăsește masa
    await G.page.click("#tablebtn"); await G.page.click("#tb-leave");
    await A.page.waitForFunction(() => !window.__BFF.App.net || !window.__BFF.App.net.guests[1], null, {timeout: 15000});
    check("după plecare, gazda are locul 1 AI", true);
    check("oaspetele revine la joc local", await G.page.evaluate(() => !window.__BFF.App.net) && !(await G.page.locator("#variantsel").isDisabled()));
    check("0 erori (gazdă)", A.st.errs.length === 0, A.st.errs); check("0 erori (oaspete)", G.st.errs.length === 0, G.st.errs);
  }
  await A.browser.close(); await G.browser.close();
}

console.log("4. accesibilitate");
for (const [w, h] of [[1280, 800], [390, 780]]) {
  const {browser, page, st} = await launch({w, h, bypassCSP: true, reducedMotion: "reduce"});
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__BFF.playVariant("ro"));
  await page.waitForTimeout(300);
  await page.click("#tablebtn");
  await page.waitForSelector("#tbdlg[open]");
  const ax = await axeRun(page);
  check(`axe 0 (masa în echipă ${w}×${h})`, ax && ax.length === 0, ax);
  check(`fără depășire orizontală (${w}×${h})`, (await hOverflow(page)) <= 0);
  await page.click("#tbdlg .btn:has-text('Închide')");
  let guard = 0;
  while ((await phase(page)) !== "end" && guard++ < 600) { await act(page); await page.waitForTimeout(30); }
  await page.waitForSelector("#resdlg[open]", {timeout: 20000});
  await page.click("#resdlg #rp-open"); await page.waitForSelector("#replaydlg[open]");
  const ax2 = await axeRun(page);
  check(`axe 0 (reluarea mâinii ${w}×${h})`, ax2 && ax2.length === 0, ax2);
  check("0 erori", st.errs.length === 0, st.errs);
  await browser.close();
}
summary();
