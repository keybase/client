package chat

import (
	"errors"
	"fmt"
	"strings"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	context "golang.org/x/net/context"
)

func addNameInfoCryptKey(ni *types.NameInfo, key types.CryptKey, implicit bool) {
	if implicit {
		ni.CryptKeys[chat1.ConversationMembersType_IMPTEAMNATIVE] =
			append(ni.CryptKeys[chat1.ConversationMembersType_IMPTEAMNATIVE], key)
		ni.CryptKeys[chat1.ConversationMembersType_IMPTEAMUPGRADE] =
			append(ni.CryptKeys[chat1.ConversationMembersType_IMPTEAMUPGRADE], key)
	} else {
		ni.CryptKeys[chat1.ConversationMembersType_TEAM] =
			append(ni.CryptKeys[chat1.ConversationMembersType_TEAM], key)
	}
}

func addNameInfoTeamKeys(ctx context.Context, ni *types.NameInfo, team *teams.Team,
	vis keybase1.TLFVisibility) error {
	if vis == keybase1.TLFVisibility_PRIVATE {
		chatKeys, err := team.AllApplicationKeys(ctx, keybase1.TeamApplication_CHAT)
		if err != nil {
			return err
		}
		for _, key := range chatKeys {
			addNameInfoCryptKey(ni, key, team.IsImplicit())
		}

		kbfsKeys := team.KBFSCryptKeys(ctx, keybase1.TeamApplication_CHAT)
		for _, key := range kbfsKeys {
			ni.CryptKeys[chat1.ConversationMembersType_KBFS] =
				append(ni.CryptKeys[chat1.ConversationMembersType_KBFS], key)
		}
	} else {
		addNameInfoCryptKey(ni, publicCryptKey, team.IsImplicit())
		ni.CryptKeys[chat1.ConversationMembersType_KBFS] = []types.CryptKey{publicCryptKey}
	}
	return nil
}

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

func (t *TeamsNameInfoSource) Lookup(ctx context.Context, name string, vis keybase1.TLFVisibility) (res *types.NameInfo, err error) {
	defer t.Trace(ctx, func() error { return err }, fmt.Sprintf("Lookup(%s)", name))()

	team, err := teams.Load(ctx, t.G().ExternalG(), keybase1.LoadTeamArg{
		Name:        name, // Loading by name is a last resort and will always cause an extra roundtrip.
		Public:      vis == keybase1.TLFVisibility_PUBLIC,
		ForceRepoll: true,
	})
	if err != nil {
		return res, err
	}
	return teamToNameInfo(ctx, team, vis)
}

func teamToNameInfo(ctx context.Context, team *teams.Team, vis keybase1.TLFVisibility) (res *types.NameInfo, err error) {
	res = types.NewNameInfo()
	res.ID, err = chat1.TeamIDToTLFID(team.ID)
	if err != nil {
		return res, err
	}
	if team.IsImplicit() {
		res.CanonicalName, err = team.ImplicitTeamDisplayNameString(ctx)
		if err != nil {
			return res, err
		}
	} else {
		res.CanonicalName = team.Name().String()
	}

	if err := addNameInfoTeamKeys(ctx, res, team, vis); err != nil {
		return res, err
	}
	return res, nil
}

type ImplicitTeamsNameInfoSource struct {
	globals.Contextified
	utils.DebugLabeler
	*NameIdentifier
	lookupUpgraded bool
}

func NewImplicitTeamsNameInfoSource(g *globals.Context, lookupUpgraded bool) *ImplicitTeamsNameInfoSource {
	return &ImplicitTeamsNameInfoSource{
		Contextified:   globals.NewContextified(g),
		DebugLabeler:   utils.NewDebugLabeler(g.GetLog(), "ImplicitTeamsNameInfoSource", false),
		NameIdentifier: NewNameIdentifier(g),
		lookupUpgraded: lookupUpgraded,
	}
}

