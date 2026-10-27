// BELOT FĂRĂ FRONTIERE: verificare prin simulare că nivelurile AI chiar diferă (N >= 50 mâini pe pereche, locuri alternate).
// Motorul (BELOT + BELOT_AI) se extrage din <script id="engine"> și rulează în Node, fără browser.
// Rulare: node tests/niveluri-sim.test.mjs [N]
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import {fileURLToPath} from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, "..", "index.html"), "utf8");
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error("script#engine lipsește");
const ctx = vm.createContext({console, Math, Date, Uint8Array, JSON, Object, Array, Number, String});
vm.runInContext(m[1] + "\nthis.__B = BELOT; this.__AI = BELOT_AI;", ctx);
const B = ctx.__B, AI = ctx.__AI;
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log("  ok   " + n); } else { fail++; console.log("FAIL " + n + (x !== undefined ? "  -> " + JSON.stringify(x) : "")); } };
const N = parseInt(process.argv[2], 10) || 60;

// o mână completă; levels = nivel pe loc (0..3); întoarce delta [echipa 0 (locurile 0,2), echipa 1 (1,3)] sau null dacă s-a dat din nou
function playHand(cfg, rng, aiRng, dealer, levels) {
  let st = B.dealHand(cfg, rng, dealer), guard = 0;
  while (st.phase !== "end" && st.phase !== "redeal" && guard++ < 400) {
    const a = AI.act(st, levels[st.turn], aiRng, {worlds: 14});
    st = a.kind === "bid" ? B.applyBid(st, a.act) : B.playCard(st, a.card, a.declare);
  }
  if (st.phase !== "end") return null;
  return st.result.delta;
}
function duel(hi, lo, n, seed) {
  const cfg = B.makeCfg("ro", {});
  const rng = B.makeRng("sim:" + seed), aiRng = B.makeRng("ai:" + seed);
  let wins = 0, losses = 0, ties = 0, margin = 0, done = 0, tries = 0;
  while (done < n && tries++ < n * 4) {
    const flip = done % 2; // alternăm echipa puternică între (0,2) și (1,3)
    const levels = flip ? [lo, hi, lo, hi] : [hi, lo, hi, lo];
    const d = playHand(cfg, rng, aiRng, done % 4, levels);
    if (!d) continue;
    done++;
    const mine = flip ? d[1] : d[0], theirs = flip ? d[0] : d[1];
    margin += mine - theirs;
    if (mine > theirs) wins++; else if (mine < theirs) losses++; else ties++;
  }
  const dec = wins + losses, z = dec ? (wins - dec / 2) / Math.sqrt(dec / 4) : 0;
  return {hi, lo, hands: done, wins, losses, ties, avgMargin: +(margin / done).toFixed(1), z: +z.toFixed(2)};
}
const t0 = Date.now();
const r20 = duel(2, 0, N, "a"), r10 = duel(1, 0, N, "b"), r21 = duel(2, 1, N, "c");
for (const r of [r20, r10, r21]) console.log(`  nivel ${r.hi} vs nivel ${r.lo}: ${r.hands} mâini, ${r.wins}-${r.losses} (egal ${r.ties}), marjă medie ${r.avgMargin} puncte/mână, z=${r.z}`);
console.log(`  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
ok(`N >= 50 mâini pe pereche`, r20.hands >= 50 && r10.hands >= 50 && r21.hands >= 50, [r20.hands, r10.hands, r21.hands]);
ok("nivel 2 bate semnificativ nivelul 0 (z >= 2.58, p < 0.01)", r20.z >= 2.58 && r20.avgMargin > 0, r20);
ok("nivel 1 bate semnificativ nivelul 0 (z >= 2.58)", r10.z >= 2.58 && r10.avgMargin > 0, r10);
ok("nivel 2 vs nivel 1: marjă medie pozitivă", r21.avgMargin > 0, r21);
console.log(`\n${pass} reușite, ${fail} eșuate`); process.exit(fail ? 1 : 0);
