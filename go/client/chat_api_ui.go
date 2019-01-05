package client

import (
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

type ChatAPIUI struct {
	utils.DummyChatUI
	allowStellarPayment bool
}

func NewChatAPIUI() *ChatAPIUI {
	return &ChatAPIUI{
		DummyChatUI: utils.DummyChatUI{},
	}
}

func (u *ChatAPIUI) ChatStellarDataConfirm(ctx context.Context, arg chat1.ChatStellarDataConfirmArg) (bool, error) {
	return u.allowStellarPayment, nil
}

type ChatAPINotifications struct {
	utils.DummyChatNotifications
}

func NewChatAPINotifications() *ChatAPINotifications {
	return &ChatAPINotifications{
		DummyChatNotifications: utils.DummyChatNotifications{},
	}
}
