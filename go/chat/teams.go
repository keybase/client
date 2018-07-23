package chat

import (
	"errors"
	"fmt"
	"strings"

	"github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	context "golang.org/x/net/context"
)

func addNameInfoCryptKey(keys types.AllCryptKeys, key types.CryptKey, implicit bool) {
	if implicit {
		keys[chat1.ConversationMembersType_IMPTEAMNATIVE] =
			append(keys[chat1.ConversationMembersType_IMPTEAMNATIVE], key)
		keys[chat1.ConversationMembersType_IMPTEAMUPGRADE] =
			append(keys[chat1.ConversationMembersType_IMPTEAMUPGRADE], key)
	} else {
		keys[chat1.ConversationMembersType_TEAM] =
			append(keys[chat1.ConversationMembersType_TEAM], key)
	}
}

func getTeamKeys(ctx context.Context, team *teams.Team, public bool) (res types.AllCryptKeys, err error) {
	res = types.NewAllCryptKeys()
	if !public {
		chatKeys, err := team.AllApplicationKeys(ctx, keybase1.TeamApplication_CHAT)
		if err != nil {
			return res, err
		}
		for _, key := range chatKeys {
			addNameInfoCryptKey(res, key, team.IsImplicit())
		}

		kbfsKeys := team.KBFSCryptKeys(ctx, keybase1.TeamApplication_CHAT)
		for _, key := range kbfsKeys {
			res[chat1.ConversationMembersType_KBFS] =
				append(res[chat1.ConversationMembersType_KBFS], key)
		}
	} else {
		addNameInfoCryptKey(res, publicCryptKey, team.IsImplicit())
		res[chat1.ConversationMembersType_KBFS] = []types.CryptKey{publicCryptKey}
	}
	return res, nil
}

func loadTeamForDecryption(ctx context.Context, loader *TeamLoader, name string, teamID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	keyGeneration int, kbfsEncrypted bool) (*teams.Team, error) {

	var refreshers keybase1.TeamRefreshers
	if !public {
		// Only need keys for private teams.
		if !kbfsEncrypted {
			refreshers.NeedKeyGeneration = keybase1.PerTeamKeyGeneration(keyGeneration)
		} else {
			refreshers.NeedKBFSKeyGeneration = keybase1.TeamKBFSKeyRefresher{
				Generation: keyGeneration,
				AppType:    keybase1.TeamApplication_CHAT,
			}
		}
	}
	team, err := loader.loadTeam(ctx, teamID, name, membersType, public,
		func(teamID keybase1.TeamID) keybase1.LoadTeamArg {
			return keybase1.LoadTeamArg{
				ID:         teamID,
				Public:     public,
				Refreshers: refreshers,
				StaleOK:    true,
			}
		})
	if err != nil {
		return nil, err
	}
	return team, nil
}

type TeamLoader struct {
	libkb.Contextified
	utils.DebugLabeler
}

func NewTeamLoader(g *libkb.GlobalContext) *TeamLoader {
	return &TeamLoader{
		Contextified: libkb.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "TeamLoader", false),
	}
}

