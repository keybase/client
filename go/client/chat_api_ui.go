package client

import (
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

type ChatAPIUI struct {
	utils.DummyChatUI
	sessionID            int
	allowStellarPayments bool
}

var _ chat1.ChatUiInterface = (*ChatAPIUI)(nil)

func AllowStellarPayments(enabled bool) func(*ChatAPIUI) {
	return func(c *ChatAPIUI) {
		c.SetAllowStellarPayments(enabled)
	}
}

func NewChatAPIUI(opts ...func(*ChatAPIUI)) *ChatAPIUI {
	c := &ChatAPIUI{
		DummyChatUI: utils.DummyChatUI{},
		sessionID:   randSessionID(),
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
