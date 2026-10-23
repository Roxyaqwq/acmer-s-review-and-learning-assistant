# 前端设计与美观度评估

> 初版：2026-10-20；2026-10-22 按当前代码复核重写；同日完成一轮视觉改造。
> 方法：源码静态审查 + 用桩 API 跑起来 headless 截图复核（桌面 1440、窄屏 390）。
> 范围：`frontend/src` 下全部页面与核心组件。
>
> 每个结论后面标注状态：**已做** / **未做**。行号以当前代码为准。

---

## 一、设计系统基础

shadcn/ui + Tailwind + CSS 变量，令牌集中在 `frontend/src/app/globals.css:6-46`（亮色 `:root` 6-26、暗色 `.dark` 28-46），映射在 `frontend/tailwind.config.ts`。

| 维度 | 实现 | 评价 |
| --- | --- | --- |
| 主题 | HSL 变量 + `.dark` 类切换，两套完整令牌 | 专业 |
| 主色 | 亮色 `221 83% 53%` / 暗色 `217 91% 60%` | 沉稳，贴合工具型产品 |
| 语义色 | `--destructive` 亮 `0 84% 60%` / 暗 `0 62% 50%`，另有 amber 警告色硬编码使用 | 齐全 |
| 平台色 | `.Codeforces` / `.AtCoder` / `.Luogu` / `.NowCoder` / `.LeetCode`，`globals.css:125-129` | 贴合竞技场景 |
| CF 段位 | `.cf-newbie` → `.cf-grandmaster` 七级，`globals.css:131-137` | 还原官方色 |
| 热力图 | `.heatmap-0..4` 五级绿阶，`globals.css:139-143` | 清晰 |
| 代码高亮 | `.cl-kw/.cl-type/.cl-fn/.cl-num/.cl-cmt/.cl-str/.cl-pp` 七色，`globals.css:150-156` | 完整 |
| 场景化工具类 | `.arena-grid`（66）/ `.arena-glow`（75）/ `.text-gradient`（81）/ `.card-hover`（89）/ `.rise-in`（111）/ 降级动效（116） | 本轮新增，见下 |
| 圆角 | `--radius: 0.5rem`，`lg/md/sm` 由它派生 | 一致 |
| 滚动条 | 8px 半透明 thumb，含 hover 加深 | 细节到位 |
| 字体 | 正文 sans，`font-mono` 走 JetBrains Mono → Fira Code → monospace | 只有两级，但不联网就换不了字库，见「可提升点 7」 |

---

## 二、优点（复核后仍然成立）

1. **视觉层次清晰**：Card 分区 + 彩色功能图标 + group-hover 三重反馈（border/bg/text 同时变），视线流向有序。
2. **信息密度合理**：竞技工具偏功能型，紧凑列表行 + Badge 适合扫读。
3. **竞技感点缀**：题目 ID、rating、CF handle、eyebrow 全走 `font-mono` + `tabular-nums`。
4. **响应式到位**：grid 在 `sm`/`lg` 断点换列，导航在移动端折叠成抽屉（`Navbar.tsx:241-295`）。
5. **交互反馈完整**：hover 过渡、loading 骨架、disabled 态、外链图标渐显。

---

## 三、本轮做完的部分

方向定成「竞技场 / 记分板」：等宽小写 eyebrow、细网格 + 径向辉光的 hero、每个入口一个色相、动效克制且尊重 `prefers-reduced-motion`。不引入新字体，因为构建环境不联网。

### 1. 首页 hero 从「名片」变「落地页」（★★★★★，已做）
`frontend/src/app/page.tsx` 整页重写。hero 现在是 `relative overflow-hidden rounded-2xl border border-border/80 bg-card/50`，叠两层 `aria-hidden` 装饰：`.arena-grid`（34px 细网格，径向遮罩只露左上）+ `.arena-glow`（主色与紫色两个辉光）。左列是 `algoarena / 竞技编程工作台` eyebrow + 渐变标题 + 副文案 + 两个 CTA；右列是两张实时小卡：下一场比赛（大号等宽倒计时）与今日推荐。未登录文案改成「把没做出来的题，变成下次做得出来」。

### 2. 四宫格入口区分度（★★★★★，已做）
`ENTRIES` 四项各配一个色相（补题 violet / 找题 blue / 比赛 emerald / 每日一题 amber），每项含 `tile`（图标底片）与 `blob`（右上 `blur-2xl` 光斑，`group-hover` 才亮）。卡片统一 `card-hover group h-full overflow-hidden`，`CardContent` 是 `flex h-full flex-col` + 页脚 `mt-auto`，所以四张卡的「进入 →」始终齐底线。入场用 `.rise-in` 加 60ms 阶梯。

### 3. 难度梯度一眼可见（★★★★，已做）
新增 `frontend/src/lib/rating.ts`：七档（2400 特级 / 2100 大师 / 1900 专家 / 1600 进阶 / 1400 熟练 / 1200 入门 / 未标注），每档给 `text`、`pill`、`bar` 三个类名。
新增 `frontend/src/components/ui/rating-badge.tsx`：等宽、`tabular-nums`、带边框的胶囊，`title` 与 `sr-only` 写出中文档位名，所以不只靠颜色传达难度。题目行（`app/problems/page.tsx`）与个人页的 CF 分数都改用它，`problems/page.tsx` 里原有的本地 `RATING_SCORE_COLORS` 已删。

