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
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	context "golang.org/x/net/context"
)

func getTeamCryptKey(ctx context.Context, team *teams.Team, generation keybase1.PerTeamKeyGeneration,
	public, kbfsEncrypted bool) (res types.CryptKey, err error) {
	if public {
		return publicCryptKey, nil
	}
	if kbfsEncrypted {
		kbfsKeys := team.KBFSCryptKeys(ctx, keybase1.TeamApplication_CHAT)
		for _, key := range kbfsKeys {
			if key.Generation() == int(generation) {
				return key, nil
			}
		}
		return res, NewDecryptionKeyNotFoundError(int(generation), kbfsEncrypted, public)
	}
	return team.ApplicationKeyAtGeneration(ctx, keybase1.TeamApplication_CHAT, generation)
}

// shouldFallbackToSlowLoadAfterFTLError returns trues if the given error should result
// in a retry via slow loading. Right now, it only happens if the server tells us
// that our FTL is outdated, or FTL is feature-flagged off on the server.
func shouldFallbackToSlowLoadAfterFTLError(m libkb.MetaContext, err error) bool {
	if err == nil {
		return false
	}
	switch tErr := err.(type) {
	case libkb.TeamFTLOutdatedError:
		m.CDebugf("Our FTL implementation is too old; falling back to slow loader (%v)", err)
		return true
	case libkb.FeatureFlagError:
		if tErr.Feature() == libkb.FeatureFTL {
			m.CDebugf("FTL feature-flagged off on the server, falling back to regular loader")
			return true
		}
	}
	return false
}

func encryptionKeyViaFTL(m libkb.MetaContext, name string, tlfID chat1.TLFID) (res types.CryptKey, ni types.NameInfo, err error) {
	ftlRes, err := getKeyViaFTL(m, name, tlfID, 0)
	if err != nil {
		return res, ni, err
	}
	ni = types.NameInfo{
		ID:            tlfID,
		CanonicalName: ftlRes.Name.String(),
	}
	return ftlRes.ApplicationKeys[0], ni, nil
}

func decryptionKeyViaFTL(m libkb.MetaContext, tlfID chat1.TLFID, keyGeneration int) (res types.CryptKey, err error) {

	// We don't pass a `name` during decryption.
	ftlRes, err := getKeyViaFTL(m, "" /*name*/, tlfID, keyGeneration)
	if err != nil {
		return nil, err
	}
	return ftlRes.ApplicationKeys[0], nil
}

