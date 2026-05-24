package handlers

import (
	"algoarena/internal/models"
	"algoarena/internal/utils"
	"database/sql"
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/jmoiron/sqlx"
)

type SnippetHandler struct {
	DB *sqlx.DB
}

var builtinTemplates = []models.SnippetCreate{
	{Name: "快速幂", Language: "cpp", Category: "数学", Description: "二分快速幂，支持取模运算，O(log n)时间复杂度",
		Code: "using ll = long long;\n\nll qpow(ll a, ll b, ll mod) {\n    ll res = 1;\n    while (b) {\n        if (b & 1) res = res * a % mod;\n        a = a * a % mod;\n        b >>= 1;\n    }\n    return res;\n}"},
	{Name: "线段树（区间求和+懒标记）", Language: "cpp", Category: "数据结构", Description: "支持区间修改和区间查询的线段树模板，带懒标记，O(log n)",
		Code: "using ll = long long;\nconst int N = 100005;\nll tr[N << 2], tag[N << 2];\n\nvoid pushup(int p) { tr[p] = tr[p << 1] + tr[p << 1 | 1]; }\n\nvoid apply(int p, int l, int r, ll v) {\n    tr[p] += (r - l + 1) * v;\n    tag[p] += v;\n}\n\nvoid pushdown(int p, int l, int r) {\n    if (tag[p]) {\n        int mid = (l + r) >> 1;\n        apply(p << 1, l, mid, tag[p]);\n        apply(p << 1 | 1, mid + 1, r, tag[p]);\n        tag[p] = 0;\n    }\n}\n\nvoid build(int p, int l, int r, const vector<ll>& a) {\n    if (l == r) { tr[p] = a[l]; return; }\n    int mid = (l + r) >> 1;\n    build(p << 1, l, mid, a);\n    build(p << 1 | 1, mid + 1, r, a);\n    pushup(p);\n}\n\nvoid update(int p, int l, int r, int ql, int qr, ll v) {\n    if (ql <= l && r <= qr) { apply(p, l, r, v); return; }\n    pushdown(p, l, r);\n    int mid = (l + r) >> 1;\n    if (ql <= mid) update(p << 1, l, mid, ql, qr, v);\n    if (qr > mid) update(p << 1 | 1, mid + 1, r, ql, qr, v);\n    pushup(p);\n}\n\nll query(int p, int l, int r, int ql, int qr) {\n    if (ql <= l && r <= qr) return tr[p];\n    pushdown(p, l, r);\n    int mid = (l + r) >> 1;\n    ll res = 0;\n    if (ql <= mid) res += query(p << 1, l, mid, ql, qr);\n    if (qr > mid) res += query(p << 1 | 1, mid + 1, r, ql, qr);\n    return res;\n}"},
	{Name: "树状数组（Fenwick Tree）", Language: "cpp", Category: "数据结构", Description: "点更新区间查询的树状数组，代码简洁常熟小，O(log n)",
		Code: "template<typename T>\nstruct Fenwick {\n    int n;\n    vector<T> tr;\n    Fenwick(int n) : n(n), tr(n + 1) {}\n    void add(int x, T v) { for (; x <= n; x += x & -x) tr[x] += v; }\n    T sum(int x) { T r = 0; for (; x; x -= x & -x) r += tr[x]; return r; }\n    T range(int l, int r) { return sum(r) - sum(l - 1); }\n};"},
	{Name: "并查集（DSU）", Language: "cpp", Category: "数据结构", Description: "带路径压缩和按秩合并的并查集，近似 O(1) 操作",
		Code: "struct DSU {\n    vector<int> fa, sz;\n    DSU(int n) : fa(n + 1), sz(n + 1, 1) {\n        iota(fa.begin(), fa.end(), 0);\n    }\n    int find(int x) { return fa[x] == x ? x : fa[x] = find(fa[x]); }\n    bool merge(int x, int y) {\n        x = find(x), y = find(y);\n        if (x == y) return false;\n        if (sz[x] < sz[y]) swap(x, y);\n        fa[y] = x, sz[x] += sz[y];\n        return true;\n    }\n    bool same(int x, int y) { return find(x) == find(y); }\n};"},
	{Name: "线性筛（欧拉筛）", Language: "cpp", Category: "数学", Description: "O(n) 素数筛，同时计算最小质因子",
		Code: "const int N = 10000005;\nint primes[N], cnt;\nbool st[N];\nint minp[N]; // 最小质因子\n\nvoid sieve(int n) {\n    for (int i = 2; i <= n; i++) {\n        if (!st[i]) { primes[cnt++] = i; minp[i] = i; }\n        for (int j = 0; primes[j] <= n / i; j++) {\n            st[i * primes[j]] = true;\n            minp[i * primes[j]] = primes[j];\n            if (i % primes[j] == 0) break;\n        }\n    }\n}"},
	{Name: "KMP 字符串匹配", Language: "cpp", Category: "字符串", Description: "Knuth-Morris-Pratt 模式匹配，O(n+m) 预处理和匹配",
		Code: "vector<int> kmp(const string& s) {\n    int n = s.size();\n    vector<int> pi(n);\n    for (int i = 1; i < n; i++) {\n        int j = pi[i - 1];\n        while (j && s[i] != s[j]) j = pi[j - 1];\n        if (s[i] == s[j]) j++;\n        pi[i] = j;\n    }\n    return pi;\n}\n\n// 返回 t 中所有匹配 s 的起始位置\nvector<int> match(const string& s, const string& t) {\n    vector<int> pi = kmp(s), res;\n    for (int i = 0, j = 0; i < t.size(); i++) {\n        while (j && t[i] != s[j]) j = pi[j - 1];\n        if (t[i] == s[j]) j++;\n        if (j == s.size()) { res.push_back(i - j + 1); j = pi[j - 1]; }\n    }\n    return res;\n}"},
	{Name: "Dijkstra 最短路", Language: "cpp", Category: "图论", Description: "堆优化的 Dijkstra 单源最短路，O((V+E)log V)",
		Code: "using ll = long long;\nconst ll INF = 1e18;\n\nvector<ll> dijkstra(int n, const vector<vector<pair<int, ll>>>& g, int s) {\n    vector<ll> dist(n + 1, INF);\n    priority_queue<pair<ll, int>, vector<pair<ll, int>>, greater<>> pq;\n    dist[s] = 0;\n    pq.push({0, s});\n    while (!pq.empty()) {\n        auto [d, u] = pq.top(); pq.pop();\n        if (d != dist[u]) continue;\n        for (auto [v, w] : g[u]) {\n            if (dist[v] > d + w) {\n                dist[v] = d + w;\n                pq.push({dist[v], v});\n            }\n        }\n    }\n    return dist;\n}"},
	{Name: "扩展欧几里得 & 逆元", Language: "cpp", Category: "数学", Description: "求解 ax+by=gcd(a,b)，以及求模逆元",
		Code: "using ll = long long;\n\nll exgcd(ll a, ll b, ll& x, ll& y) {\n    if (!b) { x = 1; y = 0; return a; }\n    ll d = exgcd(b, a % b, y, x);\n    y -= a / b * x;\n    return d;\n}\n\nll inv(ll a, ll mod) {\n    ll x, y;\n    exgcd(a, mod, x, y);\n    return (x % mod + mod) % mod;\n}"},
	{Name: "组合数（预处理阶乘）", Language: "cpp", Category: "数学", Description: "O(n) 预处理阶乘与逆元，O(1) 查询组合数取模",
		Code: "using ll = long long;\nconst int MOD = 1e9 + 7;\nconst int N = 200005;\nll fac[N], ifac[N];\n\nll qpow(ll a, ll b) {\n    ll res = 1;\n    while (b) {\n        if (b & 1) res = res * a % MOD;\n        a = a * a % MOD;\n        b >>= 1;\n    }\n    return res;\n}\n\nvoid init(int n) {\n    fac[0] = 1;\n    for (int i = 1; i <= n; i++) fac[i] = fac[i - 1] * i % MOD;\n    ifac[n] = qpow(fac[n], MOD - 2);\n    for (int i = n - 1; i >= 0; i--) ifac[i] = ifac[i + 1] * (i + 1) % MOD;\n}\n\nll C(int n, int m) {\n    if (m < 0 || m > n) return 0;\n    return fac[n] * ifac[m] % MOD * ifac[n - m] % MOD;\n}"},
	{Name: "Trie 字典树", Language: "cpp", Category: "字符串", Description: "26 个小写字母的 Trie，支持插入和查询前缀",
		Code: "struct Trie {\n    static const int CHARS = 26;\n    struct Node { int ch[CHARS]; int cnt; };\n    vector<Node> tr;\n    Trie() : tr(1) {}\n    void insert(const string& s) {\n        int p = 0;\n        for (char c : s) {\n            int x = c - 'a';\n            if (!tr[p].ch[x]) tr[p].ch[x] = tr.size(), tr.emplace_back();\n            p = tr[p].ch[x];\n            tr[p].cnt++;\n        }\n    }\n    int query(const string& s) {\n        int p = 0;\n        for (char c : s) {\n            int x = c - 'a';\n            if (!tr[p].ch[x]) return 0;\n            p = tr[p].ch[x];\n        }\n        return tr[p].cnt;\n    }\n};"},
}

