package handlers

import (
	"fmt"

	"algoarena/internal/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/jmoiron/sqlx"
)

type SocialHandler struct{ DB *sqlx.DB }

// Follow — POST /social/follow/:id
// Creates a unidirectional following relationship.
func (h *SocialHandler) Follow(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	targetID := c.Params("id")

	if uid == targetID {
		return utils.Error(c, 400, "不能关注自己")
	}

	_, err := h.DB.Exec(`
		INSERT INTO relationships (user_id, target_id, type) VALUES ($1, $2, 'following')
		ON CONFLICT DO NOTHING
	`, uid, targetID)
	if err != nil {
		return utils.Error(c, 500, "关注失败")
	}
	return utils.Success(c, nil)
}

// Unfollow — DELETE /social/follow/:id
// Removes a following relationship. Does not affect friend status.
func (h *SocialHandler) Unfollow(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	targetID := c.Params("id")

	_, err := h.DB.Exec(`
		DELETE FROM relationships WHERE user_id = $1 AND target_id = $2 AND type = 'following'
	`, uid, targetID)
	if err != nil {
		return utils.Error(c, 500, "取消关注失败")
	}
	return utils.Success(c, nil)
}

// Followers — GET /social/:id/followers
// Returns users who follow or are friends with the target user.
func (h *SocialHandler) Followers(c *fiber.Ctx) error {
	id := c.Params("id")

	type UserInfo struct {
		ID        string  `json:"id" db:"id"`
		Nickname  *string `json:"nickname" db:"nickname"`
		CFHandle  *string `json:"cf_handle" db:"cf_handle"`
		CFRating  int     `json:"cf_rating" db:"cf_rating"`
		AvatarURL string  `json:"avatar_url" db:"avatar_url"`
	}

	var list []UserInfo
	err := h.DB.Select(&list, `
		SELECT u.id, u.nickname, u.cf_handle, u.cf_rating, u.avatar_url
		FROM relationships r JOIN users u ON r.user_id = u.id
		WHERE r.target_id = $1 AND r.type IN ('following', 'friend')
		ORDER BY r.created_at DESC
	`, id)
	if err != nil {
		return utils.Error(c, 500, "查询失败")
	}
	if list == nil {
		list = []UserInfo{}
	}
	return utils.Success(c, list)
}

// Following — GET /social/:id/following
// Returns users that the target user follows or is friends with.
func (h *SocialHandler) Following(c *fiber.Ctx) error {
	id := c.Params("id")

	type UserInfo struct {
		ID        string  `json:"id" db:"id"`
		Nickname  *string `json:"nickname" db:"nickname"`
		CFHandle  *string `json:"cf_handle" db:"cf_handle"`
		CFRating  int     `json:"cf_rating" db:"cf_rating"`
		AvatarURL string  `json:"avatar_url" db:"avatar_url"`
	}

	var list []UserInfo
	err := h.DB.Select(&list, `
		SELECT u.id, u.nickname, u.cf_handle, u.cf_rating, u.avatar_url
		FROM relationships r JOIN users u ON r.target_id = u.id
		WHERE r.user_id = $1 AND r.type IN ('following', 'friend')
		ORDER BY r.created_at DESC
	`, id)
	if err != nil {
		return utils.Error(c, 500, "查询失败")
	}
	if list == nil {
		list = []UserInfo{}
	}
	return utils.Success(c, list)
}

