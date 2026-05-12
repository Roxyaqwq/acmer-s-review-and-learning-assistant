package utils

import "github.com/gofiber/fiber/v2"

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

func Success(c *fiber.Ctx, data interface{}) error {
	return c.JSON(Response{Code: 0, Message: "ok", Data: data})
}

func Error(c *fiber.Ctx, code int, msg string) error {
	return c.Status(code).JSON(Response{Code: 1, Message: msg})
}
