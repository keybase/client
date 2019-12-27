package chat

import (
	"errors"
	"fmt"
	"strings"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teambot"
	"github.com/keybase/client/go/teams"
	context "golang.org/x/net/context"
)

func getTeamCryptKey(mctx libkb.MetaContext, team *teams.Team, generation keybase1.PerTeamKeyGeneration,
	public, kbfsEncrypted bool, botUID *gregor1.UID, forEncryption bool) (res types.CryptKey, err error) {
	if public {
		return publicCryptKey, nil
	}

	if teambot.CurrentUserIsBot(mctx, botUID) {
		if kbfsEncrypted {
			return res, fmt.Errorf("TeambotKeys not supported by KBFS")
		}
		keyer := mctx.G().GetTeambotBotKeyer()
		if forEncryption {
			return keyer.GetLatestTeambotKey(mctx, team.ID, keybase1.TeamApplication_CHAT)
		}
		return keyer.GetTeambotKeyAtGeneration(mctx, team.ID, keybase1.TeamApplication_CHAT, keybase1.TeambotKeyGeneration(generation))
	}

	if kbfsEncrypted {
		if botUID != nil {
			return res, fmt.Errorf("TeambotKeys not supported by KBFS")
		}
		kbfsKeys := team.KBFSCryptKeys(mctx.Ctx(), keybase1.TeamApplication_CHAT)
		for _, key := range kbfsKeys {
			if key.Generation() == int(generation) {
				return key, nil
			}
		}
		return res, NewDecryptionKeyNotFoundError(int(generation), kbfsEncrypted, public)
	}

	appKey, err := team.ChatKeyAtGeneration(mctx.Ctx(), generation)
	if err != nil {
		return res, err
	}

	// Need to convert this key in to a TeambotKey
	if botUID != nil {
		res, _, err = mctx.G().GetTeambotMemberKeyer().GetOrCreateTeambotKey(
			mctx, team.ID, *botUID, appKey)
		return res, err
	}
	return appKey, nil
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
		m.Debug("Our FTL implementation is too old; falling back to slow loader (%v)", err)
		return true
	case libkb.FeatureFlagError:
		if tErr.Feature() == libkb.FeatureFTL {
			m.Debug("FTL feature-flagged off on the server, falling back to regular loader")
			return true
		}
	}
	return false
}

func encryptionKeyViaFTL(m libkb.MetaContext, name string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType) (res types.CryptKey, ni types.NameInfo, err error) {
	ftlRes, err := getKeyViaFTL(m, name, tlfID, membersType, 0)
	if err != nil {
		return res, ni, err
	}
	ni = types.NameInfo{
		ID:            tlfID,
		CanonicalName: ftlRes.Name.String(),
	}
	return ftlRes.ApplicationKeys[0], ni, nil
}

func decryptionKeyViaFTL(m libkb.MetaContext, tlfID chat1.TLFID, membersType chat1.ConversationMembersType,
	keyGeneration int) (res types.CryptKey, err error) {

	// We don't pass a `name` during decryption.
	ftlRes, err := getKeyViaFTL(m, "" /*name*/, tlfID, membersType, keyGeneration)
	if err != nil {
		return nil, err
	}
	return ftlRes.ApplicationKeys[0], nil
}