// GetRelationshipStatus — GET /social/status/:id
// Returns the full relationship status between current user and target.
func (h *SocialHandler) GetRelationshipStatus(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	targetID := c.Params("id")

	if uid == targetID {
		return utils.Success(c, fiber.Map{
			"is_following":    false,
			"is_friend":       false,
			"pending_request": "none",
		})
	}

	// Check following (current user → target)
	var followingCnt int
	h.DB.Get(&followingCnt, `
		SELECT COUNT(*) FROM relationships WHERE user_id = $1 AND target_id = $2 AND type = 'following'
	`, uid, targetID)

	// Check friend (bidirectional, check one direction)
	var friendCnt int
	h.DB.Get(&friendCnt, `
		SELECT COUNT(*) FROM relationships WHERE user_id = $1 AND target_id = $2 AND type = 'friend'
	`, uid, targetID)

	// Check pending friend requests
	pending := "none"
	var outgoingCnt int
	h.DB.Get(&outgoingCnt, `
		SELECT COUNT(*) FROM friend_requests WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'
	`, uid, targetID)
	if outgoingCnt > 0 {
		pending = "outgoing"
	} else {
		var incomingCnt int
		h.DB.Get(&incomingCnt, `
			SELECT COUNT(*) FROM friend_requests WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'
		`, targetID, uid)
		if incomingCnt > 0 {
			pending = "incoming"
		}
	}

	return utils.Success(c, fiber.Map{
		"is_following":    followingCnt > 0,
		"is_friend":       friendCnt > 0,
		"pending_request": pending,
	})
}

// GetFriends — GET /social/friends
// Returns the current user's friends.
func (h *SocialHandler) GetFriends(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)

	type FriendInfo struct {
		ID        string  `json:"id" db:"id"`
		Nickname  *string `json:"nickname" db:"nickname"`
		CFHandle  *string `json:"cf_handle" db:"cf_handle"`
		CFRating  int     `json:"cf_rating" db:"cf_rating"`
		AvatarURL string  `json:"avatar_url" db:"avatar_url"`
	}

	var list []FriendInfo
	err := h.DB.Select(&list, `
		SELECT u.id, u.nickname, u.cf_handle, u.cf_rating, u.avatar_url
		FROM relationships r JOIN users u ON r.target_id = u.id
		WHERE r.user_id = $1 AND r.type = 'friend'
		ORDER BY r.created_at DESC
	`, uid)
	if err != nil {
		return utils.Error(c, 500, "查询失败")
	}
	if list == nil {
		list = []FriendInfo{}
	}
	return utils.Success(c, list)
}

// GetPendingRequests — GET /social/friend-requests
// Returns incoming pending friend requests for the current user.
func (h *SocialHandler) GetPendingRequests(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)

	type RequestInfo struct {
		ID        string  `json:"id" db:"id"`
		SenderID  string  `json:"sender_id" db:"sender_id"`
		Nickname  *string `json:"nickname" db:"nickname"`
		CFHandle  *string `json:"cf_handle" db:"cf_handle"`
		AvatarURL string  `json:"avatar_url" db:"avatar_url"`
		CreatedAt string  `json:"created_at" db:"created_at"`
	}

	var list []RequestInfo
	err := h.DB.Select(&list, `
		SELECT fr.id, fr.sender_id, u.nickname, u.cf_handle, u.avatar_url, fr.created_at::text
		FROM friend_requests fr JOIN users u ON fr.sender_id = u.id
		WHERE fr.receiver_id = $1 AND fr.status = 'pending'
		ORDER BY fr.created_at DESC
	`, uid)
	if err != nil {
		return utils.Error(c, 500, "查询失败")
	}
	if list == nil {
		list = []RequestInfo{}
	}
	return utils.Success(c, list)
}

// GetMyPendingOutgoing — GET /social/friend-requests/outgoing
// Returns outgoing pending friend requests from the current user.
func (h *SocialHandler) GetMyPendingOutgoing(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)

	type RequestInfo struct {
		ID         string  `json:"id" db:"id"`
		ReceiverID string  `json:"receiver_id" db:"receiver_id"`
		Nickname   *string `json:"nickname" db:"nickname"`
		CFHandle   *string `json:"cf_handle" db:"cf_handle"`
		AvatarURL  string  `json:"avatar_url" db:"avatar_url"`
		CreatedAt  string  `json:"created_at" db:"created_at"`
	}

	var list []RequestInfo
	err := h.DB.Select(&list, `
		SELECT fr.id, fr.receiver_id, u.nickname, u.cf_handle, u.avatar_url, fr.created_at::text
		FROM friend_requests fr JOIN users u ON fr.receiver_id = u.id
		WHERE fr.sender_id = $1 AND fr.status = 'pending'
		ORDER BY fr.created_at DESC
	`, uid)
	if err != nil {
		return utils.Error(c, 500, "查询失败")
	}
	if list == nil {
		list = []RequestInfo{}
	}
	return utils.Success(c, list)
}

