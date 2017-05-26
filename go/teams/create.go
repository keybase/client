package teams

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"

	"golang.org/x/crypto/nacl/box"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

func CreateRootTeam(ctx context.Context, g *libkb.GlobalContext, name string) (err error) {
	defer g.CTrace(ctx, "CreateRootTeam", func() error { return err })()

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(g))
	if err != nil {
		return err
	}

	deviceSigningKey, err := g.ActiveDevice.SigningKey()
	if err != nil {
		return err
	}
	deviceEncryptionKey, err := g.ActiveDevice.EncryptionKey()
	if err != nil {
		return err
	}

	perTeamSecret, perTeamSigningKey, perTeamEncryptionKey, err := generatePerTeamKeys()
	if err != nil {
		return err
	}

	ownerLatest := me.GetComputedKeyFamily().GetLatestPerUserKey()
	if ownerLatest == nil {
		return errors.New("can't create a new team without having provisioned a per-user key")
	}
	secretboxRecipients := map[string]keybase1.PerUserKey{
		me.GetName(): *ownerLatest,
	}
	// These boxes will get posted along with the sig below.
	secretboxes, err := boxTeamSharedSecret(perTeamSecret, deviceEncryptionKey, secretboxRecipients)
	if err != nil {
		return err
	}

	teamSection, err := makeRootTeamSection(name, me, perTeamSigningKey.GetKID(), perTeamEncryptionKey.GetKID())
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
		TeamID:     RootTeamIDFromName(name),
		PublicKeys: &libkb.SigMultiItemPublicKeys{
			Encryption: perTeamEncryptionKey.GetKID(),
			Signing:    perTeamSigningKey.GetKID(),
		},
	}

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

	return nil
}

func CreateSubteam(ctx context.Context, g *libkb.GlobalContext, subteamBasename string, parentName TeamName) (err error) {
	defer g.CTrace(ctx, "CreateSubteam", func() error { return err })()
	subteamName, err := TeamNameFromString(string(parentName) + "." + subteamBasename)
	if err != nil {
		return err
	}

	subteamID := NewSubteamID()

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(g))
	if err != nil {
		return err
	}

	deviceSigningKey, err := g.ActiveDevice.SigningKey()
	if err != nil {
		return err
	}

	parentTeam, err := Get(ctx, g, string(parentName))
	if err != nil {
		return err
	}

	// Subteam creation involves two links, one in the parent team's chain, and
	// one to start the new subteam chain. The start of the new subteam chain
	// (type "team.subteam_head") is very similar to the "team.root" sig that
	// starts a root team, and so making that link is very similar to what the
	// CreateTeamEngine does.

	newSubteamSig, err := generateNewSubteamSigForParentChain(g, me, deviceSigningKey, parentTeam.Chain, subteamName, subteamID)
	if err != nil {
		return err
	}

	subteamHeadSig, secretboxes, err := generateHeadSigForSubteamChain(g, me, deviceSigningKey, parentTeam.Chain, subteamName, subteamID)
	if err != nil {
		return err
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
		return err
	}

	return nil
}

func generatePerTeamKeys() (sharedSecret []byte, signingKey libkb.NaclSigningKeyPair, encryptionKey libkb.NaclDHKeyPair, err error) {
	// This is the magical secret key, from which we derive a DH keypair and a
	// signing keypair.
	sharedSecret, err = libkb.RandBytes(32)
	if err != nil {
		return
	}
	encryptionKey, err = libkb.MakeNaclDHKeyPairFromSecretBytes(derivedSecret(sharedSecret, libkb.TeamDHDerivationString))
	if err != nil {
		return
	}
	signingKey, err = libkb.MakeNaclSigningKeyPairFromSecretBytes(derivedSecret(sharedSecret, libkb.TeamEdDSADerivationString))
	if err != nil {
		return
	}
	return
}

type PerUserSecretGeneration int

type PerTeamSharedSecretBoxes struct {
	Generation    PerUserSecretGeneration `json:"generation"`
	EncryptingKid keybase1.KID            `json:"encrypting_kid"`
	Nonce         string                  `json:"nonce"`
	PrevKey       *string                 `json:"prev"`
	Boxes         map[string]string       `json:"boxes"`
}

type PerTeamSharedSecretBox struct {
	_struct         bool `codec:",toarray"`
	Version         uint
	PerUserKeySeqno keybase1.Seqno
	NonceCounter    uint32
	Ctext           []byte
}

func boxTeamSharedSecret(secret []byte, senderKey libkb.GenericKey, recipients map[string]keybase1.PerUserKey) (*PerTeamSharedSecretBoxes, error) {
	senderNaclDHKey, ok := senderKey.(libkb.NaclDHKeyPair)
	if !ok {
		return nil, fmt.Errorf("got an unexpected key type for device encryption key: %T", senderKey)
	}
	noncePrefix, err := libkb.RandBytes(20)
	if err != nil {
		return nil, err
	}
	// The counter starts at 1, because 0 will be the prev secretbox, which is
	// omitted for the team root link, because this is the first shared key.
	var counter uint32 = 1
	boxes := make(map[string]string)
	for username, recipientPerUserKey := range recipients {
		recipientPerUserGenericKeypair, err := libkb.ImportKeypairFromKID(recipientPerUserKey.EncKID)
		if err != nil {
			return nil, err
		}
		recipientPerUserNaclKeypair, ok := recipientPerUserGenericKeypair.(libkb.NaclDHKeyPair)
		if !ok {
			return nil, fmt.Errorf("got an unexpected key type for recipient KID in sharedTeamKeyBox: %T", recipientPerUserGenericKeypair)
		}
		var nonce [24]byte
		counterBytes := [4]byte{}
		binary.BigEndian.PutUint32(counterBytes[:], counter)
		copy(nonce[:20], noncePrefix)
		copy(nonce[20:24], counterBytes[:])
		ctext := box.Seal(nil, secret, &nonce, ((*[32]byte)(&recipientPerUserNaclKeypair.Public)), ((*[32]byte)(senderNaclDHKey.Private)))
		boxStruct := PerTeamSharedSecretBox{
			Version:         libkb.SharedTeamKeyBoxVersion1,
			PerUserKeySeqno: recipientPerUserKey.Seqno,
			NonceCounter:    counter,
			Ctext:           ctext,
		}
		encodedArray, err := libkb.MsgpackEncode(boxStruct)
		if err != nil {
			return nil, err
		}
		base64Array := base64.StdEncoding.EncodeToString(encodedArray)
		boxes[username] = base64Array
	}

	return &PerTeamSharedSecretBoxes{
		Generation:    1,
		EncryptingKid: senderNaclDHKey.GetKID(),
		Nonce:         base64.StdEncoding.EncodeToString(noncePrefix),
		Boxes:         boxes,
	}, nil
}

