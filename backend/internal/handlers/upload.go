package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"algoarena/internal/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

var UploadDir = func() string {
	dir := "uploads"
	os.MkdirAll(dir, 0755)
	return dir
}()

var allowedMIME = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/gif":  true,
	"image/webp": true,
}

func UploadHandler(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return utils.Error(c, 400, "请选择文件")
	}

	if file.Size > 10<<20 {
		return utils.Error(c, 400, "文件大小不能超过 10MB")
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowed := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true}
	if !allowed[ext] {
		return utils.Error(c, 400, "仅支持 jpg/png/gif/webp 格式")
	}

	src, err := file.Open()
	if err != nil {
		return utils.Error(c, 500, "读取文件失败")
	}
	defer src.Close()

	// Validate MIME type by reading first 512 bytes
	buf := make([]byte, 512)
	n, err := src.Read(buf)
	if err != nil && err != io.EOF {
		return utils.Error(c, 500, "读取文件失败")
	}
	mimeType := http.DetectContentType(buf[:n])
	if !allowedMIME[mimeType] {
		return utils.Error(c, 400, "文件内容不是有效的图片格式")
	}

	// Reset read position
	if seeker, ok := src.(io.Seeker); ok {
		seeker.Seek(0, io.SeekStart)
	}

	// Generate safe filename — never use original filename
	filename := fmt.Sprintf("%s%s", uuid.New().String(), ext)
	savePath := filepath.Join(UploadDir, filename)

	dst, err := os.Create(savePath)
	if err != nil {
		return utils.Error(c, 500, "保存文件失败")
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return utils.Error(c, 500, "写入文件失败")
	}

	url := fmt.Sprintf("/uploads/%s", filename)
	return utils.Success(c, fiber.Map{"url": url})
}
