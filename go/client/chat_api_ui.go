package client

import (
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

type ChatAPIUI struct {
	utils.DummyChatUI
	allowStellarPayments bool
}

func AllowStellarPayments(enabled bool) func(*ChatAPIUI) {
	return func(c *ChatAPIUI) {
		c.SetAllowStellarPayments(enabled)
	}
}

func NewChatAPIUI(opts ...func(*ChatAPIUI)) *ChatAPIUI {
	c := &ChatAPIUI{
		DummyChatUI: utils.DummyChatUI{},
	}
	for _, o := range opts {
		o(c)
	}
	return c
}

func (u *ChatAPIUI) ChatStellarDataConfirm(ctx context.Context, arg chat1.ChatStellarDataConfirmArg) (bool, error) {
	return u.allowStellarPayments, nil
}

func (u *ChatAPIUI) SetAllowStellarPayments(enabled bool) {
	u.allowStellarPayments = enabled
}

type ChatAPINotifications struct {
	utils.DummyChatNotifications
}

func NewChatAPINotifications() *ChatAPINotifications {
	return &ChatAPINotifications{
		DummyChatNotifications: utils.DummyChatNotifications{},
	}
}
