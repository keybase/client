// Handlers for ephemeral-related gregor messages

package service

import (
	"encoding/json"
	"fmt"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/ephemeral"
	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

const ekHandlerName = "ephemeralHandler"

type ekHandler struct {
	libkb.Contextified
}

var _ libkb.GregorInBandMessageHandler = (*ekHandler)(nil)

func newEKHandler(g *libkb.GlobalContext) *ekHandler {
	return &ekHandler{
		Contextified: libkb.NewContextified(g),
	}
}

func (r *ekHandler) Create(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	switch category {
	case "ephemeral.new_team_ek":
		return true, r.newTeamEK(ctx, cli, item)
	default:
		if strings.HasPrefix(category, "ephemeral.") {
			return false, fmt.Errorf("unknown ekHandler category: %q", category)
		}
		return false, nil
	}
}

func (r *ekHandler) Dismiss(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	return false, nil
}

func (r *ekHandler) IsAlive() bool {
	return true
}

func (r *ekHandler) Name() string {
	return ekHandlerName
}

func (r *ekHandler) newTeamEK(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item) error {
	r.G().Log.CDebugf(ctx, "ekHandler: ephemeral.new_team_ek received")
	var msg keybase1.NewTeamEkArg
	if err := json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		r.G().Log.CDebugf(ctx, "error unmarshaling ephemeral.new_team_ek item: %s", err)
		return err
	}
	r.G().Log.CDebugf(ctx, "ephemeral.new_team_ek unmarshaled: %+v", msg)

	if err := ephemeral.HandleNewTeamEK(r.MetaContext(ctx), msg.Id, msg.Generation); err != nil {
		return err
	}

	r.G().Log.CDebugf(ctx, "dismissing ephemeral.new_team_ek item since action succeeded")
	return r.G().GregorState.DismissItem(ctx, cli, item.Metadata().MsgID())
}
