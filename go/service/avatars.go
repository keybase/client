package service

import (
	"github.com/keybase/client/go/avatars"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type AvatarHandler struct {
	*BaseHandler
	source avatars.Source
}

func NewAvatarHandler(xp rpc.Transporter, g *libkb.GlobalContext, source avatars.Source) *AvatarHandler {
	handler := &AvatarHandler{
		BaseHandler: NewBaseHandler(g, xp),
		source:      source,
	}
	return handler
}

var _ keybase1.AvatarsInterface = (*AvatarHandler)(nil)

func (h *AvatarHandler) LoadUserAvatars(ctx context.Context, arg keybase1.LoadUserAvatarsArg) (keybase1.LoadUserAvatarsRes, error) {
	return h.source.LoadUsers(ctx, arg.Usernames, arg.Formats)
}
