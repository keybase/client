package chat

import (
	"errors"
	"fmt"
	"strings"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
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

func (t *TeamsNameInfoSource) Lookup(ctx context.Context, name string, vis keybase1.TLFVisibility) (res types.NameInfo, err error) {
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

func teamToNameInfo(ctx context.Context, team *teams.Team, vis keybase1.TLFVisibility) (res types.NameInfo, err error) {
	res.ID, err = teamIDToTLFID(team.ID)
	if err != nil {
		return res, err
	}
	res.CanonicalName = team.Name().String()

	if vis == keybase1.TLFVisibility_PRIVATE {
		chatKeys, err := team.AllApplicationKeys(ctx, keybase1.TeamApplication_CHAT)
		if err != nil {
			return res, err
		}
		for _, key := range chatKeys {
			res.CryptKeys = append(res.CryptKeys, key)
		}
	} else {
		res.CryptKeys = []types.CryptKey{publicCryptKey}
	}
	return res, nil
}

type ImplicitTeamsNameInfoSource struct {
	globals.Contextified
	utils.DebugLabeler
	*NameIdentifier
}

func NewImplicitTeamsNameInfoSource(g *globals.Context) *ImplicitTeamsNameInfoSource {
	return &ImplicitTeamsNameInfoSource{
		Contextified:   globals.NewContextified(g),
		DebugLabeler:   utils.NewDebugLabeler(g.GetLog(), "ImplicitTeamsNameInfoSource", false),
		NameIdentifier: NewNameIdentifier(g),
	}
}

func (t *ImplicitTeamsNameInfoSource) Lookup(ctx context.Context, name string, vis keybase1.TLFVisibility) (res types.NameInfo, err error) {
	// check if name is prefixed
	if strings.HasPrefix(name, keybase1.ImplicitTeamPrefix) {
		return t.lookupInternalName(ctx, name, vis)
	}

	teamID, teamName, impTeamName, err := teams.LookupOrCreateImplicitTeam(ctx, t.G().ExternalG(), name,
		vis == keybase1.TLFVisibility_PUBLIC)
	if err != nil {
		return res, err
	}
	if !teamID.IsRootTeam() {
		panic(fmt.Sprintf("implicit team found via LookupImplicitTeam not root team: %s", teamID))
	}

	res.CanonicalName = teamName.String()
	t.Debug(ctx, "NAME: %s", res.CanonicalName)
	res.ID, err = teamIDToTLFID(teamID)
	if err != nil {
		return res, err
	}
	if vis == keybase1.TLFVisibility_PRIVATE {
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
	} else {
		res.CryptKeys = []types.CryptKey{publicCryptKey}
	}

	// identify the members in the conversation
	identBehavior, breaks, ok := IdentifyMode(ctx)
	if !ok {
		return res, errors.New("invalid context with no chat metadata")
	}
	query := keybase1.TLFQuery{
		TlfName:          impTeamName.String(),
		IdentifyBehavior: identBehavior,
	}
	ib, err := t.Identify(ctx, query, true)
	if err != nil {
		return res, err
	}
	// use id breaks calculated by Identify
	res.IdentifyFailures = ib

	if in := CtxIdentifyNotifier(ctx); in != nil {
		update := keybase1.CanonicalTLFNameAndIDWithBreaks{
			TlfID:         keybase1.TLFID(res.ID),
			CanonicalName: keybase1.CanonicalTlfName(res.CanonicalName),
			Breaks: keybase1.TLFBreak{
				Breaks: res.IdentifyFailures,
			},
		}
		in.Send(update)
	}
	*breaks = appendBreaks(*breaks, res.IdentifyFailures)

	// GUI Strict mode errors are swallowed earlier, return an error now (key is that it is
	// after send to IdentifyNotifier)
	if identBehavior == keybase1.TLFIdentifyBehavior_CHAT_GUI_STRICT && len(res.IdentifyFailures) > 0 {
		return res, libkb.NewIdentifySummaryError(res.IdentifyFailures[0])
	}

	return res, nil
}

func (t *ImplicitTeamsNameInfoSource) lookupInternalName(ctx context.Context, name string, vis keybase1.TLFVisibility) (res types.NameInfo, err error) {
	team, err := teams.Load(ctx, t.G().ExternalG(), keybase1.LoadTeamArg{Name: name})
	if err != nil {
		return res, err
	}
	res.CanonicalName = name
	res.ID, err = teamIDToTLFID(team.ID)
	if err != nil {
		return res, err
	}
	if vis == keybase1.TLFVisibility_PRIVATE {
		chatKeys, err := team.AllApplicationKeys(ctx, keybase1.TeamApplication_CHAT)
		if err != nil {
			return res, err
		}
		for _, key := range chatKeys {
			res.CryptKeys = append(res.CryptKeys, key)
		}
	} else {
		res.CryptKeys = []types.CryptKey{publicCryptKey}
	}

	return res, nil
}
