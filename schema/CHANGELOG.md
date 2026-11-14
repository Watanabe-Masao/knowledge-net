# 型（kn-schema）の変更履歴

型の中の `x-revision` が改訂番号。教材は書き出す JSON に `schema_revision` を入れ、画面は自分の型より新しい改訂のデータに警告を出す。
任意の項目の追加は v1 のまま改訂番号だけ上げる。必須の項目・意味の変更は v2 にする。

| 改訂 | 日付 | 変更 |
| --- | --- | --- |
| 1 | 2026-10-29 | v1 を決定（#41）：概念・関係・導出・教材。成立条件の math／data、記号・誤解・出典、版。関係の種類8つ（relation-types.yaml） |
| 1 | 2026-10-29 | relation-types.yaml：trace を足す。変換はたどらない（型の中身は変わらないので改訂はそのまま） |
| 2 | 2026-10-29 | 概念・関係に任意の `labs`（数理ラボへの参照：id・preset・purpose・title・url）を追加。書き出しに任意の `schema_revision`（stats2-course #61・#62） |
| 3 | 2026-10-29 | 式の分解の木：`$defs.formulaNode`（記号・数・演算 eq／add／sub／mul／div／pow／neg／sqrt／abs／sum／prod／int／fn）と `formulas[].tree`。記号に `key`・`concept`・`kind`。誤解に `labs`、概念に `counterexample_labs`（stats2-course #70・#71）。どれも任意 |
| 4 | 2026-10-29 | 概念・関係に任意の `figures`（図への参照：id・url・caption。url は教材の build が作る）（stats2-course #88）。任意 |
| 5 | 2026-10-30 | ラボへの参照（labs）に任意の `kind`（tour：ラボで解説／check：ラボで確かめる）（stats2-course #90）。任意 |
| 6 | 2026-10-30 | 関係に任意の `gist`（つまり：日常の言葉で1〜2文）（stats2-course #95）。任意 |
| 7 | 2026-10-30 | 式の記号に任意の `of`（どの確率変数の記号か）と `domain`（定義域：min・max は数か同じ式の記号の key〔k ≦ n〕・minOpen・maxOpen・integer・nonzero）（stats2-course #109）。任意 |
| 8 | 2026-10-30 | 式に任意の `parts`（意味のかたまり：path・name・meaning）、概念に任意の `workspace`（式の作業台：formula・vary・over・mean）（stats2-course #110）。任意 |
| 9 | 2026-10-31 | 任意の `experiments`（実験室：問い・つなぐ概念と線・モデル・条件の範囲・前の条件と変える条件・理由・テーマ・反例の実験〔counterexamples：崩す条件と起き方。urn・streak・mix〕・次の問い・ポイント。予想の答えは書かない）（stats2-course #102）。任意 |
| 10 | 2026-10-31 | 実験室に値の表の形（`model: table`。stats2-course #119）：テーマは値・呼び名・前の重み・変えた重み・変えたことの文、反例は崩す条件と値・重みの表。`model` で二項分布（binom）と分かれる（if／then）。二項分布の形は変わらない。任意 |
| 11 | 2026-10-31 | 概念の状態に `skeleton`（骨格：定義1文と分類だけ）、概念に任意の `short`（定義1文）と `category`（分類）。骨格なら short と category が要る（stats2-course #105・P1）。任意 |
| 12 | 2026-10-31 | 単元に任意の `group`（まとまり）と `problems`（問題の id・段階の名前・問題文の始め）。学習・問題集のタブの一覧に使う。解いた記録は持たない（stats2-course #42・P5 の PR 4）。任意 |
| 13 | 2026-11-01 | 式に任意の `id`（式の ID。`F-…`。変えない・消さない）と `defined_in`（同じ式を2つの概念に出すとき、元の概念の id）。木から作る TeX と合わせ、式の検証の結果を式 ID で指す（stats2-course #118 D1・D2）。任意 |
| 14 | 2026-11-01 | 式に任意の `conditions`（記号どうしの条件：text と比べる式の木）、`unverified`（独立な見本で未検証）、`review_pending`（個別レビュー前）。画面は条件を満たさない値で計算せず、2つの印を出す（stats2-course #118 単位 C・D4）。任意 |
| 15 | 2026-11-01 | 値の表 `$defs.valueTable`。概念に任意の `table_workspace`（値の表の作業台：formula・linear・tables）。値の表の実験室に任意の `contrasts`（誤解を正す例 misconception・指標の限界を示す比較 limit：確かめる主張 claim と1〜2個の表）（stats2-course #119・#118 の反例の方針）。任意 |
| 16 | 2026-11-01 | 式の作業台（workspace）に任意の `linear`（E(aX＋b) の式の番号）。作業台の型（stats2-course #156）で、どの作業台にも変換の欄を出すため。任意 |
| 17 | 2026-11-01 | 二項分布の実験室に任意の `questions`（入口「何を確かめたい？」に並べる問い：id・form〔問いの形。今は prob＝確率の値〕・title・question・set〔n・p〕・events〔eq／ge／le と k。1〜2個〕）と `prob_scale`（確率の値の予想の目盛り）（stats2-course #161）。任意 |
| 18 | 2026-11-02 | 二項分布の実験室の `questions` の form に spread（広がり：to.n）・conv（理論と実測）を足し、prob に任意の free（学習者が結果を選ぶ）。反例の起き方に fatigue（回を追って確率が変わる：drop）（stats2-course #161）。任意 |
| 19 | 2026-11-02 | 二項分布の実験室に任意の `catalog`（テーマ体系：まとまり id・title と、その下の問い id〔教材名:概念-まとまり-番号。stats2:binom-A-01〕・title・finds〔主な発見〕・predict〔何を予想するか〕・operate〔何を操作するか〕・judge〔理解判定〕・open〔開く入口。ないものは作成中〕・concept〔主概念〕・related〔関連概念〕）。サイトの実験室のタブで概念から問いを絞る（stats2-course #163）。任意 |
| 20 | 2026-11-02 | テーマ体系の問いに任意の `retired`（使わない印。重複などで外した問い。id は残し、並べない）。主（concept）に関係（REL-…）も書ける（2つの概念のつながりが主の問い。両端の概念から引く）（stats2-course #169）。任意 |
| 21 | 2026-11-03 | テーマ体系の問いに任意の `apply`（応用の課題：考え方 kind・課題の文 task・答えの求め方 solve〔engine の solveApply の method と条件〕・答えの形 answer〔number は tol、choice は options〕・why）。答えは書かない（画面が求める）（stats2-course #171・#169 の3）。任意 |
| 22 | 2026-11-03 | 二項分布の問いの形に paths（並び・ks）・repeat（くり返し・events・sets）・mean（平均）・var（ばらつき・ps）。応用の求め方に mode・within-band・linear-sum・compare-var（stats2-course #171：作成中の A-03・C-01・D-01・D-02）。任意 |
| 23 | 2026-11-03 | 応用の課題に任意の `walk`（解き方を自分で組み立てる：課題の文の区切り segs〔key：q＝求めるもの・数〕・数の意味の選び肢 tags〔記号 sym・solve のどの値か of・正解の番号 ans・間違えたときの言葉 ng〕・意味の確かめ meaning・2段目から最後の1つ前の段 steps〔quiz か slots〕・確かめる段の言葉 check）。段の題名とまとめ・数の値・合わせる先は書かない（engine が作る）（stats2-course #181）。任意 |
| 24 | 2026-11-03 | 応用の課題の `walk` を、思考の段と操作の部品の形に置き換える（segments〔role〕・info〔word・sym・of〕・formulas〔engine の公式 ref と bind。前の公式の id で導いた値を運ぶ〕・steps〔kind：ask・unit・event・info・relate・formula・build・probe、mark・collect・choose・rowQuiz〕）。rev23 の形は教材の3問だけが使っていて、同じ PR で置き換える（stats2-course #181）。任意 |
| 25 | 2026-11-04 | 概念に任意の `gist`（つまり：日常の言葉で1〜2文）・`question`（この概念で考える問い）・`chart`（概要の図：分布の棒をその場で描く設定 kind・n・p・note。数は engine から）（stats2-course #188 R1c：概念のページを実験室と同じ質に）。任意 |
| 26 | 2026-11-04 | 関係に任意の `stages`（開いたときの段：対比は same・differ・so、変換は origin・operation・result。ほかの種類には書かない）と `chart`（開いたときの図：pair＝2つの分布〔`$defs.chartDist`：binom・hyper・poisson〕を並べた棒、normal＝二項分布に同じ平均・分散の正規分布の曲線を重ねる。数は engine から）（stats2-course #188 04）。任意 |
| 27 | 2026-11-04 | ラボへの参照（`$defs.labs`）に任意の `play`（画面が JS の部品で描く形：mode・modes・set・task・kmax・decimals・steps〔title・text・states〔段の状態。set と frames を重ねたもの〕・focus・gist・ms〕）。教材の build がラボの版から作り、予想の答えは入れない（stats2-course #188 04b・#192）。任意 |
| 28 | 2026-11-04 | 関係に任意の `question`（このつながりで考える問い。概念のページのつながりで、選ぶと最初に出る）（stats2-course #188 07c）。任意 |
| 29 | 2026-11-04 | 関係に任意の `focus`（このつながりが効く式の部品：両端の概念の式の id と、その式の parts の番号）。つながりを選ぶと、その部品を光らせる（stats2-course #188 07c）。任意 |
| 30 | 2026-11-04 | 概念の式に任意の `why`（この式でなぜその値が求まるかの段：steps〔title・text・parts＝その段で効く式の部品の番号〕と note〔前提が崩れたとき、どの段が成り立たなくなるか〕）。作業台の読み方「構造」で順に出す（stats2-course #188）。任意 |
| 31 | 2026-11-05 | 型を芯と実験室の拡張に分けた（stats2-course #211）：実験室の定義（experiment・experimentBinom・experimentTable・walkQuiz）を `kn-experiment-v1.json` へ移し、芯の `experiments` はそれを指す。中身は変わらない。`$id` を URL にした（2つのファイルを互いに指すため）。書き出しに任意の `experiment_revision`（使った拡張の改訂） |
| 32 | 2026-11-05 | 書き出しに任意の `walk_texts`（解き方の公式の文。型は実験室の拡張の `walkTexts`）（stats2-course #211）。任意 |
| 33 | 2026-11-05 | 書き出しに任意の `apply_texts`（応用の解き方の段の文。型は実験室の拡張の `applyTexts`）（stats2-course #211）。任意 |
| 34 | 2026-11-05 | 概念に任意の `icon`（語の印の SVG の URL。引用符・括弧・空白を含む URL は型で止める）、教材に任意の `pillars`（柱：id・name・categories。色は画面が順に当てる）（stats2-course #220）。任意 |
| 35 | 2026-11-05 | 教材に任意の `groups`（意味のまとまり：id〔教材名:…〕・category・name・summary。並べた順が学ぶ順）、概念に任意の `group`（まとまりの id）（stats2-course #228）。任意 |
| 36 | 2026-11-06 | 関係の種類に「種類」（□ は ■ の一種）と「材料」（□ は ■ の材料：定義の構成要素）を足す（relation-types.yaml。trace は true）。関係に任意の `axis`（比べる軸。対比だけ）。教材に任意の `relation_map_ready`（関係図の決まりで書き終えた分類の一覧）。関係図の決まり（stats2-course docs/relation-map.md・#232）。教材は移した分類で、前提（mathematical）を材料か学ぶ順（前提 learning）に分け直す。種類が増えたので、画面を先に公開してから教材が書く。任意 |
| 37 | 2026-11-07 | 教材に任意の `group_relations`（まとまりの間の関係：from・to〔まとまりの id〕・label〔矢印の言葉〕・relations〔裏付けの関係の id。1本以上〕・任意の note〔開いた直後に最初に出す1文〕）。種類は書かず、指した関係から画面が決める。関係図の全体の見え方の矢印（stats2-course #240）。任意 |
| 38 | 2026-11-08 | 概念と関係に任意の `conditions_detail`（成立条件の区分：行の文・scope〔math／data。概念だけ〕・kind〔要件・仮定・目安〕・claim〔仮定が保証すること〕・outside〔外れたときに言えなくなること〕・terms〔文に出る概念〕・目安の target〔対象の近似〕と source〔出典〕。kind のない行はデータで確かめる手掛かり）。概念に任意の `basis_formula`（基準にする定義の式の id。定義1文は導入で、区分はこの式を基準にする）（stats2-course #249 S5b）。任意 |