func (t *TeamLoader) loadTeam(ctx context.Context, tlfID chat1.TLFID,
	tlfName string, membersType chat1.ConversationMembersType, public bool,
	loadTeamArgOverride func(keybase1.TeamID) keybase1.LoadTeamArg) (team *teams.Team, err error) {
	defer t.Trace(ctx, func() error { return err }, "loadTeam(%s,%s,%v)", tlfName, tlfID, membersType)()

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
		return teams.Load(ctx, t.G(), ltarg(teamID))
	case chat1.ConversationMembersType_IMPTEAMUPGRADE:
		teamID, err := tlfIDToTeamID.Lookup(ctx, tlfID, t.G().API)
		if err != nil {
			return team, err
		}
		loadAttempt := func(repoll bool) error {
			arg := ltarg(teamID)
			arg.ForceRepoll = arg.ForceRepoll || repoll
			team, err = teams.Load(ctx, t.G(), arg)
			if err != nil {
				return err
			}
			if !tlfID.EqString(team.KBFSTLFID()) {
				return ImpteamUpgradeBadteamError{
					Msg: fmt.Sprintf("mismatch TLFID to team: %s != %s", team.KBFSTLFID(), tlfID),
				}
			}
			return nil
		}
		if err = loadAttempt(false); err != nil {
			t.Debug(ctx, "loadTeam: failed to load the team: err: %s", err)
			if IsOfflineError(err) == OfflineErrorKindOnline {
				// try again on bad team, might have had an old team cached
				t.Debug(ctx, "loadTeam: non-offline error, trying again: %s", err)
				if err = loadAttempt(true); err != nil {
					return team, err
				}
			} else {
				//generic error we bail out
				return team, err
			}
		}

		impTeamName, err := team.ImplicitTeamDisplayNameString(ctx)
		if err != nil {
			return team, err
		}
		if impTeamName != tlfName {
			// Try resolving given name, maybe there has been a resolution
			resName, err := teams.ResolveImplicitTeamDisplayName(ctx, t.G(), tlfName, public)
			if err != nil {
				return team, err
			}
			if impTeamName != resName.String() {
				return team, ImpteamUpgradeBadteamError{
					Msg: fmt.Sprintf("mismatch TLF name to implicit team name: %s != %s", impTeamName,
						tlfName),
				}
			}
		}
		return team, nil
	}
	return team, fmt.Errorf("invalid impteam members type: %v", membersType)
}

type TeamsNameInfoSource struct {
	globals.Contextified
	utils.DebugLabeler

	loader *TeamLoader
}

func NewTeamsNameInfoSource(g *globals.Context) *TeamsNameInfoSource {
	return &TeamsNameInfoSource{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "TeamsNameInfoSource", false),
		loader:       NewTeamLoader(g.ExternalG()),
	}
}

func (t *TeamsNameInfoSource) makeNameInfo(ctx context.Context, team *teams.Team, public bool) (res *types.NameInfo, err error) {
	res = types.NewNameInfo()
	res.ID, err = chat1.TeamIDToTLFID(team.ID)
	if err != nil {
		return res, err
	}
	res.CanonicalName = team.Name().String()
	if res.CryptKeys, err = getTeamKeys(ctx, team, public); err != nil {
		return res, err
	}
	return res, nil
}

func (t *TeamsNameInfoSource) Lookup(ctx context.Context, name string, public bool) (res *types.NameInfo, err error) {
	defer t.Trace(ctx, func() error { return err }, fmt.Sprintf("Lookup(%s)", name))()
	team, err := teams.Load(ctx, t.G().ExternalG(), keybase1.LoadTeamArg{
		Name:        name, // Loading by name is a last resort and will always cause an extra roundtrip.
		Public:      public,
		ForceRepoll: true,
	})
	if err != nil {
		return res, err
	}
	return t.makeNameInfo(ctx, team, public)
}

func (t *TeamsNameInfoSource) EncryptionKeys(ctx context.Context, name string, teamID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (res *types.NameInfo, err error) {
	defer t.Trace(ctx, func() error { return err },
		fmt.Sprintf("EncryptionKeys(%s,%s,%v)", name, teamID, public))()
	team, err := t.loader.loadTeam(ctx, teamID, name, membersType, public, nil)
	if err != nil {
		return res, err
	}
	return t.makeNameInfo(ctx, team, public)
}

func (t *TeamsNameInfoSource) DecryptionKeys(ctx context.Context, name string, teamID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	keyGeneration int, kbfsEncrypted bool) (res *types.NameInfo, err error) {
	defer t.Trace(ctx, func() error { return err },
		fmt.Sprintf("DecryptionKeys(%s,%s,%v,%d,%v)", name, teamID, public, keyGeneration, kbfsEncrypted))()
	team, err := loadTeamForDecryption(ctx, t.loader, name, teamID, membersType, public,
		keyGeneration, kbfsEncrypted)
	if err != nil {
		return res, err
	}
	return t.makeNameInfo(ctx, team, public)
}

func (t *TeamsNameInfoSource) EphemeralEncryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (teamEK keybase1.TeamEk, err error) {
	if public {
		return teamEK, NewPublicTeamEphemeralKeyError()
	}

	teamID, err := keybase1.TeamIDFromString(tlfID.String())
	if err != nil {
		return teamEK, err
	}
	return t.G().GetEKLib().GetOrCreateLatestTeamEK(ctx, teamID)
}

func (t *TeamsNameInfoSource) EphemeralDecryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool, generation keybase1.EkGeneration) (teamEK keybase1.TeamEk, err error) {
	if public {
		return teamEK, NewPublicTeamEphemeralKeyError()
	}

	teamID, err := keybase1.TeamIDFromString(tlfID.String())
	if err != nil {
		return teamEK, err
	}
	return t.G().GetEKLib().GetTeamEK(ctx, teamID, generation)
}

