// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	jsonw "github.com/keybase/go-jsonw"
)

type SubteamCreateEngine struct {
	libkb.Contextified
	parentName                string
	subteamFullyQualifiedName string
	subteamID                 keybase1.TeamID
}

func NewSubteamCreateEngine(g *libkb.GlobalContext, parentName string, subteamBasename string) *SubteamCreateEngine {
	return &SubteamCreateEngine{
		Contextified:              libkb.NewContextified(g),
		parentName:                parentName,
		subteamFullyQualifiedName: parentName + "." + subteamBasename,
		subteamID:                 teams.NewSubteamID(),
	}
}

func (e *SubteamCreateEngine) Name() string {
	return "SubteamCreate"
}

func (e *SubteamCreateEngine) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

func (e *SubteamCreateEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
		libkb.SecretUIKind,
	}
}

func (e *SubteamCreateEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (e *SubteamCreateEngine) Run(ctx *Context) (err error) {
	defer e.G().CTrace(ctx.GetNetContext(), "SubteamCreateEngine", func() error { return err })()

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	if err != nil {
		return err
	}

	deviceSigningKey, err := e.G().ActiveDevice.SigningKey()
	if err != nil {
		return err
	}

	parentTeam, err := teams.Get(ctx.GetNetContext(), e.G(), e.parentName)
	if err != nil {
		return err
	}

	// Subteam creation involves two links, one in the parent team's chain, and
	// one to start the new subteam chain. The start of the new subteam chain
	// (type "team.subteam_head") is very similar to the "team.root" sig that
	// starts a root team, and so making that link is very similar to what the
	// CreateTeamEngine does.

	newSubteamSig, err := e.generateNewSubteamSigForParentChain(ctx, me, deviceSigningKey, parentTeam)
	if err != nil {
		return err
	}

	subteamHeadSig, secretboxes, err := e.generateHeadSigForSubteamChain(ctx, me, deviceSigningKey, parentTeam)
	if err != nil {
		return err
	}

	payload := make(libkb.JSONPayload)
	payload["sigs"] = []interface{}{newSubteamSig, subteamHeadSig}
	payload["per_team_key"] = secretboxes

	_, err = e.G().API.PostJSON(libkb.APIArg{
		Endpoint:    "sig/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	})
	if err != nil {
		return err
	}

	return nil
}

func (e *SubteamCreateEngine) generateNewSubteamSigForParentChain(ctx *Context, me *libkb.User, signingKey libkb.GenericKey, parentTeam *teams.TeamSigChainState) (item *libkb.SigMultiItem, err error) {
	newSubteamSigBody, err := teams.NewSubteamSig(me, signingKey, parentTeam, e.subteamFullyQualifiedName, e.subteamID)
	newSubteamSigJSON, err := newSubteamSigBody.Marshal()
	if err != nil {
		return
	}

	v2Sig, err := makeSigchainV2OuterSig(
		signingKey,
		libkb.LinkTypeNewSubteam,
		parentTeam.GetLatestSeqno()+1,
		newSubteamSigJSON,
		parentTeam.GetLatestLinkID(),
		false, /* hasRevokes */
	)
	if err != nil {
		return
	}

	item = &libkb.SigMultiItem{
		Sig:        v2Sig,
		SigningKID: signingKey.GetKID(),
		Type:       string(libkb.LinkTypeNewSubteam),
		SigInner:   string(newSubteamSigJSON),
		TeamID:     parentTeam.GetID(),
	}
	return
}

func (e *SubteamCreateEngine) generateHeadSigForSubteamChain(ctx *Context, me *libkb.User, signingKey libkb.GenericKey, parentTeam *teams.TeamSigChainState) (item *libkb.SigMultiItem, boxes *PerTeamSharedSecretBoxes, err error) {
	deviceEncryptionKey, err := e.G().ActiveDevice.EncryptionKey()
	if err != nil {
		return
	}

	perTeamSecret, perTeamSigningKey, perTeamEncryptionKey, err := generatePerTeamKeys()
	if err != nil {
		return
	}

	ownerLatest := me.GetComputedKeyFamily().GetLatestPerUserKey()
	if ownerLatest == nil {
		err = errors.New("can't create a new team without having provisioned a per-user key")
		return
	}
	secretboxRecipients := map[string]keybase1.PerUserKey{
		me.GetName(): *ownerLatest,
	}
	// These boxes will get posted along with the sig below.
	boxes, err = boxTeamSharedSecret(perTeamSecret, deviceEncryptionKey, secretboxRecipients)
	if err != nil {
		return
	}

	// The "team" section of a subchain head link is similar to that of a
	// "team.root" link, with the addition of the "parent" subsection.
	teamSection, err := makeSubteamTeamSection(e.subteamFullyQualifiedName, e.subteamID, parentTeam, me, perTeamSigningKey.GetKID(), perTeamEncryptionKey.GetKID())
	if err != nil {
		return
	}

	subteamHeadSigBodyBeforeReverse, err := teams.SubteamHeadSig(me, signingKey, teamSection)

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
		TeamID:     e.subteamID,
		PublicKeys: &libkb.SigMultiItemPublicKeys{
			Encryption: perTeamEncryptionKey.GetKID(),
			Signing:    perTeamSigningKey.GetKID(),
		},
	}
	return
}

func makeSubteamTeamSection(subteamFQName string, subteamID keybase1.TeamID, parentTeam *teams.TeamSigChainState, owner *libkb.User, perTeamSigningKID keybase1.KID, perTeamEncryptionKID keybase1.KID) (teams.TeamSection, error) {
	teamSection := teams.TeamSection{
		Name: subteamFQName,
		ID:   subteamID,
		Parent: &teams.ParentSection{
			ID:    parentTeam.GetID(),
			Seqno: parentTeam.GetLatestSeqno() + 1, // the seqno of the *new* parent link
		},
	}

	ownerName, err := libkb.MakeNameWithEldestSeqno(owner.GetName(), owner.GetCurrentEldestSeqno())
	// An error happens here if the seqno isn't loaded for some reason.
	if err != nil {
		return teamSection, err
	}

	// Only root teams can have owners. Make the current user an admin by default.
	// TODO: Plumb through more control over the initial set of admins.
	teamSection.Members.Owner = []libkb.NameWithEldestSeqno{}
	teamSection.Members.Admin = []libkb.NameWithEldestSeqno{ownerName}
	teamSection.Members.Writer = []libkb.NameWithEldestSeqno{}
	teamSection.Members.Reader = []libkb.NameWithEldestSeqno{}
	teamSection.PerTeamKey.Generation = 1
	teamSection.PerTeamKey.SigningKID = perTeamSigningKID
	teamSection.PerTeamKey.EncryptionKID = perTeamEncryptionKID

	// At this point the team section has every field filled out except the
	// reverse sig. Now we'll wrap it into a full sig, marshal it to JSON, and
	// sign it, *twice*. The first time with the per-team signing key, to
	// produce the reverse sig, and the second time with the device signing
	// key, after the reverse sig has been written in.

	return teamSection, nil
}
