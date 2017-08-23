package chat

import (
	"fmt"
	"strings"

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
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "TeamsNameInfoSource", false),
	}
}

func (t *TeamsNameInfoSource) Lookup(ctx context.Context, name string, vis chat1.TLFVisibility) (res types.NameInfo, err error) {
	defer t.Trace(ctx, func() error { return err }, fmt.Sprintf("Lookup(%s)", name))()

	team, err := teams.Load(ctx, t.G().ExternalG(), keybase1.LoadTeamArg{
		Name:        name, // Loading by name is a last resort and will always cause an extra roundtrip.
		ForceRepoll: true,
	})
	if err != nil {
		return res, err
	}
	return teamToNameInfo(ctx, team, vis)
}

func teamToNameInfo(ctx context.Context, team *teams.Team, vis chat1.TLFVisibility) (res types.NameInfo, err error) {
	res.ID, err = teamIDToTLFID(team.ID)
	if err != nil {
		return res, err
	}
	res.CanonicalName = team.Name().String()

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

type ImplicitTeamsNameInfoSource struct {
	globals.Contextified
	utils.DebugLabeler
}

func NewImplicitTeamsNameInfoSource(g *globals.Context) *ImplicitTeamsNameInfoSource {
	return &ImplicitTeamsNameInfoSource{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "ImplicitTeamsNameInfoSource", false),
	}
}

func (t *ImplicitTeamsNameInfoSource) Lookup(ctx context.Context, name string, vis chat1.TLFVisibility) (res types.NameInfo, err error) {
	// check if name is prefixed
	if strings.HasPrefix(name, keybase1.ImplicitTeamPrefix) {
		return t.lookupInternalName(ctx, name, vis)
	}

	teamID, teamName, err := teams.LookupImplicitTeam(ctx, t.G().ExternalG(), name, vis == chat1.TLFVisibility_PUBLIC)
	if err != nil {
		return res, err
	}

	if !teamID.IsRootTeam() {
		panic(fmt.Sprintf("implicit team found via LookupImplicitTeam not root team: %s", teamID))
	}

	res.ID, err = teamIDToTLFID(teamID)
	if err != nil {
		return res, err
	}

	res.CanonicalName = teamName.String()

	if vis == chat1.TLFVisibility_PRIVATE {
		team, err := teams.Load(ctx, t.G().ExternalG(), keybase1.LoadTeamArg{ID: teamID})
		if err != nil {
			return res, err
		}
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

func (t *ImplicitTeamsNameInfoSource) lookupInternalName(ctx context.Context, name string, vis chat1.TLFVisibility) (res types.NameInfo, err error) {
	team, err := teams.Load(ctx, t.G().ExternalG(), keybase1.LoadTeamArg{Name: name})
	if err != nil {
		return res, err
	}
	res.ID, err = teamIDToTLFID(team.ID)
	if err != nil {
		return res, err
	}
	res.CanonicalName, err = team.ImplicitTeamDisplayName(ctx)
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