func (t *TeamsNameInfoSource) ShouldPairwiseMAC(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (bool, []keybase1.KID, error) {
	return shouldPairwiseMAC(ctx, t.G(), t.loader, tlfName, tlfID, membersType, public)
}

func batchLoadEncryptionKIDs(ctx context.Context, g *libkb.GlobalContext, uvs []keybase1.UserVersion) (ret []keybase1.KID, err error) {

	getArg := func(i int) *libkb.LoadUserArg {
		if i >= len(uvs) {
			return nil
		}
		tmp := libkb.NewLoadUserByUIDArg(ctx, g, uvs[i].Uid)
		return &tmp
	}

	processResult := func(i int, upak *keybase1.UserPlusKeysV2AllIncarnations) {
		if upak == nil {
			return
		}
		for _, key := range upak.Current.DeviceKeys {
			// Include only unrevoked encryption keys.
			if !key.Base.IsSibkey && key.Base.Revocation == nil {
				ret = append(ret, key.Base.Kid)
			}
		}
	}

	err = g.GetUPAKLoader().Batcher(ctx, getArg, processResult, 0)
	return ret, err
}

func shouldPairwiseMAC(ctx context.Context, g *globals.Context, loader *TeamLoader, tlfName string,
	tlfID chat1.TLFID, membersType chat1.ConversationMembersType, public bool) (should bool, kids []keybase1.KID, err error) {

	if public {
		return false, nil, nil
	}

	defer g.CTraceTimed(ctx, fmt.Sprintf("shouldPairwiseMAC teamID %s", tlfID.String()), func() error { return err })()

	team, err := loader.loadTeam(ctx, tlfID, tlfName, membersType, public, nil)
	if err != nil {
		return false, nil, err
	}
	members, err := team.Members()
	if err != nil {
		return false, nil, err
	}
	memberUVs := members.AllUserVersions()

	// For performance reasons, we don't try to pairwise MAC any messages in
	// large teams.
	if len(memberUVs) > libkb.MaxTeamMembersForPairwiseMAC {
		return false, nil, nil
	}

	unrevokedKIDs, err := batchLoadEncryptionKIDs(ctx, g.GlobalContext, memberUVs)
	if err != nil {
		return false, nil, err
	}

	if len(unrevokedKIDs) > 10*libkb.MaxTeamMembersForPairwiseMAC {
		// If someone on the team has a ton of devices, it could break our "100
		// members" heuristic and lead to bad performance. We don't want to
		// silently fall back to the non-repudiable mode, because that would
		// create an opening for downgrade attacks, and we'd need to document
		// this exception everywhere we talk about repudiability. But if this
		// turns out to be a performance issue in practice, we might want to
		// add some workaround. (For example, we could choose to omit
		// recipients with an unreasonable number of devices.)
		g.Log.CWarningf(ctx, "unreasonable number of devices (%d) in recipients list", len(unrevokedKIDs))
	}
	return true, unrevokedKIDs, nil
}

type ImplicitTeamsNameInfoSource struct {
	globals.Contextified
	utils.DebugLabeler
	*NameIdentifier

	loader         *TeamLoader
	lookupUpgraded bool
}

func NewImplicitTeamsNameInfoSource(g *globals.Context, lookupUpgraded bool) *ImplicitTeamsNameInfoSource {
	return &ImplicitTeamsNameInfoSource{
		Contextified:   globals.NewContextified(g),
		DebugLabeler:   utils.NewDebugLabeler(g.GetLog(), "ImplicitTeamsNameInfoSource", false),
		NameIdentifier: NewNameIdentifier(g),
		loader:         NewTeamLoader(g.ExternalG()),
		lookupUpgraded: lookupUpgraded,
	}
}

func (t *ImplicitTeamsNameInfoSource) identify(ctx context.Context, tlfID chat1.TLFID,
	impTeamName keybase1.ImplicitTeamDisplayName) (res []keybase1.TLFIdentifyFailure, err error) {

	var names []string
	names = append(names, impTeamName.Writers.KeybaseUsers...)
	names = append(names, impTeamName.Readers.KeybaseUsers...)

	// identify the members in the conversation
	identBehavior, _, ok := IdentifyMode(ctx)
	if !ok {
		return res, errors.New("invalid context with no chat metadata")
	}
	res, err = t.Identify(ctx, names, true,
		func() keybase1.TLFID {
			return keybase1.TLFID(tlfID.String())
		},
		func() keybase1.CanonicalTlfName {
			return keybase1.CanonicalTlfName(impTeamName.String())
		})
	if err != nil {
		return res, err
	}

	// GUI Strict mode errors are swallowed earlier, return an error now (key is that it is
	// after send to IdentifyNotifier)
	if identBehavior == keybase1.TLFIdentifyBehavior_CHAT_GUI_STRICT && len(res) > 0 {
		return res, libkb.NewIdentifySummaryError(res[0])
	}

	return res, nil
}

func (t *ImplicitTeamsNameInfoSource) makeNameInfo(ctx context.Context, team *teams.Team,
	tlfID chat1.TLFID, impTeamName keybase1.ImplicitTeamDisplayName, public bool) (res *types.NameInfo, err error) {
	res = types.NewNameInfo()
	res.ID = tlfID
	if res.ID.IsNil() {
		return res, errors.New("blank TLF ID given")
	}
	res.CanonicalName = impTeamName.String()
	if res.CryptKeys, err = getTeamKeys(ctx, team, public); err != nil {
		return res, err
	}
	if res.IdentifyFailures, err = t.identify(ctx, tlfID, impTeamName); err != nil {
		return res, err
	}
	return res, nil
}

func (t *ImplicitTeamsNameInfoSource) Lookup(ctx context.Context, name string, public bool) (res *types.NameInfo, err error) {
	// check if name is prefixed
	if strings.HasPrefix(name, keybase1.ImplicitTeamPrefix) {
		return t.lookupInternalName(ctx, name, public)
	}
	res = types.NewNameInfo()

	team, _, impTeamName, err := teams.LookupImplicitTeam(ctx, t.G().ExternalG(), name, public)
	if err != nil {
		// return the common type for a unknown TLF name
		switch err.(type) {
		case teams.TeamDoesNotExistError:
			return res, NewUnknownTLFNameError(name)
		}
		t.Debug(ctx, "Lookup: error looking up the team: %s", err)
		return res, err
	}
	if !team.ID.IsRootTeam() {
		panic(fmt.Sprintf("implicit team found via LookupImplicitTeam not root team: %s", team.ID))
	}

	var tlfID chat1.TLFID
	if t.lookupUpgraded {
		tlfID = chat1.TLFID(team.KBFSTLFID().ToBytes())
	} else {
		tlfID, err = chat1.TeamIDToTLFID(team.ID)
		if err != nil {
			return res, err
		}
	}
	return t.makeNameInfo(ctx, team, tlfID, impTeamName, public)
}

func (t *ImplicitTeamsNameInfoSource) EncryptionKeys(ctx context.Context, name string, teamID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (res *types.NameInfo, err error) {
	defer t.Trace(ctx, func() error { return err },
		fmt.Sprintf("EncryptionKeys(%s,%s,%v)", name, teamID, public))()

	team, err := t.loader.loadTeam(ctx, teamID, name, membersType, public, nil)
	if err != nil {
		return res, err
	}
	impTeamName, err := team.ImplicitTeamDisplayName(ctx)
	if err != nil {
		return res, err
	}
	return t.makeNameInfo(ctx, team, teamID, impTeamName, public)
}

func (t *ImplicitTeamsNameInfoSource) DecryptionKeys(ctx context.Context, name string, teamID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	keyGeneration int, kbfsEncrypted bool) (res *types.NameInfo, err error) {
	defer t.Trace(ctx, func() error { return err },
		fmt.Sprintf("DecryptionKeys(%s,%s,%v,%d,%v)", name, teamID, public, keyGeneration, kbfsEncrypted))()

	team, err := loadTeamForDecryption(ctx, t.loader, name, teamID, membersType, public,
		keyGeneration, kbfsEncrypted)
	if err != nil {
		return res, err
	}
	impTeamName, err := team.ImplicitTeamDisplayName(ctx)
	if err != nil {
		return res, err
	}
	return t.makeNameInfo(ctx, team, teamID, impTeamName, public)
}

func (t *ImplicitTeamsNameInfoSource) EphemeralEncryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (teamEK keybase1.TeamEk, err error) {
	if public {
		return teamEK, NewPublicTeamEphemeralKeyError()
	}

	// The native case is the same as regular teams.
	if membersType == chat1.ConversationMembersType_IMPTEAMNATIVE {
		teamID, err := keybase1.TeamIDFromString(tlfID.String())
		if err != nil {
			return teamEK, err
		}
		return t.G().GetEKLib().GetOrCreateLatestTeamEK(ctx, teamID)
	}
	// Otherwise for implicit teams, we have to load the team to get its ID.
	team, err := t.loader.loadTeam(ctx, tlfID, tlfName, membersType, public, nil)
	if err != nil {
		return teamEK, err
	}
	return t.G().GetEKLib().GetOrCreateLatestTeamEK(ctx, team.ID)
}

func (t *ImplicitTeamsNameInfoSource) EphemeralDecryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	generation keybase1.EkGeneration) (teamEK keybase1.TeamEk, err error) {
	if public {
		return teamEK, NewPublicTeamEphemeralKeyError()
	}

	// The native case is the same as regular teams.
	if membersType == chat1.ConversationMembersType_IMPTEAMNATIVE {
		teamID, err := keybase1.TeamIDFromString(tlfID.String())
		if err != nil {
			return teamEK, err
		}
		return t.G().GetEKLib().GetTeamEK(ctx, teamID, generation)
	}
	// Otherwise for implicit teams, we have to load the team to get its ID.
	team, err := t.loader.loadTeam(ctx, tlfID, tlfName, membersType, public, nil)
	if err != nil {
		return teamEK, err
	}
	return t.G().GetEKLib().GetTeamEK(ctx, team.ID, generation)
}

func (t *ImplicitTeamsNameInfoSource) ShouldPairwiseMAC(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (bool, []keybase1.KID, error) {
	return shouldPairwiseMAC(ctx, t.G(), t.loader, tlfName, tlfID, membersType, public)
}

func (t *ImplicitTeamsNameInfoSource) lookupInternalName(ctx context.Context, name string, public bool) (res *types.NameInfo, err error) {
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
	if res.CryptKeys, err = getTeamKeys(ctx, team, public); err != nil {
		return res, err
	}
	return res, nil
}

type tlfIDToTeamIDMap struct {
	storage *lru.Cache
}

func newTlfIDToTeamIDMap() *tlfIDToTeamIDMap {
	s, _ := lru.New(10000)
	return &tlfIDToTeamIDMap{
		storage: s,
	}
}

// Lookup gives the server trust mapping between tlfID and teamID
func (t *tlfIDToTeamIDMap) Lookup(ctx context.Context, tlfID chat1.TLFID, api libkb.API) (res keybase1.TeamID, err error) {
	if iTeamID, ok := t.storage.Get(tlfID.String()); ok {
		return iTeamID.(keybase1.TeamID), nil
	}
	arg := libkb.NewAPIArgWithNetContext(ctx, "team/id")
	arg.Args = libkb.NewHTTPArgs()
	arg.Args.Add("tlf_id", libkb.S{Val: tlfID.String()})
	arg.SessionType = libkb.APISessionTypeREQUIRED
	apiRes, err := api.Get(arg)
	if err != nil {
		return res, err
	}
	st, err := apiRes.Body.AtKey("team_id").GetString()
	if err != nil {
		return res, err
	}
	teamID, err := keybase1.TeamIDFromString(st)
	if err != nil {
		return res, err
	}
	t.storage.Add(tlfID.String(), teamID)
	return teamID, nil
}

var tlfIDToTeamID = newTlfIDToTeamIDMap()
