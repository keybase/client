package service

import (
	"context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

// chatPinnedConvsGregorHandler rebuilds the inbox layout when the pinned
// conversation list changes on any device.
type chatPinnedConvsGregorHandler struct {
	globals.Contextified
}

var _ libkb.GregorInBandMessageHandler = (*chatPinnedConvsGregorHandler)(nil)

func newChatPinnedConvsGregorHandler(g *globals.Context) *chatPinnedConvsGregorHandler {
	return &chatPinnedConvsGregorHandler{Contextified: globals.NewContextified(g)}
}

func (h *chatPinnedConvsGregorHandler) handle(ctx context.Context, category string) bool {
	if category != utils.PinnedConvsGregorKey {
		return false
	}
	if loader := h.G().UIInboxLoader; loader != nil {
		loader.UpdateLayout(ctx, chat1.InboxLayoutReselectMode_DEFAULT, "pinned convs changed")
	}
	return true
}

func (h *chatPinnedConvsGregorHandler) Create(ctx context.Context, _ gregor1.IncomingInterface, category string, _ gregor.Item) (bool, error) {
	return h.handle(ctx, category), nil
}

func (h *chatPinnedConvsGregorHandler) Dismiss(ctx context.Context, _ gregor1.IncomingInterface, category string, _ gregor.Item) (bool, error) {
	return h.handle(ctx, category), nil
}

func (h *chatPinnedConvsGregorHandler) IsAlive() bool { return true }

func (h *chatPinnedConvsGregorHandler) Name() string { return "chatPinnedConvsGregorHandler" }
