package teams

import (
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

func CreateImplicitTeam(ctx context.Context, g *libkb.GlobalContext, impTeam keybase1.ImplicitTeamDisplayName) (res keybase1.TeamID, teamName keybase1.TeamName, err error) {
	defer g.CTrace(ctx, "CreateImplicitTeam", func() error { return err })()

	teamName, err = NewImplicitTeamName()
	if err != nil {
		return res, teamName, err
	}
	teamID := teamName.ToTeamID(impTeam.IsPublic)

	perUserKeyUpgradeSoft(ctx, g, "create-implicit-team")

	me, err := loadMeForSignatures(ctx, g)
	if err != nil {
		return res, teamName, err
	}

	// Load all the Keybase users
	loadUsernameList := func(usernames []string) (res []*keybase1.UserPlusKeysV2, err error) {
		for _, username := range usernames {
			arg := libkb.NewLoadUserArg(g).WithName(username).WithNetContext(ctx).WithPublicKeyOptional()
			upak, _, err := g.GetUPAKLoader().LoadV2(arg)
			if err != nil {
				g.Log.CDebugf(ctx, "CreateImplicitTeam: failed to load user: %s msg: %s", username, err)
				return res, err
			}
			res = append(res, &upak.Current)
		}
		return res, nil
	}

	ownerUPAKs, err := loadUsernameList(impTeam.Writers.KeybaseUsers)
	if err != nil {
		return res, teamName, err
	}
	readerUPAKs, err := loadUsernameList(impTeam.Readers.KeybaseUsers)
	if err != nil {
		return res, teamName, err
	}

	var owners []SCTeamMember
	var readers []SCTeamMember
	var ownerInvites []SCTeamInvite
	var readerInvites []SCTeamInvite

	// Form secret boxes and make invites for KB users with no PUKs
	secretboxRecipients := make(map[keybase1.UserVersion]keybase1.PerUserKey)

	// Form secret boxes for KB users with PUKs, and invites for those without
	for _, upak := range ownerUPAKs {
		uv := upak.ToUserVersion()
		puk := upak.GetLatestPerUserKey()
		if puk == nil {
			// Add this person as an invite if they do not have a puk
			ownerInvites = append(ownerInvites, SCTeamInvite{
				Type: "keybase",
				Name: uv.TeamInviteName(),
				ID:   NewInviteID(),
			})
		} else {
			secretboxRecipients[uv] = *puk
			owners = append(owners, SCTeamMember(uv))
		}
	}
	for _, upak := range readerUPAKs {
		uv := upak.ToUserVersion()
		puk := upak.GetLatestPerUserKey()
		if puk == nil {
			// Add this person as an invite if they do not have a puk
			readerInvites = append(readerInvites, SCTeamInvite{
				Type: "keybase",
				Name: uv.TeamInviteName(),
				ID:   NewInviteID(),
			})
		} else {
			secretboxRecipients[uv] = *puk
			readers = append(readers, SCTeamMember(uv))
		}
	}

	members := SCTeamMembers{
		Owners:  &[]SCTeamMember{},
		Admins:  &[]SCTeamMember{},
		Writers: &[]SCTeamMember{},
		Readers: &[]SCTeamMember{},
	}
	if len(owners) > 0 {
		members.Owners = &owners
	}
	if len(readers) > 0 {
		members.Readers = &readers
	}

	// Add invites for assertions
	for _, assertion := range impTeam.Writers.UnresolvedUsers {
		ownerInvites = append(ownerInvites, SCTeamInvite{
			Type: assertion.TeamInviteType(),
			Name: assertion.TeamInviteName(),
			ID:   NewInviteID(),
		})
	}
	for _, assertion := range impTeam.Readers.UnresolvedUsers {
		readerInvites = append(readerInvites, SCTeamInvite{
			Type: assertion.TeamInviteType(),
			Name: assertion.TeamInviteName(),
			ID:   NewInviteID(),
		})
	}

	invites := &SCTeamInvites{
		Owners:  nil,
		Admins:  nil,
		Writers: nil,
		Readers: nil,
	}
	if len(ownerInvites) > 0 {
		invites.Owners = &ownerInvites
	}
	if len(readerInvites) > 0 {
		invites.Readers = &readerInvites
	}

	// Post the team
	return teamID, teamName,
		makeSigAndPostRootTeam(ctx, g, me, members, invites, secretboxRecipients, teamName.String(),
			teamID, impTeam.IsPublic, true, nil)
}

func makeSigAndPostRootTeam(ctx context.Context, g *libkb.GlobalContext, me libkb.UserForSignatures, members SCTeamMembers,
	invites *SCTeamInvites, secretboxRecipients map[keybase1.UserVersion]keybase1.PerUserKey, name string,
	teamID keybase1.TeamID, public, implicit bool, settings *SCTeamSettings) (err error) {
	defer g.Trace("makeSigAndPostRootTeam", func() error { return err })()
	g.Log.CDebugf(ctx, "makeSigAndPostRootTeam get device keys")
	deviceSigningKey, err := g.ActiveDevice.SigningKey()
	if err != nil {
		return err
	}
	deviceEncryptionKey, err := g.ActiveDevice.EncryptionKey()
	if err != nil {
		return err
	}

	// These boxes will get posted along with the sig below.
	m, err := NewTeamKeyManager(g)
	if err != nil {
		return err
	}
	secretboxes, err := m.SharedSecretBoxes(libkb.NewMetaContext(ctx, g), deviceEncryptionKey, secretboxRecipients)
	if err != nil {
		return err
	}

	perTeamSigningKey, err := m.SigningKey()
	if err != nil {
		return err
	}
	perTeamEncryptionKey, err := m.EncryptionKey()
	if err != nil {
		return err
	}

	g.Log.CDebugf(ctx, "makeSigAndPostRootTeam make sigs")
	teamSection, err := makeRootTeamSection(name, teamID, members, invites, perTeamSigningKey.GetKID(),
		perTeamEncryptionKey.GetKID(), public, implicit, settings)
	if err != nil {
		return err
	}

	// At this point the team section has every field filled out except the
	// reverse sig. Now we'll wrap it into a full sig, marshal it to JSON, and
	// sign it, *twice*. The first time with the per-team signing key, to
	// produce the reverse sig, and the second time with the device signing
	// key, after the reverse sig has been written in.
	sigBodyBeforeReverse, err := TeamRootSig(g, me, deviceSigningKey, teamSection)
	if err != nil {
		return err
	}

	// Note that this (sigchain-v1-style) reverse sig is made with the derived *per-team* signing key.
	reverseSig, _, _, err := libkb.SignJSON(sigBodyBeforeReverse, perTeamSigningKey)
	if err != nil {
		return err
	}

	// Update the team section to include the reverse sig, sign it again, and
	// make a sigchain-v2-style sig out of it. Doing it this way, instead of
	// generating it twice with different parameters, makes it less likely to
	// accidentally capture different global state (like ctime and merkle
	// seqno).
	sigBodyAfterReverse := sigBodyBeforeReverse
	sigBodyAfterReverse.SetValueAtPath("body.team.per_team_key.reverse_sig", jsonw.NewString(reverseSig))

	sigJSONAfterReverse, err := sigBodyAfterReverse.Marshal()
	if err != nil {
		return err
	}
	seqType := seqTypeForTeamPublicness(public)
	hPrevInfo := libkb.NewInitialHPrevInfo()
	v2Sig, _, _, err := libkb.MakeSigchainV2OuterSig(
		deviceSigningKey,
		libkb.LinkTypeTeamRoot,
		1, /* seqno */
		sigJSONAfterReverse,
		nil, /* prevLinkID */
		libkb.SigHasRevokes(false),
		seqType,
		libkb.SigIgnoreIfUnsupported(false),
		&hPrevInfo,
	)
	if err != nil {
		return err
	}

	sigMultiItem := libkb.SigMultiItem{
		Sig:        v2Sig,
		SigningKID: deviceSigningKey.GetKID(),
		Type:       string(libkb.LinkTypeTeamRoot),
		SeqType:    seqType,
		SigInner:   string(sigJSONAfterReverse),
		TeamID:     teamID,
		PublicKeys: &libkb.SigMultiItemPublicKeys{
			Encryption: perTeamEncryptionKey.GetKID(),
			Signing:    perTeamSigningKey.GetKID(),
		},
	}

	err = precheckLinkToPost(ctx, g, sigMultiItem, nil, me.ToUserVersion())
	if err != nil {
		g.Log.CDebugf(ctx, "cannot post link (precheck): %v", err)
		return err
	}

	g.Log.CDebugf(ctx, "makeSigAndPostRootTeam post sigs")
	payload := make(libkb.JSONPayload)
	payload["sigs"] = []interface{}{sigMultiItem}
	payload["per_team_key"] = secretboxes

	_, err = g.API.PostJSON(libkb.APIArg{
		NetContext:  ctx,
		Endpoint:    "sig/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	})
	if err != nil {
		return err
	}
	g.Log.CDebugf(ctx, "makeSigAndPostRootTeam created team: %v", teamID)
	return nil
}

func CreateRootTeam(ctx context.Context, g *libkb.GlobalContext, nameString string, settings keybase1.TeamSettings) (res *keybase1.TeamID, err error) {
	defer g.CTraceTimed(ctx, "CreateRootTeam", func() error { return err })()

	perUserKeyUpgradeSoft(ctx, g, "create-root-team")

	name, err := keybase1.TeamNameFromString(nameString)
	if err != nil {
		return nil, err
	}
	if !name.IsRootTeam() {
		return nil, fmt.Errorf("cannot create root team with subteam name: %v", nameString)
	}

	g.Log.CDebugf(ctx, "CreateRootTeam load me")
	me, err := loadMeForSignatures(ctx, g)
	if err != nil {
		return nil, err
	}

	ownerLatest := me.GetLatestPerUserKey()
	if ownerLatest == nil {
		return nil, errors.New("can't create a new team without having provisioned a per-user key")
	}
	secretboxRecipients := map[keybase1.UserVersion]keybase1.PerUserKey{
		me.ToUserVersion(): *ownerLatest,
	}

	members := SCTeamMembers{
		Owners:  &[]SCTeamMember{SCTeamMember(me.ToUserVersion())},
		Admins:  &[]SCTeamMember{},
		Writers: &[]SCTeamMember{},
		Readers: &[]SCTeamMember{},
	}

	var scSettings *SCTeamSettings
	if settings.Open {
		settingsTemp, err := CreateTeamSettings(settings.Open, settings.JoinAs)
		if err != nil {
			return nil, err
		}
		scSettings = &settingsTemp
	}

	teamID := name.ToPrivateTeamID()

	err = makeSigAndPostRootTeam(ctx, g, me, members, nil,
		secretboxRecipients, name.String(), teamID, false, false, scSettings)
	return &teamID, err
}

func CreateSubteam(ctx context.Context, g *libkb.GlobalContext, subteamBasename string,
	parentName keybase1.TeamName, addSelfAs keybase1.TeamRole) (ret *keybase1.TeamID, err error) {
	defer g.CTrace(ctx, "CreateSubteam", func() error { return err })()

	subteamName, err := parentName.Append(subteamBasename)
	if err != nil {
		return nil, err
	}

	// Assume private
	public := false
	subteamID := NewSubteamID(public)

	perUserKeyUpgradeSoft(ctx, g, "create-subteam")

	me, err := loadMeForSignatures(ctx, g)
	if err != nil {
		return nil, err
	}

	deviceSigningKey, err := g.ActiveDevice.SigningKey()
	if err != nil {
		return nil, err
	}

	parentTeam, err := GetForTeamManagementByStringName(ctx, g, parentName.String(), true)
	if err != nil {
		return nil, err
	}

	admin, err := parentTeam.getAdminPermission(ctx)
	if err != nil {
		return nil, err
	}

	if err := parentTeam.ForceMerkleRootUpdate(ctx); err != nil {
		return nil, err
	}

	// Subteam creation involves two links, one in the parent team's chain, and
	// one to start the new subteam chain. The start of the new subteam chain
	// (type "team.subteam_head") is very similar to the "team.root" sig that
	// starts a root team, and so making that link is very similar to what the
	// CreateTeamEngine does.

	newSubteamSig, err := generateNewSubteamSigForParentChain(g, me, deviceSigningKey, parentTeam.chain(), subteamName, subteamID, admin)
	if err != nil {
		return nil, err
	}

	// subteam needs to be keyed for all admins above it
	allParentAdmins, err := parentTeam.AllAdmins(ctx)
	if err != nil {
		return nil, err
	}

	subteamHeadSig, secretboxes, err := generateHeadSigForSubteamChain(ctx, g, me,
		deviceSigningKey, parentTeam.chain(), subteamName, subteamID, admin,
		allParentAdmins, addSelfAs)
	if err != nil {
		return nil, err
	}

	err = precheckLinkToPost(ctx, g, *newSubteamSig, parentTeam.chain(), me.ToUserVersion())
	if err != nil {
		return nil, fmt.Errorf("cannot post link (precheck new subteam): %v", err)
	}

	err = precheckLinkToPost(ctx, g, *subteamHeadSig, nil, me.ToUserVersion())
	if err != nil {
		return nil, fmt.Errorf("cannot post link (precheck subteam head): %v", err)
	}

	payload := make(libkb.JSONPayload)
	payload["sigs"] = []interface{}{newSubteamSig, subteamHeadSig}
	payload["per_team_key"] = secretboxes

	_, err = g.API.PostJSON(libkb.APIArg{
		Endpoint:    "sig/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	})
	if err != nil {
		return nil, err
	}

	return &subteamID, nil
}

func makeRootTeamSection(teamName string, teamID keybase1.TeamID, members SCTeamMembers, invites *SCTeamInvites,
	perTeamSigningKID keybase1.KID, perTeamEncryptionKID keybase1.KID, public bool, implicit bool, settings *SCTeamSettings) (SCTeamSection, error) {
	teamSection := SCTeamSection{
		Name:     (*SCTeamName)(&teamName),
		ID:       (SCTeamID)(teamID),
		Public:   public,
		Implicit: implicit,
		PerTeamKey: &SCPerTeamKey{
			Generation: 1,
			SigKID:     perTeamSigningKID,
			EncKID:     perTeamEncryptionKID,
		},
		Members: &members,
		Invites: invites,
	}

	teamSection.Settings = settings

	// At this point the team section has every field filled out except the
	// reverse sig. Now we'll wrap it into a full sig, marshal it to JSON, and
	// sign it, *twice*. The first time with the per-team signing key, to
	// produce the reverse sig, and the second time with the device signing
	// key, after the reverse sig has been written in.

	return teamSection, nil
}

func generateNewSubteamSigForParentChain(g *libkb.GlobalContext, me libkb.UserForSignatures, signingKey libkb.GenericKey, parentTeam *TeamSigChainState, subteamName keybase1.TeamName, subteamID keybase1.TeamID, admin *SCTeamAdmin) (item *libkb.SigMultiItem, err error) {
	newSubteamSigBody, err := NewSubteamSig(g, me, signingKey, parentTeam, subteamName, subteamID, admin)
	if err != nil {
		return nil, err
	}
	newSubteamSigJSON, err := newSubteamSigBody.Marshal()
	if err != nil {
		return nil, err
	}

	prevLinkID, err := libkb.ImportLinkID(parentTeam.GetLatestLinkID())
	if err != nil {
		return nil, err
	}
	seqType := seqTypeForTeamPublicness(parentTeam.IsPublic())

	hPrevInfo, err := parentTeam.GetHPrevInfoIfValid()
	if err != nil {
		return nil, err
	}
	v2Sig, _, _, err := libkb.MakeSigchainV2OuterSig(
		signingKey,
		libkb.LinkTypeNewSubteam,
		parentTeam.GetLatestSeqno()+1,
		newSubteamSigJSON,
		prevLinkID,
		libkb.SigHasRevokes(false),
		seqType,
		libkb.SigIgnoreIfUnsupported(false),
		hPrevInfo,
	)
	if err != nil {
		return nil, err
	}

	item = &libkb.SigMultiItem{
		Sig:        v2Sig,
		SigningKID: signingKey.GetKID(),
		Type:       string(libkb.LinkTypeNewSubteam),
		SeqType:    seqType,
		SigInner:   string(newSubteamSigJSON),
		TeamID:     parentTeam.GetID(),
	}
	return item, nil
}

func generateHeadSigForSubteamChain(ctx context.Context, g *libkb.GlobalContext, me libkb.UserForSignatures,
	signingKey libkb.GenericKey, parentTeam *TeamSigChainState, subteamName keybase1.TeamName,
	subteamID keybase1.TeamID, admin *SCTeamAdmin, allParentAdmins []keybase1.UserVersion,
	addSelfAs keybase1.TeamRole) (item *libkb.SigMultiItem, boxes *PerTeamSharedSecretBoxes, err error) {
	deviceEncryptionKey, err := g.ActiveDevice.EncryptionKey()
	if err != nil {
		return
	}

	members := SCTeamMembers{
		Owners:  &[]SCTeamMember{},
		Admins:  &[]SCTeamMember{},
		Writers: &[]SCTeamMember{},
		Readers: &[]SCTeamMember{},
	}

	memSet := newMemberSet()
	_, err = memSet.loadGroup(ctx, g, allParentAdmins, true /* store recipients */, true /* force poll */)
	if err != nil {
		return nil, nil, err
	}

	if addSelfAs != keybase1.TeamRole_NONE {
		meUV := me.ToUserVersion()
		memList := []SCTeamMember{SCTeamMember(meUV)}
		switch addSelfAs {
		case keybase1.TeamRole_READER:
			members.Readers = &memList
		case keybase1.TeamRole_WRITER:
			members.Writers = &memList
		case keybase1.TeamRole_ADMIN:
			members.Admins = &memList
		case keybase1.TeamRole_OWNER:
			return nil, nil, errors.New("Cannot add self as owner to a subteam")
		}
		memSet.loadMember(ctx, g, meUV, true /* store recipient */, false /* force poll */)
	}

	// These boxes will get posted along with the sig below.
	m, err := NewTeamKeyManager(g)
	if err != nil {
		return nil, nil, err
	}
	boxes, err = m.SharedSecretBoxes(libkb.NewMetaContext(ctx, g), deviceEncryptionKey, memSet.recipients)
	if err != nil {
		return nil, nil, err
	}

	perTeamSigningKey, err := m.SigningKey()
	if err != nil {
		return nil, nil, err
	}
	perTeamEncryptionKey, err := m.EncryptionKey()
	if err != nil {
		return nil, nil, err
	}

	// The "team" section of a subchain head link is similar to that of a
	// "team.root" link, with the addition of the "parent" subsection.
	teamSection, err := makeSubteamTeamSection(subteamName, subteamID, parentTeam, members, perTeamSigningKey.GetKID(), perTeamEncryptionKey.GetKID(), admin)
	if err != nil {
		return
	}

	subteamHeadSigBodyBeforeReverse, err := SubteamHeadSig(g, me, signingKey, teamSection)
	if err != nil {
		return
	}

	// Now generate the reverse sig and edit it into the JSON. Note that this
	// (sigchain-v1-style) reverse sig is made with the derived *per-team*
	// signing key.
	reverseSig, _, _, err := libkb.SignJSON(subteamHeadSigBodyBeforeReverse, perTeamSigningKey)
	if err != nil {
		return
	}

	// Update the team section to include the reverse sig, sign it again, and
	// make a sigchain-v2-style sig out of it. Doing it this way, instead of
	// generating it twice with different parameters, makes it less likely to
	// accidentally capture different global state (like ctime and merkle
	// seqno).
	subteamHeadSigBodyAfterReverse := subteamHeadSigBodyBeforeReverse
	subteamHeadSigBodyAfterReverse.SetValueAtPath("body.team.per_team_key.reverse_sig", jsonw.NewString(reverseSig))

	subteamHeadSigJSON, err := subteamHeadSigBodyAfterReverse.Marshal()
	if err != nil {
		return
	}

	seqType := seqTypeForTeamPublicness(parentTeam.IsPublic())
	hPrevInfo := libkb.NewInitialHPrevInfo()
	v2Sig, _, _, err := libkb.MakeSigchainV2OuterSig(
		signingKey,
		libkb.LinkTypeSubteamHead,
		1, /* seqno */
		subteamHeadSigJSON,
		nil, /* prevLinkID */
		libkb.SigHasRevokes(false),
		seqType,
		libkb.SigIgnoreIfUnsupported(false),
		&hPrevInfo,
	)
	if err != nil {
		return
	}

	item = &libkb.SigMultiItem{
		Sig:        v2Sig,
		SigningKID: signingKey.GetKID(),
		Type:       string(libkb.LinkTypeSubteamHead),
		SeqType:    seqType,
		SigInner:   string(subteamHeadSigJSON),
		TeamID:     subteamID,
		PublicKeys: &libkb.SigMultiItemPublicKeys{
			Encryption: perTeamEncryptionKey.GetKID(),
			Signing:    perTeamSigningKey.GetKID(),
		},
	}
	return
}

func makeSubteamTeamSection(subteamName keybase1.TeamName, subteamID keybase1.TeamID,
	parentTeam *TeamSigChainState, members SCTeamMembers, perTeamSigningKID keybase1.KID,
	perTeamEncryptionKID keybase1.KID, admin *SCTeamAdmin) (SCTeamSection, error) {

	subteamName2 := subteamName.String()
	teamSection := SCTeamSection{
		Name: (*SCTeamName)(&subteamName2),
		ID:   (SCTeamID)(subteamID),
		Parent: &SCTeamParent{
			ID:      SCTeamID(parentTeam.GetID()),
			Seqno:   parentTeam.GetLatestSeqno() + 1, // the seqno of the *new* parent link
			SeqType: seqTypeForTeamPublicness(parentTeam.IsPublic()),
		},
		PerTeamKey: &SCPerTeamKey{
			Generation: 1,
			SigKID:     perTeamSigningKID,
			EncKID:     perTeamEncryptionKID,
		},
		Members: &members,
		Admin:   admin,
	}

	// At this point the team section has every field filled out except the
	// reverse sig. Next we'll wrap it into a full sig body, marshal it to
	// JSON, and sign it, *twice*. The first time with the per-team signing
	// key, to produce the reverse sig, and the second time with the device
	// signing key, after the reverse sig has been written in.

	return teamSection, nil
}

// Get a per-user key.
// Wait for attempt but only warn on error.
func perUserKeyUpgradeSoft(ctx context.Context, g *libkb.GlobalContext, reason string) {
	m := libkb.NewMetaContext(ctx, g)
	arg := &engine.PerUserKeyUpgradeArgs{}
	eng := engine.NewPerUserKeyUpgrade(g, arg)
	err := engine.RunEngine2(m, eng)
	if err != nil {
		m.CDebugf("PerUserKeyUpgrade failed (%s): %v", reason, err)
	}
}
