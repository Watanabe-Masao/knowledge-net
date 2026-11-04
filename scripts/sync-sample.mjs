// 画面のテストの見本（public/sample/stats2.json）は、教材の公開データ（stats2-labs の net/stats2.json）の写し（stats2-course #209）。
// 手で写したり直したりしない。テストで形を変えたいときは、そのテストの中で読み込みを書き換える（page.route）。
//   node scripts/sync-sample.mjs          写しが sample.lock.json の版の元と同じか（違えば止まる。npm run check）
//   node scripts/sync-sample.mjs --update [コミット] 公開データの main（かそのコミット）を写し、版を固定し直す（取り込んだら npm run check を通す）
import { readFileSync, writeFileSync } from "node:fs";

const LOCK = "sample.lock.json";
const REPO = "Watanabe-Masao/stats2-labs";
const SRC = "net/stats2.json";
const DST = "public/sample/stats2.json";
const raw = async (ref) => {
  const r = await fetch(`https://raw.githubusercontent.com/${REPO}/${ref}/${SRC}`);
  if (!r.ok) throw new Error(`${REPO}@${ref.slice(0, 7)} の ${SRC} を読めない（${r.status}）`);
  return r.text();
};

if (process.argv.includes("--update")) {
  let ref = process.argv[process.argv.indexOf("--update") + 1];
  if (!ref || !/^[0-9a-f]{40}$/.test(ref)) {
    const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN; // 回数の制限を避ける（なくても読める）
    const r = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, {
      headers: { "User-Agent": "knowledge-net-sync", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!r.ok) {
      console.error(`❌ ${REPO} の main を読めない（${r.status}）。コミットを渡して --update <コミット> でもよい`);
      process.exit(1);
    }
    ref = (await r.json()).sha;
  }
  writeFileSync(DST, await raw(ref));
  writeFileSync(LOCK, JSON.stringify({ repo: REPO, ref, file: SRC }, null, 1) + "\n");
  console.log(`取り込んだ：${DST}（${REPO}@${ref.slice(0, 7)}）`);
} else {
  const { ref } = JSON.parse(readFileSync(LOCK, "utf8"));
  let src;
  try {
    src = await raw(ref);
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
  if (src !== readFileSync(DST, "utf8")) {
    console.error(
      `❌ ${DST} が ${REPO}@${ref.slice(0, 7)} の ${SRC} と違う（手で直さない。node scripts/sync-sample.mjs --update で取り込む）`,
    );
    process.exit(1);
  }
  console.log(`✅ 見本（${DST}）は ${REPO}@${ref.slice(0, 7)} の公開データと同じ`);
}