func makeRootTeamSection(teamName string, owner *libkb.User, perTeamSigningKID keybase1.KID, perTeamEncryptionKID keybase1.KID) (SCTeamSection, error) {
	ownerName, err := libkb.MakeNameWithEldestSeqno(owner.GetName(), owner.GetCurrentEldestSeqno())
	// An error happens here if the seqno isn't loaded for some reason.
	if err != nil {
		return SCTeamSection{}, err
	}

	teamID := RootTeamIDFromName(teamName)

	teamSection := SCTeamSection{
		Name: (*SCTeamName)(&teamName),
		ID:   (SCTeamID)(teamID),
		PerTeamKey: &SCPerTeamKey{
			Generation: 1,
			SigKID:     perTeamSigningKID,
			EncKID:     perTeamEncryptionKID,
		},
		Members: &SCTeamMembers{
			Owners:  &[]SCTeamMember{SCTeamMember(ownerName)},
			Admins:  &[]SCTeamMember{},
			Writers: &[]SCTeamMember{},
			Readers: &[]SCTeamMember{},
		},
	}

	// At this point the team section has every field filled out except the
	// reverse sig. Now we'll wrap it into a full sig, marshal it to JSON, and
	// sign it, *twice*. The first time with the per-team signing key, to
	// produce the reverse sig, and the second time with the device signing
	// key, after the reverse sig has been written in.

	return teamSection, nil
}

func derivedSecret(secret []byte, context string) []byte {
	digest := hmac.New(sha512.New, secret)
	digest.Write([]byte(context))
	return digest.Sum(nil)[:32]
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

func generateNewSubteamSigForParentChain(g *libkb.GlobalContext, me *libkb.User, signingKey libkb.GenericKey, parentTeam *TeamSigChainState, subteamName TeamName, subteamID keybase1.TeamID) (item *libkb.SigMultiItem, err error) {
	newSubteamSigBody, err := NewSubteamSig(me, signingKey, parentTeam, subteamName, subteamID)
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

func generateHeadSigForSubteamChain(g *libkb.GlobalContext, me *libkb.User, signingKey libkb.GenericKey, parentTeam *TeamSigChainState, subteamName TeamName, subteamID keybase1.TeamID) (item *libkb.SigMultiItem, boxes *PerTeamSharedSecretBoxes, err error) {
	deviceEncryptionKey, err := g.ActiveDevice.EncryptionKey()
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
	teamSection, err := makeSubteamTeamSection(subteamName, subteamID, parentTeam, me, perTeamSigningKey.GetKID(), perTeamEncryptionKey.GetKID())
	if err != nil {
		return
	}

	subteamHeadSigBodyBeforeReverse, err := SubteamHeadSig(me, signingKey, teamSection)

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

func makeSubteamTeamSection(subteamName TeamName, subteamID keybase1.TeamID, parentTeam *TeamSigChainState, owner *libkb.User, perTeamSigningKID keybase1.KID, perTeamEncryptionKID keybase1.KID) (SCTeamSection, error) {
	ownerName, err := libkb.MakeNameWithEldestSeqno(owner.GetName(), owner.GetCurrentEldestSeqno())
	// An error happens here if the seqno isn't loaded for some reason.
	if err != nil {
		return SCTeamSection{}, err
	}

	teamSection := SCTeamSection{
		Name: (*SCTeamName)(&subteamName),
		ID:   (SCTeamID)(subteamID),
		Parent: &SCTeamParent{
			ID:    SCTeamID(parentTeam.GetID()),
			Seqno: parentTeam.GetLatestSeqno() + 1, // the seqno of the *new* parent link
		},
		PerTeamKey: &SCPerTeamKey{
			Generation: 1,
			SigKID:     perTeamSigningKID,
			EncKID:     perTeamEncryptionKID,
		},
		Members: &SCTeamMembers{
			// Only root teams can have owners. Make the current user an admin by default.
			// TODO: Plumb through more control over the initial set of admins.
			Owners:  &[]SCTeamMember{},
			Admins:  &[]SCTeamMember{SCTeamMember(ownerName)},
			Writers: &[]SCTeamMember{},
			Readers: &[]SCTeamMember{},
		},
	}

	// At this point the team section has every field filled out except the
	// reverse sig. Next we'll wrap it into a full sig body, marshal it to
	// JSON, and sign it, *twice*. The first time with the per-team signing
	// key, to produce the reverse sig, and the second time with the device
	// signing key, after the reverse sig has been written in.

	return teamSection, nil
}
