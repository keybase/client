package teams

import (
	"encoding/base64"
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type TeamBox struct {
	Nonce           string
	SenderKID       keybase1.KID `json:"sender_kid"`
	Generation      int
	Ctext           string
	PerUserKeySeqno keybase1.Seqno `json:"per_user_key_seqno"`
}

func (t *TeamBox) NonceBytes() ([]byte, error) {
	return base64.StdEncoding.DecodeString(t.Nonce)
}

func (t *TeamBox) CtextBytes() ([]byte, error) {
	return base64.StdEncoding.DecodeString(t.Ctext)
}

func (t *TeamBox) Open(encKey *libkb.NaclDHKeyPair) ([]byte, error) {
	nonce, err := t.NonceBytes()
	if err != nil {
		return nil, err
	}
	ctext, err := t.CtextBytes()
	if err != nil {
		return nil, err
	}
	nei := &libkb.NaclEncryptionInfo{
		Ciphertext:     ctext,
		EncryptionType: libkb.KIDNaclDH,
		Nonce:          nonce,
		Receiver:       encKey.GetKID().ToBytes(),
		Sender:         t.SenderKID.ToBytes(),
	}

	plaintext, _, err := encKey.Decrypt(nei)
	if err != nil {
		return nil, err
	}

	return plaintext, nil
}

type Team struct {
	Name  string
	Chain *TeamSigChainState
	Box   TeamBox

	libkb.Contextified
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

func (t *Team) Section() (SCTeamSection, error) {
	teamSection := SCTeamSection{
		ID: (SCTeamID)(t.Chain.GetID()),
	}

	return teamSection, nil
}

func (t *Team) perUserEncryptionKey(ctx context.Context) (*libkb.NaclDHKeyPair, error) {
	// TeamBox has PerUserKeySeqno but libkb.PerUserKeyring has no seqnos.
	// ComputedKeyInfos does, though, so let's find the key there first, then
	// look for it in libkb.PerUserKeyring.

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(t.G()))
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
