// Handlers for teambot-related gregor messages

package service

import (
	"encoding/json"
	"fmt"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teambot"
)

const teambotHandlerName = "teambotHandler"

type teambotHandler struct {
	libkb.Contextified
}

var _ libkb.GregorInBandMessageHandler = (*teambotHandler)(nil)

func newTeambotHandler(g *libkb.GlobalContext) *teambotHandler {
	return &teambotHandler{
		Contextified: libkb.NewContextified(g),
	}
}

func (r *teambotHandler) Create(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	switch category {
	case "teambot.new_teambot_key":
		return true, r.newTeambotKey(ctx, cli, item)
	case "teambot.teambot_key_needed":
		return true, r.teambotKeyNeeded(ctx, cli, item)
	default:
		if strings.HasPrefix(category, "teambot.") {
			return false, fmt.Errorf("unknown teambotHandler category: %q", category)
		}
		return false, nil
	}
}

func (r *teambotHandler) Dismiss(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	return false, nil
}

func (r *teambotHandler) IsAlive() bool {
	return true
}

func (r *teambotHandler) Name() string {
	return teambotHandlerName
}

func (r *teambotHandler) newTeambotKey(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item) error {
	r.G().Log.CDebugf(ctx, "teambotHandler: teambot.new_teambot_key received")
	var msg keybase1.NewTeambotKeyArg
	if err := json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		r.G().Log.CDebugf(ctx, "error unmarshaling teambot.new_teambot_key item: %s", err)
		return err
	}
	r.G().Log.CDebugf(ctx, "teambot.new_teambot_key unmarshaled: %+v", msg)

	if err := teambot.HandleNewTeambotKey(r.MetaContext(ctx), msg.Id, msg.Application, msg.Generation); err != nil {
		return err
	}

	r.G().Log.CDebugf(ctx, "dismissing teambot.new_teambot_key item since action succeeded")
	return r.G().GregorState.DismissItem(ctx, cli, item.Metadata().MsgID())
}

func (r *teambotHandler) teambotKeyNeeded(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item) error {
	r.G().Log.CDebugf(ctx, "teambotHandler: teambot.teambot_key_needed received")
	var msg keybase1.TeambotKeyNeededArg
	if err := json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		r.G().Log.CDebugf(ctx, "error unmarshaling teambot.teambot_key_needed item: %s", err)
		return err
	}
	r.G().Log.CDebugf(ctx, "teambot.teambot_key_needed unmarshaled: %+v", msg)

	if err := teambot.HandleTeambotKeyNeeded(r.MetaContext(ctx), msg.Id, msg.Uid, msg.Application, msg.Generation); err != nil {
		r.G().Log.CDebugf(ctx, "teambot.teambot_key_needed unable to make new key: %v", err)
	}

	r.G().Log.CDebugf(ctx, "dismissing teambot.teambot_key_needed item")
	return r.G().GregorState.DismissItem(ctx, cli, item.Metadata().MsgID())
}
