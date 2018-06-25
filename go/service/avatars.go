package service

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/keybase/client/go/avatars"
	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
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

func (h *AvatarHandler) LoadUserAvatars(ctx context.Context, arg keybase1.LoadUserAvatarsArg) (keybase1.LoadAvatarsRes, error) {
	return h.source.LoadUsers(ctx, arg.Names, arg.Formats)
}

func (h *AvatarHandler) LoadTeamAvatars(ctx context.Context, arg keybase1.LoadTeamAvatarsArg) (keybase1.LoadAvatarsRes, error) {
	return h.source.LoadTeams(ctx, arg.Names, arg.Formats)
}

const avatarGregorHandlerName = "avatarHandler"

type avatarGregorHandler struct {
	libkb.Contextified
	source avatars.Source
}

var _ libkb.GregorInBandMessageHandler = (*avatarGregorHandler)(nil)

func newAvatarGregorHandler(g *libkb.GlobalContext, source avatars.Source) *avatarGregorHandler {
	return &avatarGregorHandler{
		Contextified: libkb.NewContextified(g),
		source:       source,
	}
}

func (r *avatarGregorHandler) Create(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	switch category {
	case "avatar.clear_cache_for_name":
		return true, r.clearName(ctx, cli, item)
	default:
		if strings.HasPrefix(category, "avatar.") {
			return false, fmt.Errorf("unknown avatarGregorHandler category: %q", category)
		}
		return false, nil
	}
}

func (r *avatarGregorHandler) Dismiss(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	return false, nil
}

func (r *avatarGregorHandler) IsAlive() bool {
	return true
}

func (r *avatarGregorHandler) Name() string {
	return avatarGregorHandlerName
}

func (r *avatarGregorHandler) clearName(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item) error {
	r.G().Log.CDebugf(ctx, "avatarGregorHandler: avatar.clear_cache_for_name received")
	var msgs []keybase1.AvatarClearCacheMsg
	if err := json.Unmarshal(item.Body().Bytes(), &msgs); err != nil {
		r.G().Log.CDebugf(ctx, "error unmarshaling avatar.clear_cache_for_name item: %s", err)
		return err
	}

	r.G().Log.CDebugf(ctx, "avatar.clear_cache_for_name unmarshaled: %+v", msgs)

	for _, msg := range msgs {
		if err := r.source.ClearCacheForName(ctx, msg.Name, msg.Formats); err != nil {
			return err
		}
	}

	return r.G().GregorDismisser.DismissItem(ctx, cli, item.Metadata().MsgID())
}
