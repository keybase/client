package teams

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

func CreateImplicitTeam(ctx context.Context, g *libkb.GlobalContext, impTeam keybase1.ImplicitTeamName) (res keybase1.TeamID, err error) {
	defer g.CTrace(ctx, "CreateImplicitTeam", func() error { return err })()

	name, err := NewImplicitTeamName()
	if err != nil {
		return res, err
	}
	teamID := RootTeamIDFromNameString(name)

	// Load all the Keybase users
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(g))
	if err != nil {
		return res, err
	}
	var kbusers []*keybase1.UserPlusKeysV2AllIncarnations
	for _, kbu := range impTeam.KeybaseUsers {
		uid, err := g.GetUPAKLoader().LookupUID(ctx, libkb.NewNormalizedUsername(kbu))
		if err != nil {
			g.Log.CDebugf(ctx, "CreateImplicitTeam: failed to load uid: %s msg: %s", kbu, err)
			return res, err
		}
		upak, _, err := g.GetUPAKLoader().LoadV2(libkb.LoadUserArg{
			UID: uid,
		})
		if err != nil {
			g.Log.CDebugf(ctx, "CreateImplicitTeam: failed to load user: %s msg: %s", kbu, err)
			return res, err
		}
		kbusers = append(kbusers, upak)
	}

	// Form secret boxes and make invites for KB users with no PUKs
	var invites []SCTeamInvite
	secretboxRecipients := make(map[keybase1.UserVersion]keybase1.PerUserKey)
	for _, kbu := range kbusers {
		puk := kbu.Current.GetLatestPerUserKey()
		if puk == nil {
			// Add this person as an invite if they do not have a puk
			invites = append(invites, SCTeamInvite{
				Type: "keybase",
				Name: kbu.Current.ToUserVersion().PercentForm(),
				ID:   NewInviteID(),
			})
		} else {
			secretboxRecipients[kbu.Current.ToUserVersion()] = *puk
		}
	}

	// Add invites for assertions
	for _, assertion := range impTeam.UnresolvedUsers {
		invites = append(invites, SCTeamInvite{
			Type: string(assertion.Service),
			Name: assertion.User,
			ID:   NewInviteID(),
		})
	}
	var teamInvites *SCTeamInvites
	if len(invites) > 0 {
		teamInvites = &SCTeamInvites{
			Owners:  &invites,
			Admins:  &[]SCTeamInvite{},
			Writers: &[]SCTeamInvite{},
			Readers: &[]SCTeamInvite{},
		}
	}
	var teamMembers []SCTeamMember
	for _, kbu := range kbusers {
		teamMembers = append(teamMembers, SCTeamMember(kbu.Current.ToUserVersion()))
	}

	// Post the team
	return teamID, makeSigAndPostRootTeam(ctx, g, me, teamMembers, teamInvites, secretboxRecipients, name,
		teamID, !impTeam.IsPrivate, true)
}

func makeSigAndPostRootTeam(ctx context.Context, g *libkb.GlobalContext, me *libkb.User, users []SCTeamMember,
	invites *SCTeamInvites, secretboxRecipients map[keybase1.UserVersion]keybase1.PerUserKey, name string,
	teamID keybase1.TeamID, public, implicit bool) error {

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
	teamSection, err := makeRootTeamSection(name, teamID, users, invites, perTeamSigningKey.GetKID(),
		perTeamEncryptionKey.GetKID(), public, implicit)
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
	v2Sig, err := makeSigchainV2OuterSig(
		deviceSigningKey,
		libkb.LinkTypeTeamRoot,
		1, /* seqno */
		sigJSONAfterReverse,
		nil,   /* prevLinkID */
		false, /* hasRevokes */
	)
	if err != nil {
		return err
	}

	sigMultiItem := libkb.SigMultiItem{
		Sig:        v2Sig,
		SigningKID: deviceSigningKey.GetKID(),
		Type:       string(libkb.LinkTypeTeamRoot),
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
	return err
}

func CreateRootTeam(ctx context.Context, g *libkb.GlobalContext, name string) (err error) {
	defer g.CTrace(ctx, "CreateRootTeam", func() error { return err })()

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

	return makeSigAndPostRootTeam(ctx, g, me, []SCTeamMember{SCTeamMember(me.ToUserVersion())}, nil,
		secretboxRecipients, name, RootTeamIDFromNameString(name), false, false)
}

func CreateSubteam(ctx context.Context, g *libkb.GlobalContext, subteamBasename string, parentName keybase1.TeamName) (ret *keybase1.TeamID, err error) {
	defer g.CTrace(ctx, "CreateSubteam", func() error { return err })()
	subteamName, err := parentName.Append(subteamBasename)
	if err != nil {
		return nil, err
	}

	subteamID := NewSubteamID()

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

func makeRootTeamSection(teamName string, teamID keybase1.TeamID, owners []SCTeamMember, invites *SCTeamInvites,
	perTeamSigningKID keybase1.KID, perTeamEncryptionKID keybase1.KID, public bool, implicit bool) (SCTeamSection, error) {
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
		Members: &SCTeamMembers{
			Owners:  &owners,
			Admins:  &[]SCTeamMember{},
			Writers: &[]SCTeamMember{},
			Readers: &[]SCTeamMember{},
		},
		Invites: invites,
	}

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
	v2Sig, err := makeSigchainV2OuterSig(
		signingKey,
		libkb.LinkTypeNewSubteam,
		parentTeam.GetLatestSeqno()+1,
		newSubteamSigJSON,
		prevLinkID,
		false, /* hasRevokes */
	)
	if err != nil {
		return nil, err
	}

	item = &libkb.SigMultiItem{
		Sig:        v2Sig,
		SigningKID: signingKey.GetKID(),
		Type:       string(libkb.LinkTypeNewSubteam),
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

	v2Sig, err := makeSigchainV2OuterSig(
		signingKey,
		libkb.LinkTypeSubteamHead,
		1, /* seqno */
		subteamHeadSigJSON,
		nil,   /* prevLinkID */
		false, /* hasRevokes */
	)
	if err != nil {
		return
	}

	item = &libkb.SigMultiItem{
		Sig:        v2Sig,
		SigningKID: signingKey.GetKID(),
		Type:       string(libkb.LinkTypeSubteamHead),
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
			SeqType: keybase1.SeqType_SEMIPRIVATE,
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