### 4. 空状态从「告知」升级成「引导」（★★★★，已做）
新增 `frontend/src/components/ui/empty-state.tsx`：虚线框 + 圆形图标底片 + 标题 + 一句副文案 + 可选主操作。已用在比赛列表（`app/page.tsx`、`app/contests/page.tsx`）、题库（`app/problems/page.tsx`，带「清空筛选」）、补题记录（`app/review/page.tsx`，带「新建比赛」）、模板库（`app/snippets/page.tsx`，带「新建模板」）。

### 5. 看板娘切换预览（★★★，未做，理由变了）
`frontend/public/live2d/<model>/` 下只有 `.moc3` / `.model3.json` / 物理文件，纹理在子目录里且是 UV 图集，直接当缩略图会是一张错位的色块图。要做得先给每个模型生成一张站姿截图，属于美术流程，不算前端改动。

### 6. 动效克制地补上（★★★，已做）
`globals.css` 加 `@keyframes rise-in` + `.rise-in`（0.5s `cubic-bezier(0.22,1,0.36,1)`，`both`），列表与卡片用 `Math.min(i,12)*25ms` 做阶梯；`.card-hover` 提供 `-2px` 上浮与主色投影。`globals.css:116` 的 `@media (prefers-reduced-motion: reduce)` 关掉全部入场动画与位移。

### 7. 字体层级（★★，未做）
不动字库（离线构建）。折中做法是把等宽字体提成「标签语言」：所有 eyebrow 都是 `font-mono text-[11px] uppercase tracking-[0.28em]` + 一条 `bg-primary/70` 短横线（`components/ui/page-header.tsx:11`），数字统一 `tabular-nums`。真正的显示字体要等能联网构建时再引。

### 8. 顺带统一的页面骨架（新增项）
新增 `frontend/src/components/ui/page-header.tsx`，`eyebrow / title / description / actions` 四件套。首页以外的页面全部换过去：找题（`problemset`）、比赛（`schedule`）、每日一题（`daily`）、动态（`feed`）、补题记录（`review`）、模板库（`snippets`）。补题记录页原来的题型筛选是一片几十个胶囊的「墙」，现在收进一个可折叠面板，默认只露一行「按题型筛选 / 已选 N 项」，展开才铺开。

---

### 9. 看板娘不再压内容、个人主页重做（第二轮）

**看板娘**：原来 240×320 的舞台钉死在右下角，内容区是 `max-w-7xl`（1280）居中，所以只要视口不到 1808px 就一定会盖住列表右侧。现在 `Live2DMascot.tsx` 用 `OVERLAP_VIEWPORT_PX = 1280 + (STAGE_WIDTH + MARGIN_RIGHT) * 2` 判断：视口窄于它**默认折叠**成右下角一颗 44px 的 `Sparkles` 圆钮，点一下展开、右上角 `ChevronDown` 收回、`X` 彻底隐藏。选择存进 `localStorage`（`live2d.collapsed`，`null` 表示「按视口自动」），所以在宽屏上展开过之后，下次进窄屏仍会自动收起来。从导航栏挑模型等于明确「我要看」，此时强制展开。

**个人主页**：`app/profile/[id]/page.tsx` 整页重写，业务逻辑（关注/好友四态/允许查看补题/编辑资料/换绑 CF）一行没改，只换壳：

- hero 内嵌背景图（没有背景图时用 `.arena-grid` + `.arena-glow`），头像圆角方块 + `player` eyebrow + 名字 + `RatingBadge`，下面一行 `@login · handle`、签名、加入日期/粉丝/关注；操作按钮收到右上角一列。
- 四宫格统计（rating / max rating / rank / handle）在手机上自动两列。
- 新增「段位」卡：`lib/rating.ts` 里补 `ratingTierStart()` 与 `ratingNextTier()`，算出当前档位进度条与「距离「专家」还差 58 分」。
- 热力图卡头部带 `528 题 / 169 活跃天`，空数据走 `EmptyState`；主攻方向用 violet 徽章；隐私开关改成 `role="switch"` + `aria-checked`。
- 修掉一个真实布局 bug：`<lg` 时 `grid` 的隐式 `auto` 列被热力图的 `min-w-fit` 撑开，390px 视口整页横向溢出 —— 改成显式 `grid-cols-1` + 左列 `min-w-0`。

---

## 四、还差什么

- **看板娘缩略图**：仍需给每个模型生成一张站姿截图，属美术流程（见第 5 条）。
- **补题记录页仍是全站最重的一页**（617 行、比赛分组 + 表格双视图），视觉上没问题，但那是结构问题不是美观问题。
- **显示字体**：离线构建下只能继续用等宽字做「标签语言」，等能联网构建时再考虑引入一套 UI 字体。
- **登录页/回调页**（`app/auth/callback`）还是纯过渡页，没有做视觉。

---

## 五、与工程状态的边界

本文只谈视觉与信息设计。测试、CI、依赖安全、鉴权边界等工程侧状态见 `README.md` 与 `git log`，不在此重复维护，避免两处说法打架。