func getKeyViaFTL(m libkb.MetaContext, name string, tlfID chat1.TLFID, keyGeneration int) (res keybase1.FastTeamLoadRes, err error) {
	defer m.CTrace(fmt.Sprintf("getKeyViaFTL(%s,%v,%d)", name, tlfID, keyGeneration), func() error { return err })()

	teamID, err := keybase1.TeamIDFromString(tlfID.String())
	if err != nil {
		return res, err
	}
	// The `name` parameter is optional since subteams can be renamed and
	// messages with the old name must be successfully decrypted.
	var teamNamePtr *keybase1.TeamName
	if name != "" {
		teamName, err := keybase1.TeamNameFromString(name)
		if err != nil {
			return res, err
		}
		teamNamePtr = &teamName
	}
	arg := keybase1.FastTeamLoadArg{
		ID:             teamID,
		Public:         false,
		Applications:   []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		AssertTeamName: teamNamePtr,
	}

	if keyGeneration > 0 {
		arg.KeyGenerationsNeeded = []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(keyGeneration)}
	} else {
		arg.NeedLatestKey = true
	}

	res, err = m.G().GetFastTeamLoader().Load(m, arg)
	if err != nil {
		return res, err
	}

	n := len(res.ApplicationKeys)
	if n != 1 {
		return res, NewFTLError(fmt.Sprintf("wrong number of keys back from FTL; wanted 1, but got %d", n))
	}

	if keyGeneration > 0 && res.ApplicationKeys[0].KeyGeneration != keybase1.PerTeamKeyGeneration(keyGeneration) {
		return res, NewFTLError(fmt.Sprintf("wrong generation back from FTL; wanted %d but got %d", keyGeneration, res.ApplicationKeys[0].KeyGeneration))
	}

	if res.ApplicationKeys[0].Application != keybase1.TeamApplication_CHAT {
		return res, NewFTLError(fmt.Sprintf("wrong application; wanted %d but got %d", keybase1.TeamApplication_CHAT, res.ApplicationKeys[0].Application))
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
			refreshers.NeedApplicationsAtGenerations = map[keybase1.PerTeamKeyGeneration][]keybase1.TeamApplication{
				keybase1.PerTeamKeyGeneration(keyGeneration): []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
			}
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

func (t *TeamLoader) validKBFSTLFID(tlfID chat1.TLFID, team *teams.Team) bool {
	tlfIDs := team.KBFSTLFIDs()
	for _, id := range tlfIDs {
		if tlfID.EqString(id) {
			return true
		}
	}
	return false
}

func (t *TeamLoader) validateImpTeamname(ctx context.Context, tlfName string, public bool,
	team *teams.Team) error {
	impTeamName, err := team.ImplicitTeamDisplayName(ctx)
	if err != nil {
		return err
	}
	if impTeamName.String() != tlfName {
		// Try resolving given name, maybe there has been a resolution
		resName, err := teams.ResolveImplicitTeamDisplayName(ctx, t.G(), tlfName, public)
		if err != nil {
			return err
		}
		if impTeamName.String() != resName.String() {
			return ImpteamBadteamError{
				Msg: fmt.Sprintf("mismatch TLF name to implicit team name: %s != %s (resname:%s)",
					impTeamName, tlfName, resName),
			}
		}
	}
	return nil
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
	case chat1.ConversationMembersType_TEAM:
		teamID, err := keybase1.TeamIDFromString(tlfID.String())
		if err != nil {
			return team, err
		}
		return teams.Load(ctx, t.G(), ltarg(teamID))
	case chat1.ConversationMembersType_IMPTEAMNATIVE:
		teamID, err := keybase1.TeamIDFromString(tlfID.String())
		if err != nil {
			return team, err
		}
		if team, err = teams.Load(ctx, t.G(), ltarg(teamID)); err != nil {
			return team, err
		}
		if err = t.validateImpTeamname(ctx, tlfName, public, team); err != nil {
			return team, err
		}
		return team, nil
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
			if !t.validKBFSTLFID(tlfID, team) {
				return ImpteamBadteamError{
					Msg: fmt.Sprintf("TLF ID not found in team: %s", tlfID),
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
		if err = t.validateImpTeamname(ctx, tlfName, public, team); err != nil {
			return team, err
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

func (t *TeamsNameInfoSource) LookupID(ctx context.Context, name string, public bool) (res types.NameInfo, err error) {
	defer t.Trace(ctx, func() error { return err }, fmt.Sprintf("LookupID(%s)", name))()

	teamName, err := keybase1.TeamNameFromString(name)
	if err != nil {
		return res, err
	}
	id, err := teams.ResolveNameToIDForceRefresh(ctx, t.G().ExternalG(), teamName)
	if err != nil {
		return res, err
	}
	tlfID, err := chat1.TeamIDToTLFID(id)
	if err != nil {
		return res, err
	}
	return types.NameInfo{
		ID:            tlfID,
		CanonicalName: teamName.String(),
	}, nil
}

func (t *TeamsNameInfoSource) LookupName(ctx context.Context, tlfID chat1.TLFID, public bool) (res types.NameInfo, err error) {
	defer t.Trace(ctx, func() error { return err }, fmt.Sprintf("LookupName(%s)", tlfID))()
	teamID, err := keybase1.TeamIDFromString(tlfID.String())
	if err != nil {
		return res, err
	}
	m := libkb.NewMetaContext(ctx, t.G().ExternalG())
	loadRes, err := m.G().GetFastTeamLoader().Load(m, keybase1.FastTeamLoadArg{
		ID:     teamID,
		Public: teamID.IsPublic(),
	})
	if err != nil {
		return res, err
	}
	return types.NameInfo{
		ID:            tlfID,
		CanonicalName: loadRes.Name.String(),
	}, nil
}

func (t *TeamsNameInfoSource) AllCryptKeys(ctx context.Context, name string, public bool) (res types.AllCryptKeys, err error) {
	defer t.Trace(ctx, func() error { return err }, "AllCryptKeys")()
	return res, errors.New("unable to list all crypt keys on teams name info source")
}

func (t *TeamsNameInfoSource) EncryptionKey(ctx context.Context, name string, teamID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (res types.CryptKey, ni types.NameInfo, err error) {
	defer t.Trace(ctx, func() error { return err },
		fmt.Sprintf("EncryptionKeys(%s,%s,%v)", name, teamID, public))()

	m := libkb.NewMetaContext(ctx, t.G().ExternalG())
	if !public && membersType == chat1.ConversationMembersType_TEAM && m.G().FeatureFlags.Enabled(m, libkb.FeatureFTL) {
		res, ni, err = encryptionKeyViaFTL(m, name, teamID)
		if shouldFallbackToSlowLoadAfterFTLError(m, err) {
			// Some FTL errors should not kill the whole operation; let's
			// clear them out and allow regular, slow loading to happen.
			// This is basically a server-side kill switch for some versions
			// of FTL, if we should determine they are buggy.
			err = nil
		} else {
			return res, ni, err
		}
	}

	team, err := t.loader.loadTeam(ctx, teamID, name, membersType, public, nil)
	if err != nil {
		return res, ni, err
	}
	if res, err = getTeamCryptKey(ctx, team, team.Generation(), public, false); err != nil {
		return res, ni, err
	}
	tlfID, err := chat1.TeamIDToTLFID(team.ID)
	if err != nil {
		return res, ni, err
	}
	return res, types.NameInfo{
		ID:            tlfID,
		CanonicalName: team.Name().String(),
	}, nil
}

func (t *TeamsNameInfoSource) DecryptionKey(ctx context.Context, name string, teamID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	keyGeneration int, kbfsEncrypted bool) (res types.CryptKey, err error) {
	defer t.Trace(ctx, func() error { return err },
		fmt.Sprintf("DecryptionKeys(%s,%s,%v,%d,%v)", name, teamID, public, keyGeneration, kbfsEncrypted))()

	m := libkb.NewMetaContext(ctx, t.G().ExternalG())
	if !kbfsEncrypted && !public && membersType == chat1.ConversationMembersType_TEAM &&
		m.G().FeatureFlags.Enabled(m, libkb.FeatureFTL) {
		res, err = decryptionKeyViaFTL(m, teamID, keyGeneration)
		if shouldFallbackToSlowLoadAfterFTLError(m, err) {
			// See comment above in EncryptionKey()
			err = nil
		} else {
			return res, err
		}
	}

	team, err := loadTeamForDecryption(ctx, t.loader, name, teamID, membersType, public,
		keyGeneration, kbfsEncrypted)
	if err != nil {
		return res, err
	}
	return getTeamCryptKey(ctx, team, keybase1.PerTeamKeyGeneration(keyGeneration), public,
		kbfsEncrypted)
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
	membersType chat1.ConversationMembersType, public bool,
	generation keybase1.EkGeneration, contentCtime *gregor1.Time) (teamEK keybase1.TeamEk, err error) {
	if public {
		return teamEK, NewPublicTeamEphemeralKeyError()
	}

	teamID, err := keybase1.TeamIDFromString(tlfID.String())
	if err != nil {
		return teamEK, err
	}
	return t.G().GetEKLib().GetTeamEK(ctx, teamID, generation, contentCtime)
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
		tmp := libkb.NewLoadUserByUIDArg(ctx, g, uvs[i].Uid).WithPublicKeyOptional()
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
	cb := make(chan struct{})
	go func(ctx context.Context) {
		res, err = t.Identify(ctx, names, true,
			func() keybase1.TLFID {
				return keybase1.TLFID(tlfID.String())
			},
			func() keybase1.CanonicalTlfName {
				return keybase1.CanonicalTlfName(impTeamName.String())
			})
		close(cb)
	}(BackgroundContext(ctx, t.G()))
	switch identBehavior {
	case keybase1.TLFIdentifyBehavior_CHAT_GUI:
		// For GUI mode, let's just let this identify roll in the background. We will be sending up
		// tracker breaks to the UI out of band with whatever chat operation has invoked us here.
		return nil, nil
	default:
		<-cb
		if err != nil {
			return res, err
		}
	}
	return res, nil
}

func (t *ImplicitTeamsNameInfoSource) transformTeamDoesNotExist(ctx context.Context, err error, name string) error {
	switch err.(type) {
	case nil:
		return nil
	case teams.TeamDoesNotExistError:
		return NewUnknownTLFNameError(name)
	default:
		t.Debug(ctx, "Lookup: error looking up the team: %v", err)
		return err
	}
}

func (t *ImplicitTeamsNameInfoSource) LookupID(ctx context.Context, name string, public bool) (res types.NameInfo, err error) {
	defer t.Trace(ctx, func() error { return err }, fmt.Sprintf("LookupID(%s)", name))()
	// check if name is prefixed
	if strings.HasPrefix(name, keybase1.ImplicitTeamPrefix) {
		return t.lookupInternalName(ctx, name, public)
	}

	// This is on the critical path of sends, so don't force a repoll.
	team, _, impTeamName, err := teams.LookupImplicitTeam(ctx, t.G().ExternalG(), name, public, teams.ImplicitTeamOptions{NoForceRepoll: true})
	if err != nil {
		return res, t.transformTeamDoesNotExist(ctx, err, name)
	}
	if !team.ID.IsRootTeam() {
		panic(fmt.Sprintf("implicit team found via LookupImplicitTeam not root team: %s", team.ID))
	}

	var tlfID chat1.TLFID
	if t.lookupUpgraded {
		tlfIDs := team.KBFSTLFIDs()
		if len(tlfIDs) > 0 {
			// We pull the first TLF ID here for this lookup since it has the highest chance of being
			// correct. The upgrade wrote a bunch of TLF IDs in over the last months, but it is possible
			// that KBFS can add more. All the upgrade TLFs should be ahead of them though, since if the
			// upgrade process encounters a team with a TLF ID already in there, it will abort if they
			// don't match.
			tlfID = tlfIDs[0].ToBytes()
		}
	} else {
		tlfID, err = chat1.TeamIDToTLFID(team.ID)
		if err != nil {
			return res, err
		}
	}
	res = types.NameInfo{
		ID:            tlfID,
		CanonicalName: impTeamName.String(),
	}
	if res.IdentifyFailures, err = t.identify(ctx, tlfID, impTeamName); err != nil {
		return res, err
	}
	return res, nil
}

func (t *ImplicitTeamsNameInfoSource) LookupName(ctx context.Context, tlfID chat1.TLFID, public bool) (res types.NameInfo, err error) {
	defer t.Trace(ctx, func() error { return err }, fmt.Sprintf("LookupName(%s)", tlfID))()
	teamID, err := keybase1.TeamIDFromString(tlfID.String())
	if err != nil {
		return res, err
	}
	team, err := teams.Load(ctx, t.G().ExternalG(), keybase1.LoadTeamArg{
		ID:     teamID,
		Public: public,
	})
	if err != nil {
		return res, err
	}
	impTeamName, err := team.ImplicitTeamDisplayName(ctx)
	if err != nil {
		return res, err
	}
	t.Debug(ctx, "LookupName: got name: %s", impTeamName.String())
	idFailures, err := t.identify(ctx, tlfID, impTeamName)
	if err != nil {
		return res, err
	}
	return types.NameInfo{
		ID:               tlfID,
		CanonicalName:    impTeamName.String(),
		IdentifyFailures: idFailures,
	}, nil
}

func (t *ImplicitTeamsNameInfoSource) AllCryptKeys(ctx context.Context, name string, public bool) (res types.AllCryptKeys, err error) {
	defer t.Trace(ctx, func() error { return err }, "AllCryptKeys")()
	return res, errors.New("unable to list all crypt keys in implicit team name info source")
}

func (t *ImplicitTeamsNameInfoSource) EncryptionKey(ctx context.Context, name string, teamID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (res types.CryptKey, ni types.NameInfo, err error) {
	defer t.Trace(ctx, func() error { return err },
		fmt.Sprintf("EncryptionKey(%s,%s,%v)", name, teamID, public))()
	team, err := t.loader.loadTeam(ctx, teamID, name, membersType, public, nil)
	if err != nil {
		return res, ni, err
	}
	impTeamName, err := team.ImplicitTeamDisplayName(ctx)
	if err != nil {
		return res, ni, err
	}
	idFailures, err := t.identify(ctx, teamID, impTeamName)
	if err != nil {
		return res, ni, err
	}
	if res, err = getTeamCryptKey(ctx, team, team.Generation(), public, false); err != nil {
		return res, ni, err
	}
	return res, types.NameInfo{
		ID:               teamID,
		CanonicalName:    impTeamName.String(),
		IdentifyFailures: idFailures,
	}, nil
}

func (t *ImplicitTeamsNameInfoSource) DecryptionKey(ctx context.Context, name string, teamID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	keyGeneration int, kbfsEncrypted bool) (res types.CryptKey, err error) {
	defer t.Trace(ctx, func() error { return err },
		fmt.Sprintf("DecryptionKey(%s,%s,%v,%d,%v)", name, teamID, public, keyGeneration, kbfsEncrypted))()
	team, err := loadTeamForDecryption(ctx, t.loader, name, teamID, membersType, public,
		keyGeneration, kbfsEncrypted)
	if err != nil {
		return res, err
	}
	impTeamName, err := team.ImplicitTeamDisplayName(ctx)
	if err != nil {
		return res, err
	}
	if _, err = t.identify(ctx, teamID, impTeamName); err != nil {
		return res, err
	}
	return getTeamCryptKey(ctx, team, keybase1.PerTeamKeyGeneration(keyGeneration), public,
		kbfsEncrypted)
}

func (t *ImplicitTeamsNameInfoSource) ephemeralLoadAndIdentify(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (teamID keybase1.TeamID, err error) {
	if public {
		return teamID, NewPublicTeamEphemeralKeyError()
	}
	team, err := t.loader.loadTeam(ctx, tlfID, tlfName, membersType, public, nil)
	if err != nil {
		return teamID, err
	}
	impTeamName, err := team.ImplicitTeamDisplayName(ctx)
	if err != nil {
		return teamID, err
	}
	if _, err := t.identify(ctx, tlfID, impTeamName); err != nil {
		return teamID, err
	}
	return team.ID, nil
}

func (t *ImplicitTeamsNameInfoSource) EphemeralEncryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (teamEK keybase1.TeamEk, err error) {
	teamID, err := t.ephemeralLoadAndIdentify(ctx, tlfName, tlfID, membersType, public)
	if err != nil {
		return teamEK, err
	}
	return t.G().GetEKLib().GetOrCreateLatestTeamEK(ctx, teamID)
}

func (t *ImplicitTeamsNameInfoSource) EphemeralDecryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	generation keybase1.EkGeneration, contentCtime *gregor1.Time) (teamEK keybase1.TeamEk, err error) {
	teamID, err := t.ephemeralLoadAndIdentify(ctx, tlfName, tlfID, membersType, public)
	if err != nil {
		return teamEK, err
	}
	return t.G().GetEKLib().GetTeamEK(ctx, teamID, generation, contentCtime)
}

func (t *ImplicitTeamsNameInfoSource) ShouldPairwiseMAC(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (bool, []keybase1.KID, error) {
	return shouldPairwiseMAC(ctx, t.G(), t.loader, tlfName, tlfID, membersType, public)
}

func (t *ImplicitTeamsNameInfoSource) lookupInternalName(ctx context.Context, name string, public bool) (res types.NameInfo, err error) {
	team, err := teams.Load(ctx, t.G().ExternalG(), keybase1.LoadTeamArg{
		Name:   name,
		Public: public,
	})
	if err != nil {
		return res, err
	}
	res.CanonicalName = team.Name().String()
	if res.ID, err = chat1.TeamIDToTLFID(team.ID); err != nil {
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

func (t *tlfIDToTeamIDMap) LookupTLFID(ctx context.Context, teamID keybase1.TeamID, api libkb.API) (res chat1.TLFID, err error) {
	if iTLFID, ok := t.storage.Get(teamID.String()); ok {
		return iTLFID.(chat1.TLFID), nil
	}
	arg := libkb.NewAPIArgWithNetContext(ctx, "team/tlfid")
	arg.Args = libkb.NewHTTPArgs()
	arg.Args.Add("team_id", libkb.S{Val: teamID.String()})
	arg.SessionType = libkb.APISessionTypeREQUIRED
	apiRes, err := api.Get(arg)
	if err != nil {
		return res, err
	}
	st, err := apiRes.Body.AtKey("tlf_id").GetString()
	if err != nil {
		return res, err
	}
	tlfID, err := chat1.MakeTLFID(st)
	if err != nil {
		return res, err
	}
	t.storage.Add(teamID.String(), tlfID)
	return tlfID, nil
}

var tlfIDToTeamID = newTlfIDToTeamIDMap()
