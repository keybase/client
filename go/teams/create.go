package teams

import (
	"errors"

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
	teamID := RootTeamIDFromNameString(teamName.String())

	perUserKeyUpgradeSoft(ctx, g, "create-implicit-team")

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(g))
	if err != nil {
		return res, teamName, err
	}

	// Load all the Keybase users
	loadUsernameList := func(usernames []string) (res []*keybase1.UserPlusKeysV2, err error) {
		for _, username := range usernames {
			arg := libkb.NewLoadUserArg(g).WithName(username).WithNetContext(ctx)
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

func makeSigAndPostRootTeam(ctx context.Context, g *libkb.GlobalContext, me *libkb.User, members SCTeamMembers,
	invites *SCTeamInvites, secretboxRecipients map[keybase1.UserVersion]keybase1.PerUserKey, name string,
	teamID keybase1.TeamID, public, implicit bool, settings *SCTeamSettings) error {

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
	secretboxes, err := m.SharedSecretBoxes(ctx, deviceEncryptionKey, secretboxRecipients)
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
	sigBodyBeforeReverse, err := TeamRootSig(me, deviceSigningKey, teamSection)
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
	v2Sig, err := makeSigchainV2OuterSig(
		deviceSigningKey,
		libkb.LinkTypeTeamRoot,
		1, /* seqno */
		sigJSONAfterReverse,
		nil,   /* prevLinkID */
		false, /* hasRevokes */
		seqType,
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

	g.Log.CDebugf(ctx, "makeSigAndPostRootTeam post sigs")
	payload := make(libkb.JSONPayload)
	payload["sigs"] = []interface{}{sigMultiItem}
	payload["per_team_key"] = secretboxes

	_, err = g.API.PostJSON(libkb.APIArg{
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

func CreateRootTeam(ctx context.Context, g *libkb.GlobalContext, name string, settings keybase1.TeamSettings) (err error) {
	defer g.CTrace(ctx, "CreateRootTeam", func() error { return err })()

	perUserKeyUpgradeSoft(ctx, g, "create-root-team")

	g.Log.CDebugf(ctx, "CreateRootTeam load me")
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(g))
	if err != nil {
		return err
	}

	ownerLatest := me.GetComputedKeyFamily().GetLatestPerUserKey()
	if ownerLatest == nil {
		return errors.New("can't create a new team without having provisioned a per-user key")
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
			return err
		}
		scSettings = &settingsTemp
	}

	return makeSigAndPostRootTeam(ctx, g, me, members, nil,
		secretboxRecipients, name, RootTeamIDFromNameString(name), false, false, scSettings)
}

func CreateSubteam(ctx context.Context, g *libkb.GlobalContext, subteamBasename string, parentName keybase1.TeamName) (ret *keybase1.TeamID, err error) {
	defer g.CTrace(ctx, "CreateSubteam", func() error { return err })()

	subteamName, err := parentName.Append(subteamBasename)
	if err != nil {
		return nil, err
	}

	subteamID := NewSubteamID()

	perUserKeyUpgradeSoft(ctx, g, "create-subteam")

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(g))
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

	// Reuse the `me` getting loaded
	parentTeam.me = me
	admin, err := parentTeam.getAdminPermission(ctx, true)
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

	subteamHeadSig, secretboxes, err := generateHeadSigForSubteamChain(ctx, g, me, deviceSigningKey, parentTeam.chain(), subteamName, subteamID, admin, allParentAdmins)
	if err != nil {
		return nil, err
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

func makeSigchainV2OuterSig(
	signingKey libkb.GenericKey,
	v1LinkType libkb.LinkType,
	seqno keybase1.Seqno,
	innerLinkJSON []byte,
	prevLinkID libkb.LinkID,
	hasRevokes bool,
	seqType keybase1.SeqType,
) (
	string,
	error,
) {
	linkID := libkb.ComputeLinkID(innerLinkJSON)

	v2LinkType, err := libkb.SigchainV2TypeFromV1TypeAndRevocations(string(v1LinkType), hasRevokes)
	if err != nil {
		return "", err
	}

	outerLink := libkb.OuterLinkV2{
		Version:  2,
		Seqno:    seqno,
		Prev:     prevLinkID,
		Curr:     linkID,
		LinkType: v2LinkType,
		SeqType:  seqType,
	}
	encodedOuterLink, err := outerLink.Encode()
	if err != nil {
		return "", err
	}

	sig, _, err := signingKey.SignToString(encodedOuterLink)
	if err != nil {
		return "", err
	}

	return sig, nil
}

func generateNewSubteamSigForParentChain(g *libkb.GlobalContext, me *libkb.User, signingKey libkb.GenericKey, parentTeam *TeamSigChainState, subteamName keybase1.TeamName, subteamID keybase1.TeamID, admin *SCTeamAdmin) (item *libkb.SigMultiItem, err error) {
	newSubteamSigBody, err := NewSubteamSig(me, signingKey, parentTeam, subteamName, subteamID, admin)
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
	v2Sig, err := makeSigchainV2OuterSig(
		signingKey,
		libkb.LinkTypeNewSubteam,
		parentTeam.GetLatestSeqno()+1,
		newSubteamSigJSON,
		prevLinkID,
		false, /* hasRevokes */
		seqType,
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

func generateHeadSigForSubteamChain(ctx context.Context, g *libkb.GlobalContext, me *libkb.User, signingKey libkb.GenericKey, parentTeam *TeamSigChainState, subteamName keybase1.TeamName, subteamID keybase1.TeamID, admin *SCTeamAdmin, allParentAdmins []keybase1.UserVersion) (item *libkb.SigMultiItem, boxes *PerTeamSharedSecretBoxes, err error) {
	deviceEncryptionKey, err := g.ActiveDevice.EncryptionKey()
	if err != nil {
		return
	}

	memSet := newMemberSet()
	_, err = memSet.loadGroup(ctx, g, allParentAdmins, true /* store recipients */, true /* force poll */)
	if err != nil {
		return nil, nil, err
	}

	// These boxes will get posted along with the sig below.
	m, err := NewTeamKeyManager(g)
	if err != nil {
		return nil, nil, err
	}
	boxes, err = m.SharedSecretBoxes(ctx, deviceEncryptionKey, memSet.recipients)
	if err != nil {
		return
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
	teamSection, err := makeSubteamTeamSection(subteamName, subteamID, parentTeam, me, perTeamSigningKey.GetKID(), perTeamEncryptionKey.GetKID(), admin)
	if err != nil {
		return
	}

	subteamHeadSigBodyBeforeReverse, err := SubteamHeadSig(me, signingKey, teamSection)
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
	v2Sig, err := makeSigchainV2OuterSig(
		signingKey,
		libkb.LinkTypeSubteamHead,
		1, /* seqno */
		subteamHeadSigJSON,
		nil,   /* prevLinkID */
		false, /* hasRevokes */
		seqTypeForTeamPublicness(parentTeam.IsPublic()),
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

func makeSubteamTeamSection(subteamName keybase1.TeamName, subteamID keybase1.TeamID, parentTeam *TeamSigChainState, owner *libkb.User, perTeamSigningKID keybase1.KID, perTeamEncryptionKID keybase1.KID, admin *SCTeamAdmin) (SCTeamSection, error) {

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
		Members: &SCTeamMembers{
			// Only root teams can have owners. Do not make the current user an admin by default.
			Owners:  &[]SCTeamMember{},
			Admins:  &[]SCTeamMember{},
			Writers: &[]SCTeamMember{},
			Readers: &[]SCTeamMember{},
		},
		Admin: admin,
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
	ectx := engine.Context{
		NetContext: ctx,
	}
	arg := &engine.PerUserKeyUpgradeArgs{}
	eng := engine.NewPerUserKeyUpgrade(g, arg)
	err := engine.RunEngine(eng, &ectx)
	if err != nil {
		g.Log.CDebugf(ctx, "PerUserKeyUpgrade failed (%s): %v", reason, err)
	}
}
