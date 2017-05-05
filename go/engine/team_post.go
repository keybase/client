// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"

	"golang.org/x/crypto/nacl/box"
)

type NewTeamEngine struct {
	libkb.Contextified
	name string
}

func NewNewTeamEngine(g *libkb.GlobalContext, name string) *NewTeamEngine {
	return &NewTeamEngine{
		Contextified: libkb.NewContextified(g),
		name:         name,
	}
}

func (e *NewTeamEngine) Name() string {
	return "NewTeam"
}

func (e *NewTeamEngine) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

func (e *NewTeamEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
		libkb.SecretUIKind,
	}
}

func (e *NewTeamEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (e *NewTeamEngine) Run(ctx *Context) (err error) {
	defer e.G().CTrace(ctx.GetNetContext(), "NewTeamEngine", func() error { return err })()

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	if err != nil {
		return err
	}

	ska := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	sigKey, err := e.G().Keyrings.GetSecretKeyWithPrompt(ctx.SecretKeyPromptArg(ska, "to create a new team"))
	if err != nil {
		return err
	}
	if err = sigKey.CheckSecretKey(); err != nil {
		return err
	}

	teamSection, err := makeRootTeamSection(e.name, me)
	if err != nil {
		return err
	}
	teamSectionJSON, err := jsonw.WrapperFromObject(teamSection)
	if err != nil {
		return err
	}

	innerJSON, err := me.TeamRootSig(sigKey, teamSectionJSON)
	if err != nil {
		return err
	}

	innerJSONBytes, err := innerJSON.Marshal()
	if err != nil {
		return err
	}

	v2Sig, err := makeSigchainV2OuterSig(
		sigKey,
		libkb.LinkTypeTeamRoot,
		1, /* seqno */
		innerJSONBytes,
		nil,   /* prevLinkID */
		false, /* hasRevokes */
	)
	if err != nil {
		return err
	}

	sigMultiItem := libkb.SigMultiItem{
		Sig:        v2Sig,
		SigningKID: sigKey.GetKID().String(),
		Type:       string(libkb.LinkTypeTeamRoot),
		SigInner:   string(innerJSONBytes),
		TeamID:     libkb.RootTeamIDFromName(e.name),
	}

	payload := make(libkb.JSONPayload)
	payload["sigs"] = []interface{}{sigMultiItem}

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

type TeamSection struct {
	Name    string `json:"name"`
	ID      string `json:"id"`
	Members struct {
		Owner  []string `json:"owner"`
		Admin  []string `json:"admin"`
		Writer []string `json:"writer"`
		Reader []string `json:"reader"`
	} `json:"members"`
	SharedKey struct {
		E     string            `json:"E"`
		Boxes map[string]string `json:"boxes"`
		Gen   int               `json:"gen"`
	} `json:"shared_key"`
}

func makeRootTeamSection(teamName string, owner *libkb.User) (TeamSection, error) {
	teamID := libkb.RootTeamIDFromName(teamName)
	teamSection := TeamSection{
		Name: teamName,
		ID:   teamID,
	}

	ownerName, err := libkb.NameWithEldestSeqno(owner.GetName(), owner.GetCurrentEldestSeqno())
	// An error happens here if the seqno isn't loaded for some reason.
	if err != nil {
		return teamSection, err
	}

	teamSection.Members.Owner = []string{ownerName}
	teamSection.Members.Admin = []string{}
	teamSection.Members.Writer = []string{}
	teamSection.Members.Reader = []string{}
	teamSection.SharedKey.Boxes = map[string]string{}

	ephemeralPair, err := libkb.GenerateNaclDHKeyPair()
	if err != nil {
		return teamSection, err
	}
	teamSection.SharedKey.E = ephemeralPair.Public.GetKID().String()
	teamSection.SharedKey.Gen = 1

	// This is the shared secret key. Do not store it except encrypted in the
	// boxes that follow!
	sharedSecretKey, err := libkb.RandBytes(32)
	if err != nil {
		return teamSection, err
	}

	// Note that the key boxes use usernames directly, without the %Seqno
	// annotation from the roles section.
	ownerSharedDHKey := owner.GetComputedKeyFamily().GetLatestSharedDHKey()
	if ownerSharedDHKey == nil {
		return teamSection, fmt.Errorf("can't create new team without a shared DH key")
	}
	ownerSharedKeyBox, err := makeSharedTeamKeyBox(ephemeralPair, *ownerSharedDHKey, owner.GetName(), sharedSecretKey, teamID)
	if err != nil {
		return teamSection, err
	}
	teamSection.SharedKey.Boxes[owner.GetName()] = ownerSharedKeyBox

	return teamSection, nil
}

type sharedTeamKeyBox struct {
	_struct bool `codec:",toarray"`
	Version int
	Seqno   int
	Box     []byte
}

func makeSharedTeamKeyBox(ephemeralPair libkb.NaclDHKeyPair, recipientKey keybase1.SharedDHKey, recipientName string, sharedSecretKey []byte, teamID string) (string, error) {
	nonceHmacKey := fmt.Sprintf("TEAM %s SHARED KEY BOX", teamID)
	nonceDigest := hmac.New(sha256.New, []byte(nonceHmacKey))
	nonceDigest.Write([]byte(recipientName))
	nonce := libkb.MakeByte24(nonceDigest.Sum(nil)[0:24])

	recipientKeypair, err := libkb.ImportKeypairFromKID(recipientKey.Kid)
	if err != nil {
		return "", err
	}
	recipientNaclKeypair, ok := recipientKeypair.(libkb.NaclDHKeyPair)
	if !ok {
		return "", fmt.Errorf("got an unexpected key type for recipient KID in sharedTeamKeyBox: %T", recipientKeypair)
	}

	ciphertext := box.Seal(
		nil,
		sharedSecretKey,
		&nonce,
		(*[32]byte)(&recipientNaclKeypair.Public),
		(*[32]byte)(ephemeralPair.Private))

	boxStruct := sharedTeamKeyBox{
		Version: libkb.SharedTeamKeyBoxVersion1,
		Seqno:   recipientKey.Seqno,
		Box:     ciphertext,
	}

	msgpackBytes, err := libkb.MsgpackEncode(boxStruct)
	if err != nil {
		return "", err
	}

	base64Str := base64.StdEncoding.EncodeToString(msgpackBytes)

	return base64Str, nil
}

func makeSigchainV2OuterSig(
	signingKey libkb.GenericKey,
	v1LinkType libkb.LinkType,
	seqno libkb.Seqno,
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
		Prev:     nil,
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
