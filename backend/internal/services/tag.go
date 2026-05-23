package services

var TagTranslations = map[string]string{
	"2-sat":                "2-SAT",
	"binary search":        "二分查找",
	"bitmasks":             "位运算",
	"brute force":          "暴力枚举",
	"chinese remainder theorem": "中国剩余定理",
	"combinatorics":        "组合数学",
	"constructive algorithms": "构造",
	"data structures":      "数据结构",
	"dfs and similar":      "DFS",
	"divide and conquer":   "分治",
	"dp":                   "动态规划",
	"dsu":                  "并查集",
	"expression parsing":   "表达式解析",
	"fft":                  "FFT/NTT",
	"flows":                "网络流",
	"games":                "博弈论",
	"geometry":             "计算几何",
	"graph matchings":      "二分图匹配",
	"graphs":               "图论",
	"greedy":               "贪心",
	"hashing":              "哈希",
	"implementation":       "模拟",
	"interactive":          "交互题",
	"math":                 "数学",
	"matrices":             "矩阵",
	"meet-in-the-middle":   "折半搜索",
	"number theory":        "数论",
	"probabilities":        "概率期望",
	"schedules":            "调度",
	"shortest paths":       "最短路",
	"sortings":             "排序",
	"string suffix structures": "后缀数据结构",
	"strings":              "字符串",
	"ternary search":       "三分法",
	"trees":                "树",
	"two pointers":         "双指针",
}

var CustomTags = []string{
	"栈", "队列", "并查集", "哈希表", "堆/优先队列",
	"线段树", "树状数组", "平衡树", "Trie", "单调栈/队列", "ST表", "分块", "莫队",
	"李超线段树", "珂朵莉树(ODT)", "K-D树",
	"最短路", "最小生成树", "拓扑排序", "强连通分量", "双连通分量", "二分图匹配",
	"网络流", "最小割", "费用流", "LCA", "树上差分", "欧拉回路",
	"虚树", "点分治", "边分治", "长链剖分", "树上启发式合并(dsu)", "动态树(LCT)",
	"基环树", "树套树",
	"线性DP", "背包DP", "区间DP", "树形DP", "数位DP", "状压DP", "概率DP",
	"DP单调队列优化", "DP斜率优化", "DP四边形不等式", "DP滚动数组", "DP状态压缩",
	"轮廓线DP(插头DP)",
	"数论(素数筛/逆元)", "组合数学", "博弈论", "概率期望", "矩阵快速幂", "FFT/NTT",
	"异或线性基", "莫比乌斯反演", "二项式反演", "Min-Max容斥",
	"多项式求逆", "多项式exp/ln",
	"KMP", "扩展KMP", "Manacher", "AC自动机", "后缀数组", "后缀自动机", "字符串哈希",
	"BFS", "DFS", "双向搜索", "A*/IDA*", "记忆化搜索", "折半搜索",
	"贪心", "构造",
	"基础几何", "凸包", "半平面交", "扫描线", "辛普森积分",
	"二分/三分", "双指针", "前缀和/差分", "位运算", "交互题", "随机化",
	"模拟退火", "爬山算法",
	"离线算法", "CDQ分治", "整体二分",
	"博弈树", "SG函数",
	"带权并查集", "种类并查集",
}

func GetCustomTags() []string {
	return CustomTags
}

func TranslateTags(cfTags []string) []string {
	result := make([]string, len(cfTags))
	for i, t := range cfTags {
		if zh, ok := TagTranslations[t]; ok {
			result[i] = zh
		} else {
			result[i] = t
		}
	}
	return result
}