// SendFriendRequest — POST /social/friend-request/:id
// Sends a friend request. Auto-accepts if reverse pending request exists.
func (h *SocialHandler) SendFriendRequest(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	targetID := c.Params("id")

	if uid == targetID {
		return utils.Error(c, 400, "不能给自己发好友请求")
	}

	// Check if already friends
	var friendCnt int
	h.DB.Get(&friendCnt, `
		SELECT COUNT(*) FROM relationships WHERE user_id = $1 AND target_id = $2 AND type = 'friend'
	`, uid, targetID)
	if friendCnt > 0 {
		return utils.Error(c, 400, "已经是好友")
	}

	// Check if already sent a pending request
	var outgoingCnt int
	h.DB.Get(&outgoingCnt, `
		SELECT COUNT(*) FROM friend_requests WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'
	`, uid, targetID)
	if outgoingCnt > 0 {
		return utils.Error(c, 400, "已发送过请求，等待对方确认")
	}

	// Check if target already sent a request to us (reverse) — auto-accept
	var incomingReqID string
	err := h.DB.Get(&incomingReqID, `
		SELECT id::text FROM friend_requests WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'
	`, targetID, uid)
	if err == nil {
		// Auto-accept: use transaction
		tx, err := h.DB.Beginx()
		if err != nil {
			return utils.Error(c, 500, "操作失败")
		}
		defer tx.Rollback()

		_, err = tx.Exec(`DELETE FROM friend_requests WHERE id = $1`, incomingReqID)
		if err != nil {
			return utils.Error(c, 500, "操作失败")
		}

		_, err = tx.Exec(`
			INSERT INTO relationships (user_id, target_id, type) VALUES ($1, $2, 'friend')
			ON CONFLICT DO NOTHING
		`, uid, targetID)
		if err != nil {
			return utils.Error(c, 500, "操作失败")
		}

		_, err = tx.Exec(`
			INSERT INTO relationships (user_id, target_id, type) VALUES ($1, $2, 'friend')
			ON CONFLICT DO NOTHING
		`, targetID, uid)
		if err != nil {
			return utils.Error(c, 500, "操作失败")
		}

		if err := tx.Commit(); err != nil {
			return utils.Error(c, 500, "操作失败")
		}
		return utils.Success(c, fiber.Map{"status": "accepted", "auto": true})
	}

	// Limit pending outgoing requests to 20
	var pendingCount int
	h.DB.Get(&pendingCount, `
		SELECT COUNT(*) FROM friend_requests WHERE sender_id = $1 AND status = 'pending'
	`, uid)
	if pendingCount >= 20 {
		return utils.Error(c, 400, "待处理的好友请求过多，请等待对方处理")
	}

	// Create new request
	_, err = h.DB.Exec(`
		INSERT INTO friend_requests (sender_id, receiver_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, uid, targetID)
	if err != nil {
		return utils.Error(c, 500, "发送失败")
	}
	return utils.Success(c, fiber.Map{"status": "pending"})
}

// AcceptFriendRequest — PUT /social/friend-request/:id/accept
// Accepts a friend request. Uses a transaction for consistency.
func (h *SocialHandler) AcceptFriendRequest(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	reqID := c.Params("id")

	tx, err := h.DB.Beginx()
	if err != nil {
		return utils.Error(c, 500, "操作失败")
	}
	defer tx.Rollback()

	// Find and delete the request atomically
	var senderID string
	err = tx.Get(&senderID, `
		DELETE FROM friend_requests WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
		RETURNING sender_id
	`, reqID, uid)
	if err != nil {
		return utils.Error(c, 404, "请求不存在或已处理")
	}

	// Create bidirectional friend relationship
	_, err = tx.Exec(`
		INSERT INTO relationships (user_id, target_id, type) VALUES ($1, $2, 'friend')
		ON CONFLICT DO NOTHING
	`, uid, senderID)
	if err != nil {
		return utils.Error(c, 500, "操作失败")
	}

	_, err = tx.Exec(`
		INSERT INTO relationships (user_id, target_id, type) VALUES ($1, $2, 'friend')
		ON CONFLICT DO NOTHING
	`, senderID, uid)
	if err != nil {
		return utils.Error(c, 500, "操作失败")
	}

	if err := tx.Commit(); err != nil {
		return utils.Error(c, 500, "操作失败")
	}
	return utils.Success(c, nil)
}

// RejectFriendRequest — PUT /social/friend-request/:id/reject
// Rejects a friend request by deleting it.
func (h *SocialHandler) RejectFriendRequest(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	reqID := c.Params("id")

	result, err := h.DB.Exec(`
		DELETE FROM friend_requests WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
	`, reqID, uid)
	if err != nil {
		return utils.Error(c, 500, "操作失败")
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return utils.Error(c, 404, "请求不存在或已处理")
	}
	return utils.Success(c, nil)
}

// RemoveFriend — DELETE /social/friends/:id
// Removes a friendship (bidirectional). Uses a transaction.
func (h *SocialHandler) RemoveFriend(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	targetID := c.Params("id")

	tx, err := h.DB.Beginx()
	if err != nil {
		return utils.Error(c, 500, "操作失败")
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		DELETE FROM relationships
		WHERE (user_id = $1 AND target_id = $2 AND type = 'friend')
		   OR (user_id = $2 AND target_id = $1 AND type = 'friend')
	`, uid, targetID)
	if err != nil {
		return utils.Error(c, 500, "操作失败")
	}

	if err := tx.Commit(); err != nil {
		return utils.Error(c, 500, "操作失败")
	}
	return utils.Success(c, nil)
}