func getKeyViaFTL(mctx libkb.MetaContext, name string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, keyGeneration int) (res keybase1.FastTeamLoadRes, err error) {
	defer mctx.Trace(fmt.Sprintf("getKeyViaFTL(%s,%v,%d)", name, tlfID, keyGeneration), func() error { return err })()
	var teamID keybase1.TeamID
	switch membersType {
	case chat1.ConversationMembersType_TEAM,
		chat1.ConversationMembersType_IMPTEAMNATIVE:
		teamID, err = keybase1.TeamIDFromString(tlfID.String())
		if err != nil {
			return res, err
		}
	case chat1.ConversationMembersType_IMPTEAMUPGRADE:
		teamID, err = tlfIDToTeamID.Lookup(mctx, tlfID, mctx.G().API)
		if err != nil {
			return res, err
		}
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

	res, err = mctx.G().GetFastTeamLoader().Load(mctx, arg)
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

func loadTeamForDecryption(mctx libkb.MetaContext, loader *TeamLoader, name string, teamID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	keyGeneration int, kbfsEncrypted bool, botUID *gregor1.UID) (*teams.Team, error) {

	var refreshers keybase1.TeamRefreshers
	if !public && !teambot.CurrentUserIsBot(mctx, botUID) {
		// Only need keys for private teams.
		if !kbfsEncrypted {
			refreshers.NeedApplicationsAtGenerations = map[keybase1.PerTeamKeyGeneration][]keybase1.TeamApplication{
				keybase1.PerTeamKeyGeneration(keyGeneration): {keybase1.TeamApplication_CHAT},
			}
		} else {
			refreshers.NeedKBFSKeyGeneration = keybase1.TeamKBFSKeyRefresher{
				Generation: keyGeneration,
				AppType:    keybase1.TeamApplication_CHAT,
			}
		}
	}
	team, err := loader.loadTeam(mctx.Ctx(), teamID, name, membersType, public,
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
	impTeamName, err := team.ImplicitTeamDisplayNameNoConflicts(ctx)
	if err != nil {
		return err
	}
	if impTeamName.String() != tlfName {
		// Try resolving both the tlf name, and the team we loaded
		resImpName, err := teams.ResolveImplicitTeamDisplayName(ctx, t.G(), impTeamName.String(), public)
		if err != nil {
			return err
		}
		resTlfName, err := teams.ResolveImplicitTeamDisplayName(ctx, t.G(), tlfName, public)
		if err != nil {
			return err
		}
		if resImpName.String() != resTlfName.String() {
			return ImpteamBadteamError{
				Msg: fmt.Sprintf("mismatch TLF name to implicit team name: %s != %s (%s != %s)",
					impTeamName, tlfName, resImpName, resTlfName),
			}
		}
	}
	return nil
}

func (t *TeamLoader) loadTeam(ctx context.Context, tlfID chat1.TLFID,
	tlfName string, membersType chat1.ConversationMembersType, public bool,
	loadTeamArgOverride func(keybase1.TeamID) keybase1.LoadTeamArg) (team *teams.Team, err error) {
	mctx := libkb.NewMetaContext(ctx, t.G())
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
	case chat1.ConversationMembersType_TEAM,
		chat1.ConversationMembersType_IMPTEAMNATIVE:
		teamID, err := keybase1.TeamIDFromString(tlfID.String())
		if err != nil {
			return nil, err
		}
		return teams.Load(ctx, t.G(), ltarg(teamID))
	case chat1.ConversationMembersType_IMPTEAMUPGRADE:
		teamID, err := tlfIDToTeamID.Lookup(mctx, tlfID, t.G().API)
		if err != nil {
			return nil, err
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
			mctx.Debug("loadTeam: failed to load the team: err: %s", err)
			if IsOfflineError(err) == OfflineErrorKindOnline {
				// try again on bad team, might have had an old team cached
				mctx.Debug("loadTeam: non-offline error, trying again: %s", err)
				if err = loadAttempt(true); err != nil {
					return nil, err
				}
			} else {
				//generic error we bail out
				return nil, err
			}
		}
		// In upgraded implicit teams, make sure to check that tlfName matches
		// team display name.
		if err := t.validateImpTeamname(ctx, tlfName, public, team); err != nil {
			return nil, err
		}
		return team, nil
	}
	return nil, fmt.Errorf("invalid impteam members type: %v", membersType)
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
	id, err := teams.ResolveNameToID(ctx, t.G().ExternalG(), teamName)
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

func (t *TeamsNameInfoSource) LookupName(ctx context.Context, tlfID chat1.TLFID, public bool,
	unverifiedTLFName string) (res types.NameInfo, err error) {
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

func (t *TeamsNameInfoSource) TeamBotSettings(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (map[keybase1.UserVersion]keybase1.TeamBotSettings, error) {
	team, err := NewTeamLoader(t.G().ExternalG()).loadTeam(ctx, tlfID, tlfName, membersType, public, nil)
	if err != nil {
		return nil, err
	}
	return team.TeamBotSettings()
}

func (t *TeamsNameInfoSource) AllCryptKeys(ctx context.Context, name string, public bool) (res types.AllCryptKeys, err error) {
	defer t.Trace(ctx, func() error { return err }, "AllCryptKeys")()
	return res, errors.New("unable to list all crypt keys on teams name info source")
}

func (t *TeamsNameInfoSource) EncryptionKey(ctx context.Context, name string, teamID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool, botUID *gregor1.UID) (res types.CryptKey, ni types.NameInfo, err error) {
	defer t.Trace(ctx, func() error { return err },
		fmt.Sprintf("EncryptionKey(%s,%s,%v,%v)", name, teamID, public, botUID))()

	mctx := libkb.NewMetaContext(ctx, t.G().ExternalG())
	if botUID == nil && !public &&
		mctx.G().FeatureFlags.Enabled(mctx, libkb.FeatureFTL) {
		res, ni, err = encryptionKeyViaFTL(mctx, name, teamID, membersType)
		if shouldFallbackToSlowLoadAfterFTLError(mctx, err) {
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
	if res, err = getTeamCryptKey(mctx, team, team.Generation(), public, false, /* kbfsEncrypted */
		botUID, true /* forEncryption */); err != nil {
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
	keyGeneration int, kbfsEncrypted bool, botUID *gregor1.UID) (res types.CryptKey, err error) {
	defer t.Trace(ctx, func() error { return err },
		fmt.Sprintf("DecryptionKey(%s,%s,%v,%d,%v,%v)", name, teamID, public,
			keyGeneration, kbfsEncrypted, botUID))()

	mctx := libkb.NewMetaContext(ctx, t.G().ExternalG())
	if botUID == nil && !kbfsEncrypted && !public &&
		mctx.G().FeatureFlags.Enabled(mctx, libkb.FeatureFTL) {
		res, err = decryptionKeyViaFTL(mctx, teamID, membersType, keyGeneration)
		if shouldFallbackToSlowLoadAfterFTLError(mctx, err) {
			// See comment above in EncryptionKey()
			err = nil
		} else {
			return res, err
		}
	}

	team, err := loadTeamForDecryption(mctx, t.loader, name, teamID, membersType, public,
		keyGeneration, kbfsEncrypted, botUID)
	if err != nil {
		return res, err
	}
	return getTeamCryptKey(mctx, team, keybase1.PerTeamKeyGeneration(keyGeneration), public,
		kbfsEncrypted, botUID, false /* forEncryption */)
}

func (t *TeamsNameInfoSource) EphemeralEncryptionKey(mctx libkb.MetaContext, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool, botUID *gregor1.UID) (ek types.EphemeralCryptKey, err error) {
	if public {
		return ek, NewPublicTeamEphemeralKeyError()
	}

	teamID, err := keybase1.TeamIDFromString(tlfID.String())
	if err != nil {
		return ek, err
	}
	if botUID != nil {
		ek, _, err = t.G().GetEKLib().GetOrCreateLatestTeambotEK(mctx, teamID, *botUID)
	} else {
		ek, _, err = t.G().GetEKLib().GetOrCreateLatestTeamEK(mctx, teamID)
	}
	return ek, err
}

func (t *TeamsNameInfoSource) EphemeralDecryptionKey(mctx libkb.MetaContext, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool, botUID *gregor1.UID,
	generation keybase1.EkGeneration, contentCtime *gregor1.Time) (ek types.EphemeralCryptKey, err error) {
	if public {
		return ek, NewPublicTeamEphemeralKeyError()
	}

	teamID, err := keybase1.TeamIDFromString(tlfID.String())
	if err != nil {
		return ek, err
	}
	if botUID != nil {
		return t.G().GetEKLib().GetTeambotEK(mctx, teamID, *botUID, generation, contentCtime)
	}
	return t.G().GetEKLib().GetTeamEK(mctx, teamID, generation, contentCtime)
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

	processResult := func(i int, upak *keybase1.UserPlusKeysV2AllIncarnations) error {
		if upak == nil {
			return nil
		}
		for _, key := range upak.Current.DeviceKeys {
			// Include only unrevoked encryption keys.
			if !key.Base.IsSibkey && key.Base.Revocation == nil {
				ret = append(ret, key.Base.Kid)
			}
		}
		return nil
	}

	err = g.GetUPAKLoader().Batcher(ctx, getArg, processResult, nil, 0)
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

	loader      *TeamLoader
	membersType chat1.ConversationMembersType
}

func NewImplicitTeamsNameInfoSource(g *globals.Context, membersType chat1.ConversationMembersType) *ImplicitTeamsNameInfoSource {
	return &ImplicitTeamsNameInfoSource{
		Contextified:   globals.NewContextified(g),
		DebugLabeler:   utils.NewDebugLabeler(g.GetLog(), "ImplicitTeamsNameInfoSource", false),
		NameIdentifier: NewNameIdentifier(g),
		loader:         NewTeamLoader(g.ExternalG()),
		membersType:    membersType,
	}
}

func (t *ImplicitTeamsNameInfoSource) lookupUpgraded() bool {
	return t.membersType == chat1.ConversationMembersType_IMPTEAMUPGRADE
}

// Identify participants of a conv.
// Returns as if all IDs succeeded if ctx is in TLFIdentifyBehavior_CHAT_GUI mode.
func (t *ImplicitTeamsNameInfoSource) identify(ctx context.Context, team *teams.Team, impTeamName keybase1.ImplicitTeamDisplayName) (err error) {
	var names []string
	names = append(names, impTeamName.Writers.KeybaseUsers...)
	names = append(names, impTeamName.Readers.KeybaseUsers...)

	// identify the members in the conversation
	identBehavior, _, ok := globals.CtxIdentifyMode(ctx)
	defer t.Trace(ctx, func() error { return err }, fmt.Sprintf("identify(%s, %v)", impTeamName.String(), identBehavior))()
	if !ok {
		return errors.New("invalid context with no chat metadata")
	}
	cb := make(chan struct{})
	go func(ctx context.Context) {
		var idFails []keybase1.TLFIdentifyFailure
		idFails, err = t.Identify(ctx, names, true,
			func() keybase1.TLFID {
				return keybase1.TLFID(team.ID.String())
			},
			func() keybase1.CanonicalTlfName {
				return keybase1.CanonicalTlfName(impTeamName.String())
			})
		if err != nil || len(idFails) > 0 {
			t.Debug(ctx, "identify failed err=%v fails=%+v", err, idFails)
		}
		// ignore idFails
		close(cb)
	}(globals.BackgroundChatCtx(ctx, t.G()))
	switch identBehavior {
	case keybase1.TLFIdentifyBehavior_CHAT_GUI:
		// For GUI mode, let the full IDs roll in the background. We will be sending up
		// tracker breaks to the UI out of band with whatever chat operation has invoked us here.

		// CORE-10522 peg breaks will need to block sending for non-gui mode too.
		//            Peg breaks could count as track breaks for real Identify.
		//            That could nicely cover other applications besides chat. But the UI
		//            for fixing track breaks doesn't quite make sense for peg breaks.

		// But check reset-pegs on the critical path.
		for _, uv := range team.AllUserVersions(ctx) {
			err = t.G().Pegboard.CheckUV(t.MetaContext(ctx), uv)
			if err != nil {
				// Turn peg failures into identify failures
				t.Debug(ctx, "pegboard rejected %v: %v", uv, err)
				return fmt.Errorf("A user may have reset: %v", err)
			}
		}
		return nil
	default:
		<-cb
		return err
	}
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
	if t.lookupUpgraded() {
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
	return res, nil
}

func (t *ImplicitTeamsNameInfoSource) LookupName(ctx context.Context, tlfID chat1.TLFID, public bool,
	unverifiedTLFName string) (res types.NameInfo, err error) {
	defer t.Trace(ctx, func() error { return err }, fmt.Sprintf("LookupName(%s)", tlfID))()
	team, err := t.loader.loadTeam(ctx, tlfID, unverifiedTLFName, t.membersType, public, nil)
	if err != nil {
		return res, err
	}
	impTeamName, err := team.ImplicitTeamDisplayNameNoConflicts(ctx)
	if err != nil {
		return res, err
	}
	t.Debug(ctx, "LookupName: got name: %s", impTeamName.String())
	members, err := team.Members()
	if err != nil {
		return res, err
	}
	var verifiedMembers []gregor1.UID
	for _, member := range members.AllUIDs() {
		verifiedMembers = append(verifiedMembers, gregor1.UID(member.ToBytes()))
	}
	return types.NameInfo{
		ID:              tlfID,
		CanonicalName:   impTeamName.String(),
		VerifiedMembers: verifiedMembers,
	}, nil
}

func (t *ImplicitTeamsNameInfoSource) TeamBotSettings(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (map[keybase1.UserVersion]keybase1.TeamBotSettings, error) {
	team, err := NewTeamLoader(t.G().ExternalG()).loadTeam(ctx, tlfID, tlfName, membersType, public, nil)
	if err != nil {
		return nil, err
	}
	return team.TeamBotSettings()
}

func (t *ImplicitTeamsNameInfoSource) AllCryptKeys(ctx context.Context, name string, public bool) (res types.AllCryptKeys, err error) {
	defer t.Trace(ctx, func() error { return err }, "AllCryptKeys")()
	return res, errors.New("unable to list all crypt keys in implicit team name info source")
}

func (t *ImplicitTeamsNameInfoSource) EncryptionKey(ctx context.Context, name string, teamID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	botUID *gregor1.UID) (res types.CryptKey, ni types.NameInfo, err error) {
	defer t.Trace(ctx, func() error { return err },
		fmt.Sprintf("EncryptionKey(%s,%s,%v,%v)", name, teamID, public, botUID))()

	team, err := t.loader.loadTeam(ctx, teamID, name, membersType, public, nil)
	if err != nil {
		return res, ni, err
	}
	impTeamName, err := team.ImplicitTeamDisplayNameNoConflicts(ctx)
	if err != nil {
		return res, ni, err
	}
	if err := t.identify(ctx, team, impTeamName); err != nil {
		return res, ni, err
	}

	mctx := libkb.NewMetaContext(ctx, t.G().ExternalG())
	if res, err = getTeamCryptKey(mctx, team, team.Generation(), public, false, /* kbfsEncrypted */
		botUID, true /* forEncryption */); err != nil {
		return res, ni, err
	}
	return res, types.NameInfo{
		ID:            teamID,
		CanonicalName: impTeamName.String(),
	}, nil
}

func (t *ImplicitTeamsNameInfoSource) DecryptionKey(ctx context.Context, name string, teamID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	keyGeneration int, kbfsEncrypted bool, botUID *gregor1.UID) (res types.CryptKey, err error) {
	defer t.Trace(ctx, func() error { return err },
		fmt.Sprintf("DecryptionKey(%s,%s,%v,%d,%v,%v)", name, teamID, public, keyGeneration, kbfsEncrypted, botUID))()
	mctx := libkb.NewMetaContext(ctx, t.G().ExternalG())

	if botUID == nil && !kbfsEncrypted && !public &&
		mctx.G().FeatureFlags.Enabled(mctx, libkb.FeatureFTL) {
		res, err = decryptionKeyViaFTL(mctx, teamID, membersType, keyGeneration)
		if shouldFallbackToSlowLoadAfterFTLError(mctx, err) {
			// See comment above in EncryptionKey()
			err = nil
		} else {
			return res, err
		}
	}

	team, err := loadTeamForDecryption(mctx, t.loader, name, teamID, membersType, public,
		keyGeneration, kbfsEncrypted, botUID)
	if err != nil {
		return res, err
	}
	impTeamName, err := team.ImplicitTeamDisplayNameNoConflicts(ctx)
	if err != nil {
		return res, err
	}
	if err := t.identify(ctx, team, impTeamName); err != nil {
		return res, err
	}
	return getTeamCryptKey(mctx, team, keybase1.PerTeamKeyGeneration(keyGeneration), public,
		kbfsEncrypted, botUID, false /* forEncryption */)
}

func (t *ImplicitTeamsNameInfoSource) ephemeralLoadAndIdentify(ctx context.Context, encrypting bool, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (teamID keybase1.TeamID, err error) {
	if public {
		return teamID, NewPublicTeamEphemeralKeyError()
	}
	team, err := t.loader.loadTeam(ctx, tlfID, tlfName, membersType, public, nil)
	if err != nil {
		return teamID, err
	}
	impTeamName, err := team.ImplicitTeamDisplayNameNoConflicts(ctx)
	if err != nil {
		return teamID, err
	}
	if err := t.identify(ctx, team, impTeamName); err != nil {
		return teamID, err
	}
	return team.ID, nil
}

func (t *ImplicitTeamsNameInfoSource) EphemeralEncryptionKey(mctx libkb.MetaContext, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool, botUID *gregor1.UID) (ek types.EphemeralCryptKey, err error) {
	teamID, err := t.ephemeralLoadAndIdentify(mctx.Ctx(), true, tlfName, tlfID, membersType, public)
	if err != nil {
		return ek, err
	}
	if botUID != nil {
		ek, _, err = t.G().GetEKLib().GetOrCreateLatestTeambotEK(mctx, teamID, *botUID)
	} else {
		ek, _, err = t.G().GetEKLib().GetOrCreateLatestTeamEK(mctx, teamID)
	}
	return ek, err
}

func (t *ImplicitTeamsNameInfoSource) EphemeralDecryptionKey(mctx libkb.MetaContext, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool, botUID *gregor1.UID,
	generation keybase1.EkGeneration, contentCtime *gregor1.Time) (teamEK types.EphemeralCryptKey, err error) {
	teamID, err := t.ephemeralLoadAndIdentify(mctx.Ctx(), false, tlfName, tlfID, membersType, public)
	if err != nil {
		return teamEK, err
	}
	if botUID != nil {
		return t.G().GetEKLib().GetTeambotEK(mctx, teamID, *botUID, generation, contentCtime)
	}
	return t.G().GetEKLib().GetTeamEK(mctx, teamID, generation, contentCtime)
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

func TLFIDToTeamID(tlfID chat1.TLFID) (keybase1.TeamID, error) {
	return keybase1.TeamIDFromString(tlfID.String())
}

// Lookup gives the server trust mapping between tlfID and teamID
func (t *tlfIDToTeamIDMap) Lookup(mctx libkb.MetaContext, tlfID chat1.TLFID, api libkb.API) (res keybase1.TeamID, err error) {
	if iTeamID, ok := t.storage.Get(tlfID.String()); ok {
		return iTeamID.(keybase1.TeamID), nil
	}
	arg := libkb.NewAPIArg("team/id")
	arg.Args = libkb.NewHTTPArgs()
	arg.Args.Add("tlf_id", libkb.S{Val: tlfID.String()})
	arg.SessionType = libkb.APISessionTypeREQUIRED
	apiRes, err := api.Get(mctx, arg)
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

func (t *tlfIDToTeamIDMap) LookupTLFID(mctx libkb.MetaContext, teamID keybase1.TeamID, api libkb.API) (res chat1.TLFID, err error) {
	if iTLFID, ok := t.storage.Get(teamID.String()); ok {
		return iTLFID.(chat1.TLFID), nil
	}
	arg := libkb.NewAPIArg("team/tlfid")
	arg.Args = libkb.NewHTTPArgs()
	arg.Args.Add("team_id", libkb.S{Val: teamID.String()})
	arg.SessionType = libkb.APISessionTypeREQUIRED
	apiRes, err := api.Get(mctx, arg)
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