func (t *ImplicitTeamsNameInfoSource) Lookup(ctx context.Context, name string, vis keybase1.TLFVisibility) (res *types.NameInfo, err error) {
	// check if name is prefixed
	if strings.HasPrefix(name, keybase1.ImplicitTeamPrefix) {
		return t.lookupInternalName(ctx, name, vis)
	}
	res = types.NewNameInfo()

	// Always create here to simulate behavior of GetTLFCryptKeys
	team, _, impTeamName, err := teams.LookupOrCreateImplicitTeam(ctx, t.G().ExternalG(), name,
		vis == keybase1.TLFVisibility_PUBLIC)
	if err != nil {
		return res, err
	}
	if !team.ID.IsRootTeam() {
		panic(fmt.Sprintf("implicit team found via LookupImplicitTeam not root team: %s", team.ID))
	}

	res.CanonicalName = impTeamName.String()
	if t.lookupUpgraded {
		res.ID = chat1.TLFID(team.KBFSTLFID().ToBytes())
	} else {
		res.ID, err = chat1.TeamIDToTLFID(team.ID)
		if err != nil {
			return res, err
		}
	}
	if err := addNameInfoTeamKeys(ctx, res, team, vis); err != nil {
		return res, err
	}

	var names []string
	names = append(names, impTeamName.Writers.KeybaseUsers...)
	names = append(names, impTeamName.Readers.KeybaseUsers...)

	// identify the members in the conversation
	identBehavior, breaks, ok := IdentifyMode(ctx)
	if !ok {
		return res, errors.New("invalid context with no chat metadata")
	}
	ib, err := t.Identify(ctx, names, true, identBehavior)
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

func (t *ImplicitTeamsNameInfoSource) lookupInternalName(ctx context.Context, name string, vis keybase1.TLFVisibility) (res *types.NameInfo, err error) {
	public := vis != keybase1.TLFVisibility_PRIVATE
	teamName, err := keybase1.TeamNameFromString(name)
	if err != nil {
		return res, err
	}
	res = types.NewNameInfo()
	res.ID, err = chat1.TeamIDToTLFID(teamName.ToTeamID(public))
	if err != nil {
		return res, err
	}
	res.CanonicalName = name
	team, err := teams.Load(ctx, t.G().ExternalG(), keybase1.LoadTeamArg{
		Name:   name,
		Public: public,
	})
	if err != nil {
		return res, err
	}
	if err := addNameInfoTeamKeys(ctx, res, team, vis); err != nil {
		return res, err
	}

	return res, nil
}

func LoadTeam(ctx context.Context, g *libkb.GlobalContext, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	loadTeamArgOverride func(keybase1.TeamID) keybase1.LoadTeamArg) (team *teams.Team, err error) {

	// Set up load team argument construction, possibly controlled by the caller
	ltarg := func(teamID keybase1.TeamID) keybase1.LoadTeamArg {
		return keybase1.LoadTeamArg{
			ID:     teamID,
			Public: public,
		}
	}
	if loadTeamArgOverride != nil {
		ltarg = loadTeamArgOverride
	}

	switch membersType {
	case chat1.ConversationMembersType_IMPTEAMNATIVE, chat1.ConversationMembersType_TEAM:
		teamID, err := keybase1.TeamIDFromString(tlfID.String())
		if err != nil {
			return team, err
		}
		return teams.Load(ctx, g, ltarg(teamID))
	case chat1.ConversationMembersType_IMPTEAMUPGRADE:
		arg := libkb.NewAPIArgWithNetContext(ctx, "team/id")
		arg.Args = libkb.NewHTTPArgs()
		arg.Args.Add("tlf_id", libkb.S{Val: tlfID.String()})
		arg.SessionType = libkb.APISessionTypeREQUIRED
		res, err := g.API.Get(arg)
		if err != nil {
			return team, err
		}
		st, err := res.Body.AtKey("team_id").GetString()
		if err != nil {
			return team, err
		}
		teamID, err := keybase1.TeamIDFromString(st)
		if err != nil {
			return team, err
		}
		team, err = teams.Load(ctx, g, ltarg(teamID))
		if err != nil {
			return team, err
		}
		if !tlfID.EqString(team.KBFSTLFID()) {
			return team, fmt.Errorf("mismatch TLFID to team: %s != %s", team.KBFSTLFID(), tlfID)
		}
		return team, nil
	}
	return team, fmt.Errorf("invalid impteam members type: %v", membersType)
}