func (h *SnippetHandler) seedBuiltins() error {
	var count int
	h.DB.Get(&count, "SELECT COUNT(*) FROM snippets WHERE is_builtin = TRUE")
	if count > 0 {
		return nil
	}
	for _, t := range builtinTemplates {
		_, err := h.DB.Exec(
			`INSERT INTO snippets (name, language, code, category, description, is_builtin) VALUES ($1, $2, $3, $4, $5, TRUE)`,
			t.Name, t.Language, t.Code, t.Category, t.Description,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func (h *SnippetHandler) List(c *fiber.Ctx) error {
	category := c.Query("category")
	language := c.Query("language")

	h.seedBuiltins()

	sql := `SELECT * FROM snippets WHERE (user_id IS NULL OR user_id = $1)`
	args := []interface{}{c.Locals("user_id").(string)}
	argIdx := 2

	if category != "" {
		sql += " AND category = $" + fmt.Sprintf("%d", argIdx)
		args = append(args, category)
		argIdx++
	}
	if language != "" {
		sql += " AND language = $" + fmt.Sprintf("%d", argIdx)
		args = append(args, language)
		argIdx++
	}

	sql += " ORDER BY is_builtin DESC, category, name"

	var snippets []models.Snippet
	err := h.DB.Select(&snippets, sql, args...)
	if err != nil {
		return utils.Error(c, 500, "查询失败")
	}
	return utils.Success(c, snippets)
}

func (h *SnippetHandler) Get(c *fiber.Ctx) error {
	id := c.Params("id")
	var snippet models.Snippet
	err := h.DB.Get(&snippet, "SELECT * FROM snippets WHERE id = $1", id)
	if err != nil {
		if err == sql.ErrNoRows {
			return utils.Error(c, 404, "模板不存在")
		}
		return utils.Error(c, 500, "查询失败")
	}
	return utils.Success(c, snippet)
}

func (h *SnippetHandler) Create(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	var body models.SnippetCreate
	if err := c.BodyParser(&body); err != nil {
		return utils.Error(c, 400, "请求格式错误")
	}
	if body.Name == "" || body.Code == "" {
		return utils.Error(c, 400, "名称和代码不能为空")
	}
	if body.Language == "" {
		body.Language = "cpp"
	}
	if body.Category == "" {
		body.Category = "通用"
	}

	var snippet models.Snippet
	err := h.DB.Get(&snippet,
		`INSERT INTO snippets (user_id, name, language, code, category, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
		uid, body.Name, body.Language, body.Code, body.Category, body.Description,
	)
	if err != nil {
		return utils.Error(c, 500, "创建失败")
	}
	return utils.Success(c, snippet)
}

func (h *SnippetHandler) Update(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	id := c.Params("id")

	var existing models.Snippet
	err := h.DB.Get(&existing, "SELECT * FROM snippets WHERE id = $1", id)
	if err != nil {
		return utils.Error(c, 404, "模板不存在")
	}
	if existing.IsBuiltin || (existing.UserID != nil && *existing.UserID != uid) {
		existing.UserID = nil
		return utils.Error(c, 403, "不能修改系统模板")
	}

	var body models.SnippetUpdate
	if err := c.BodyParser(&body); err != nil {
		return utils.Error(c, 400, "请求格式错误")
	}

	sql := "UPDATE snippets SET updated_at = NOW()"
	args := []interface{}{}
	argIdx := 1

	if body.Name != nil {
		sql += ", name = $" + fmt.Sprintf("%d", argIdx)
		args = append(args, *body.Name)
		argIdx++
	}
	if body.Language != nil {
		sql += ", language = $" + fmt.Sprintf("%d", argIdx)
		args = append(args, *body.Language)
		argIdx++
	}
	if body.Code != nil {
		sql += ", code = $" + fmt.Sprintf("%d", argIdx)
		args = append(args, *body.Code)
		argIdx++
	}
	if body.Category != nil {
		sql += ", category = $" + fmt.Sprintf("%d", argIdx)
		args = append(args, *body.Category)
		argIdx++
	}
	if body.Description != nil {
		sql += ", description = $" + fmt.Sprintf("%d", argIdx)
		args = append(args, *body.Description)
		argIdx++
	}

	sql += " WHERE id = $" + fmt.Sprintf("%d", argIdx) + " RETURNING *"
	args = append(args, id)

	var updated models.Snippet
	err = h.DB.Get(&updated, sql, args...)
	if err != nil {
		return utils.Error(c, 500, "更新失败")
	}
	return utils.Success(c, updated)
}

func (h *SnippetHandler) Delete(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	id := c.Params("id")

	var existing models.Snippet
	err := h.DB.Get(&existing, "SELECT * FROM snippets WHERE id = $1", id)
	if err != nil {
		return utils.Error(c, 404, "模板不存在")
	}
	if existing.IsBuiltin {
		return utils.Error(c, 403, "不能删除系统模板")
	}

	result, err := h.DB.Exec("DELETE FROM snippets WHERE id = $1 AND user_id = $2", id, uid)
	if err != nil {
		return utils.Error(c, 500, "删除失败")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return utils.Error(c, 404, "模板不存在")
	}
	return utils.Success(c, nil)
}