## 実験室の拡張（kn-experiment-v1.json）

芯とは別に改訂する（x-revision）。教材は `experiment_revision` に書き、画面は自分より新しい改訂のデータに警告を出す。拡張の中から芯の共通の部品（gid・text・valueTable など）を指す。

| 改訂 | 日付 | 変更 |
| --- | --- | --- |
| 1 | 2026-11-05 | 芯の改訂30までの実験室の定義をそのまま移した（stats2-course #211） |
| 2 | 2026-11-05 | `$defs.walkTexts`：解き方の公式の文（記号の意味・呼び名・選び肢の形・行の題と文と別の言い方）。engine は文の型の id・穴の値・別の言い方だけを返す（stats2-course #211） |
| 3 | 2026-11-05 | `$defs.applyTexts`：応用の解き方の段の文（語の名前の穴の言葉・段の題と文と別の言い方）（stats2-course #211） |
| 4 | 2026-11-10 | 芯の共通の部品（gid・gids・text・texts・valueTable）を kn-schema-v1.json から kn-schema-v2.json の同じ部品へ指し替えた（v1 の型を外すため。stats2-course #267 M7-3）。中身は変わらない |
| 5 | 2026-11-11 | `$defs.catalog`（テーマ体系）を二項分布の実験室から部品に移し、値の表の実験室（model: table）にも任意の `catalog` を置けるようにした（stats2-course #119：期待値の問いのテーマ体系）。二項分布の形は変わらない |
| 6 | 2026-11-12 | 値の表の実験室に任意の項目を2つ：テーマの `same_mean`（期待値が start と同じ別の表。重みは全部正と、何を変えたかの文）と `spread_reason`（散らばりの考察の式と段。形は `reason` と同じ）。期待値の実験室の D-01（期待値が同じ2つの表。開く先 `same-mean`）のため（stats2-course #119） |
| 7 | 2026-11-14 | 二項分布の実験室の問い（`questions[]`）の `title`・`question` を、テーマ体系（`catalog`）がない実験室だけ必須にした（if／then）。テーマ体系がある実験室では、画面の「今回の問い」は開いた問いの題（catalog の title）から出し、具体の数は予測の段の本文に出す（問いの文を1つにそろえる。渡辺さん 2026-11-13・#379）。必須を緩める変更だが、公開中の画面がすでに両方なしで動く（knowledge-net #216）ので次の版にせず改訂にした（渡辺さん 2026-11-14・stats2-course #387） |