// GetFriendReview — GET /social/:id/review
// Returns a friend's review entries. Requires actual friendship.
func (h *SocialHandler) GetFriendReview(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	friendID := c.Params("id")

	// Verify friendship exists
	var friendCnt int
	h.DB.Get(&friendCnt, `
		SELECT COUNT(*) FROM relationships WHERE user_id = $1 AND target_id = $2 AND type = 'friend'
	`, uid, friendID)
	if friendCnt == 0 {
		return utils.Error(c, 403, "对方不是你的好友")
	}

	// Check privacy setting
	var allow bool
	h.DB.Get(&allow, `SELECT allow_view_review FROM users WHERE id = $1`, friendID)
	if !allow {
		return utils.Error(c, 403, "对方未开启补题记录查看权限")
	}

	tag := c.Query("tag")
	args := []interface{}{friendID}

	sql := `SELECT * FROM review_entries WHERE user_id = $1`

	if tag != "" {
		sql += fmt.Sprintf(" AND $%d = ANY(custom_tags)", 2)
		args = append(args, tag)
	}
	sql += ` ORDER BY created_at DESC`

	var entries []map[string]interface{}
	h.DB.Select(&entries, sql, args...)
	if entries == nil {
		entries = []map[string]interface{}{}
	}
	return utils.Success(c, entries)
}

// GetFollowerCount — helper to get follower count for a user.
func (h *SocialHandler) GetFollowerCount(userID string) int {
	var cnt int
	h.DB.Get(&cnt, `
		SELECT COUNT(*) FROM relationships WHERE target_id = $1 AND type IN ('following', 'friend')
	`, userID)
	return cnt
}

// GetFollowingCount — helper to get following count for a user.
func (h *SocialHandler) GetFollowingCount(userID string) int {
	var cnt int
	h.DB.Get(&cnt, `
		SELECT COUNT(*) FROM relationships WHERE user_id = $1 AND type IN ('following', 'friend')
	`, userID)
	return cnt
}
