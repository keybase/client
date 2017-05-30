package teams

import (
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type Team struct {
	libkb.Contextified

	Name  string
	Chain *TeamSigChainState
	Box   TeamBox

	secret        []byte
	signingKey    libkb.NaclSigningKeyPair
	encryptionKey libkb.NaclDHKeyPair

	me *libkb.User
}

func NewTeam(g *libkb.GlobalContext, name string) *Team {
	return &Team{Name: name, Contextified: libkb.NewContextified(g)}
}

func (t *Team) SharedSecret(ctx context.Context) ([]byte, error) {
	userEncKey, err := t.perUserEncryptionKey(ctx)
	if err != nil {
		return nil, err
	}

	return t.Box.Open(userEncKey)
}

func (t *Team) UsernamesWithRole(role keybase1.TeamRole) ([]libkb.NormalizedUsername, error) {
	uvs, err := t.Chain.GetUsersWithRole(role)
	if err != nil {
		return nil, err
	}
	names := make([]libkb.NormalizedUsername, len(uvs))
	for i, uv := range uvs {
		names[i] = uv.Username
	}
	return names, nil
}

func (t *Team) Members() (keybase1.TeamMembers, error) {
	var members keybase1.TeamMembers

	x, err := t.UsernamesWithRole(keybase1.TeamRole_OWNER)
	if err != nil {
		return keybase1.TeamMembers{}, err
	}
	members.Owners = libkb.NormalizedUsernamesToStrings(x)

	x, err = t.UsernamesWithRole(keybase1.TeamRole_ADMIN)
	if err != nil {
		return keybase1.TeamMembers{}, err
	}
	members.Admins = libkb.NormalizedUsernamesToStrings(x)

	x, err = t.UsernamesWithRole(keybase1.TeamRole_WRITER)
	if err != nil {
		return keybase1.TeamMembers{}, err
	}
	members.Writers = libkb.NormalizedUsernamesToStrings(x)

	x, err = t.UsernamesWithRole(keybase1.TeamRole_READER)
	if err != nil {
		return keybase1.TeamMembers{}, err
	}
	members.Readers = libkb.NormalizedUsernamesToStrings(x)

	return members, nil
}

func (t *Team) perUserEncryptionKey(ctx context.Context) (*libkb.NaclDHKeyPair, error) {
	// TeamBox has PerUserKeySeqno but libkb.PerUserKeyring has no seqnos.
	// ComputedKeyInfos does, though, so let's find the key there first, then
	// look for it in libkb.PerUserKeyring.

	me, err := t.loadMe()
	if err != nil {
		return nil, err
	}

	cki := me.GetComputedKeyInfos()
	if cki == nil {
		return nil, errors.New("no computed key infos for self")
	}

	var encKID keybase1.KID
	for _, key := range cki.PerUserKeys {
		if key.Seqno == t.Box.PerUserKeySeqno {
			encKID = key.EncKID
			break
		}
	}
	if encKID.IsNil() {
		return nil, libkb.NotFoundError{Msg: fmt.Sprintf("per-user-key not found seqno=%d", t.Box.PerUserKeySeqno)}
	}

	kr, err := t.G().GetPerUserKeyring()
	if err != nil {
		return nil, err
	}
	// XXX this seems to be necessary:
	if err := kr.Sync(ctx); err != nil {
		return nil, err
	}
	encKey, err := kr.GetEncryptionKeyByKID(ctx, encKID)
	if err != nil {
		return nil, err
	}
	if encKey.Private == nil {
		return nil, errors.New("per user enckey is locked")
	}

	return encKey, nil
}

func (t *Team) NextSeqno() keybase1.Seqno {
	return t.Chain.GetLatestSeqno() + 1
}

// If any field is nil, that means no change.
// If any field is an empty array, that means remove all current members.
type ChangeReq struct {
	Owners  *[]string
	Admins  *[]string
	Writers *[]string
	Readers *[]string
	None    *[]string
}

func (t *Team) ChangeMembership(ctx context.Context, req ChangeReq) error {
	// make keys for the team
	if err := t.makeKeys(ctx); err != nil {
		return err
	}

	// load the member set specified in req
	memSet, err := newMemberSet(ctx, t.G(), req)
	if err != nil {
		return err
	}

	// create the team section of the signature
	section, err := memSet.Section(t.Chain.GetID())
	if err != nil {
		return err
	}

	// create the change item
	sigMultiItem, err := t.sigChangeItem(section)
	if err != nil {
		return err
	}

	t.G().Log.Warning("sigMultiItem: %s", sigMultiItem)

	// create secret boxes for recipients
	secretBoxes, err := t.recipientBoxes(memSet)
	if err != nil {
		return err
	}

	// make the payload
	payload := t.sigPayload(sigMultiItem, secretBoxes)

	// send it to the server
	return t.postMulti(payload)
}

func (t *Team) makeKeys(ctx context.Context) error {
	var err error
	t.secret, err = t.SharedSecret(ctx)
	if err != nil {
		return err
	}
	t.signingKey, t.encryptionKey, err = generatePerTeamKeysFromSecret(t.secret)
	if err != nil {
		return err
	}

	return nil
}

func (t *Team) loadMe() (*libkb.User, error) {
	if t.me == nil {
		me, err := libkb.LoadMe(libkb.NewLoadUserArg(t.G()))
		if err != nil {
			return nil, err
		}
		t.me = me
	}

	return t.me, nil
}

func (t *Team) sigChangeItem(section SCTeamSection) (libkb.SigMultiItem, error) {
	me, err := t.loadMe()
	if err != nil {
		return libkb.SigMultiItem{}, err
	}
	deviceSigningKey, err := t.G().ActiveDevice.SigningKey()
	if err != nil {
		return libkb.SigMultiItem{}, err
	}
	sig, err := ChangeMembershipSig(me, t.Chain.GetLatestLinkID(), t.NextSeqno(), deviceSigningKey, section)
	if err != nil {
		return libkb.SigMultiItem{}, err
	}

	sigJSON, err := sig.Marshal()
	if err != nil {
		return libkb.SigMultiItem{}, err
	}

	v2Sig, err := makeSigchainV2OuterSig(
		deviceSigningKey,
		libkb.LinkTypeChangeMembership,
		t.NextSeqno(),
		sigJSON,
		t.Chain.GetLatestLinkID(),
		false, /* hasRevokes */
	)
	if err != nil {
		return libkb.SigMultiItem{}, err
	}

	sigMultiItem := libkb.SigMultiItem{
		Sig:        v2Sig,
		SigningKID: deviceSigningKey.GetKID(),
		Type:       string(libkb.LinkTypeChangeMembership),
		SigInner:   string(sigJSON),
		TeamID:     t.Chain.GetID(),
		PublicKeys: &libkb.SigMultiItemPublicKeys{
			Encryption: t.encryptionKey.GetKID(),
			Signing:    t.signingKey.GetKID(),
		},
	}
	return sigMultiItem, nil
}

func (t *Team) recipientBoxes(memSet *memberSet) (*PerTeamSharedSecretBoxes, error) {
	deviceEncryptionKey, err := t.G().ActiveDevice.EncryptionKey()
	if err != nil {
		return nil, err
	}
	return boxTeamSharedSecret(t.secret, deviceEncryptionKey, memSet.recipients)
}

func (t *Team) sigPayload(sigMultiItem libkb.SigMultiItem, secretBoxes *PerTeamSharedSecretBoxes) libkb.JSONPayload {
	payload := make(libkb.JSONPayload)
	payload["sigs"] = []interface{}{sigMultiItem}
	payload["per_team_key"] = secretBoxes
	return payload
}

func (t *Team) postMulti(payload libkb.JSONPayload) error {
	_, err := t.G().API.PostJSON(libkb.APIArg{
		Endpoint:    "sig/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	})
	if err != nil {
		return err
	}
	return nil
}