## v2（schema/kn-schema-v2.json）

型 v2 は v1 とは別のファイルで、改訂番号は 1 から数える。設計は stats2-course の docs/schema-v2-design.md（#262）。移す順は #259（M3〜M7）。

| 改訂 | 日付 | 変更 |
| --- | --- | --- |
| 1 | 2026-11-08 | v2 を作った（stats2-course #263 M3）。`version: 2`。関係の種類を製本 ⑤ の10種類（定める・一種・特別な場合・移る・従う・推定する・導ける・同値・根拠・比べる）にし、種類ごとの必須（特別な場合の fix・移るの mode と極限の claim・従う・導ける・同値・根拠の claim・推定するの properties・比べるの axis・same・differ）を足した。移していない行は `legacy_type`（v1 の種類と v1 の決まり）。主張（`claims`：CLM-番号・種類・本文・前提と結論の主語と述語・条件の行・根拠・逆と反例・確かめの記録）と学ぶ順（`learning`：add・remove と理由）を足した。概念に姿（`forms`）・基準の定義（`basis`）・同一性（aliases・cases・heading_of・alt_definitions）・主張・data_hints、条件の行（`$defs.condition`：区分・掛かる先・主語・範囲・外れたとき・目安の中身と出典）、式に statement_kind・記号の event と omit、教材に `v2_ready` を足した。導出は statement を必須にせず、主張を指せる。v1 の形の概念の条件（math・data）も読める（未移行のあいだ） |
| 2 | 2026-11-09 | 概念の基準の定義（`basis`）に `excludes` を足した（stats2-course #86・#264）。基準の定義に名前（式の木に出る記号の概念・terms）が出るが、直接の構成要素にしないものを、製本 ⑤ の構成の「構成要素にしないもの」（言い換え・使われる場・計算の近道の式・求める結果・成り立つための条件・学ぶのに要るだけの知識・操作の対象・1つの概念の中の式・性質）のどれかと1文で書く。一種の親は関係から決まるので書かない。任意の項目 |
| 3 | 2026-11-09 | 主張（`claims`）に `labs`・`figures`・`gist` を足した。まとまりの間の関係（`course.group_relations`）は `relations` か `claims` の少なくとも1つで書けるようにした（stats2-course #289。⑤ で線にしない主張（ポアソン分布と指数分布：④-25）に、解説付きのラボ・図・まとまりの矢印を置くため。渡辺さん 2026-11-09）。任意の項目。あわせて、関係の `operation` と条件の行の `subject`（概念の id か文）を oneOf から anyOf にした（概念の id は文の形にも合うので、oneOf では id を書くと止まっていた。改訂1からの誤り） |

