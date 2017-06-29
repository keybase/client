package chat

import (
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	context "golang.org/x/net/context"
)

type TeamsNameInfoSource struct {
	globals.Contextified
	utils.DebugLabeler
}

func NewTeamsNameInfoSource(g *globals.Context) *TeamsNameInfoSource {
	return &TeamsNameInfoSource{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "TeamsNameInfoSource", false),
	}
}

func (t *TeamsNameInfoSource) Lookup(ctx context.Context, name string, vis chat1.TLFVisibility) (res types.NameInfo, err error) {
	defer t.Trace(ctx, func() error { return err }, fmt.Sprintf("Lookup(%s)", name))()

	team, err := teams.GetForChatByStringName(ctx, t.G().ExternalG(), name, keybase1.TeamRefreshers{})
	if err != nil {
		return res, err
	}
	res.CanonicalName = name
	res.ID = chat1.TLFID(team.ID.ToBytes())
	if vis == chat1.TLFVisibility_PRIVATE {
		chatKeys, err := team.AllApplicationKeys(ctx, keybase1.TeamApplication_CHAT)
		if err != nil {
			return res, err
		}
		for _, key := range chatKeys {
			res.CryptKeys = append(res.CryptKeys, key)
		}
	}
	return res, nil
}
