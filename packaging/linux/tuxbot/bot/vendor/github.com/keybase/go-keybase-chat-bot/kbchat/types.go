package kbchat

import (
	"github.com/keybase/go-keybase-chat-bot/kbchat/types/chat1"
)

type Result struct {
	Convs []chat1.ConvSummary `json:"conversations"`
}

type SendResponse struct {
	Result chat1.SendRes `json:"result"`
	Error  *Error        `json:"error,omitempty"`
}