| 4 | 2026-11-10 | 書き出しに任意の `learning_order`（仕上がりの学ぶ順：from・to・source〔candidate：関係から求めた候補／add：学ぶ順の足す〕・via〔どこから来たか：関係・導出・学ぶ順の id〕。to は概念か定理の点〔導出〕）を足した（stats2-course #266 M6。渡辺さん 2026-11-10：候補＋足す−外すは教材の build が求め、画面は読むだけ）。外した候補は書かない。学ぶ順の足すに任意の `units`（根拠の単元。⑥ の 5 の 4）・`question`・`focus`（前提 learning の関係が持っていたものを移す）。任意の項目 |
| 5 | 2026-11-10 | v1 を読む期間を終えた（stats2-course #267 M7-3）：関係の `legacy_type`（v1 の種類）と、それに掛かる v1 の決まり（allOf の10組。中に JSON Schema の type を legacy_type に置き換えてしまった誤りがあった）を外し、関係に `type`（⑤ の種類）を必須にし、v1 の決まりにあった「axis は比べるだけ」を ⑤ の種類で書き直した。kn-schema-v1.json と relation-types.yaml の v1 の種類・premises を外した。概念の条件の v1 の形（math・data）は、まだ教材が書き出しているので残す（stats2-course #291 で外す） |
