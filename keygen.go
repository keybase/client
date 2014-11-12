package libkb

import (
	"crypto/rsa"
	"fmt"
	"github.com/keybase/go-triplesec"
	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/errors"
	"golang.org/x/crypto/openpgp/packet"
)

//
// General Strategy:
//
//   1. Use AGL's NewEntity() with a keybase UID to generate a new
//      key.  Or maybe go with a 2-subkey configuration/
//   2. Triplesec the result and write to ~/.config/keybase/keys.3s
//   3. Sign a signature link.
//   4. Upload public and signature to server (optionally upload private)
//   5. Change local DB and rewrite user to reflect what we just uploaded
//

// NewEntity returns an Entity that contains a fresh RSA/RSA keypair with a
// single identity composed of the given full name, comment and email, any of
// which may be empty but must not contain any of "()<>\x00".
// If config is nil, sensible defaults will be used.
//
// Modification of: https://code.google.com/p/go/source/browse/openpgp/keys.go?repo=crypto&r=8fec09c61d5d66f460d227fd1df3473d7e015bc6#456
//  From golang.com/x/crypto/openpgp/keys.go
func NewPgpKeyBundle(arg KeyGenArg) (*PgpKeyBundle, error) {
	currentTime := arg.Config.Now()

	uid := arg.Id.ToPgpUserId()

	if uid == nil {
		return nil, errors.InvalidArgumentError("UserId field was nil")
	}

	if arg.PrimaryBits == 0 {
		arg.PrimaryBits = 4096
	}
	if arg.SubkeyBits == 0 {
		arg.SubkeyBits = 4096
	}

	G.Log.Info("Generating primary key (%d bits)", arg.PrimaryBits)
	masterPriv, err := rsa.GenerateKey(arg.Config.Random(), arg.PrimaryBits)
	if err != nil {
		return nil, err
	}

	G.Log.Info("Generating encryption subkey (%d bits)", arg.SubkeyBits)
	encryptingPriv, err := rsa.GenerateKey(arg.Config.Random(), arg.SubkeyBits)
	if err != nil {
		return nil, err
	}
	G.Log.Info("Generating signing subkey (%d bits)", arg.SubkeyBits)
	signingPriv, err := rsa.GenerateKey(arg.Config.Random(), arg.SubkeyBits)
	if err != nil {
		return nil, err
	}

	e := &openpgp.Entity{
		PrimaryKey: packet.NewRSAPublicKey(currentTime, &masterPriv.PublicKey),
		PrivateKey: packet.NewRSAPrivateKey(currentTime, masterPriv),
		Identities: make(map[string]*openpgp.Identity),
	}
	isPrimaryId := true
	e.Identities[uid.Id] = &openpgp.Identity{
		Name:   uid.Name,
		UserId: uid,
		SelfSignature: &packet.Signature{
			CreationTime: currentTime,
			SigType:      packet.SigTypePositiveCert,
			PubKeyAlgo:   packet.PubKeyAlgoRSA,
			Hash:         arg.Config.Hash(),
			IsPrimaryId:  &isPrimaryId,
			FlagsValid:   true,
			FlagSign:     true,
			FlagCertify:  true,
			IssuerKeyId:  &e.PrimaryKey.KeyId,
		},
	}

	e.Subkeys = make([]openpgp.Subkey, 2)
	e.Subkeys[0] = openpgp.Subkey{
		PublicKey:  packet.NewRSAPublicKey(currentTime, &encryptingPriv.PublicKey),
		PrivateKey: packet.NewRSAPrivateKey(currentTime, encryptingPriv),
		Sig: &packet.Signature{
			CreationTime:              currentTime,
			SigType:                   packet.SigTypeSubkeyBinding,
			PubKeyAlgo:                packet.PubKeyAlgoRSA,
			Hash:                      arg.Config.Hash(),
			FlagsValid:                true,
			FlagEncryptStorage:        true,
			FlagEncryptCommunications: true,
			IssuerKeyId:               &e.PrimaryKey.KeyId,
		},
	}
	e.Subkeys[0].PublicKey.IsSubkey = true
	e.Subkeys[0].PrivateKey.IsSubkey = true

	e.Subkeys[1] = openpgp.Subkey{
		PublicKey:  packet.NewRSAPublicKey(currentTime, &signingPriv.PublicKey),
		PrivateKey: packet.NewRSAPrivateKey(currentTime, signingPriv),
		Sig: &packet.Signature{
			CreationTime: currentTime,
			SigType:      packet.SigTypeSubkeyBinding,
			PubKeyAlgo:   packet.PubKeyAlgoRSA,
			Hash:         arg.Config.Hash(),
			FlagsValid:   true,
			FlagSign:     true,
			IssuerKeyId:  &e.PrimaryKey.KeyId,
		},
	}
	e.Subkeys[1].PublicKey.IsSubkey = true
	e.Subkeys[1].PrivateKey.IsSubkey = true

	return (*PgpKeyBundle)(e), nil
}

type keyGenState struct {
	Me     *User
	Bundle *PgpKeyBundle
}

func (s *keyGenState) CheckNoKey() error {
	fp, err := s.Me.GetActivePgpFingerprint()
	if err == nil && fp != nil {
		err = KeyExistsError{fp}
	}
	return nil
}

func (s *keyGenState) LoadMe() (err error) {
	s.Me, err = LoadMe(LoadUserArg{SkipCheckKey: true})
	return err
}

func (s *keyGenState) GenerateKey(arg KeyGenArg) (err error) {
	if arg.Id == nil {
		arg.Id = KeybaseIdentity("")
	}
	s.Bundle, err = NewPgpKeyBundle(arg)
	return
}

func (s *keyGenState) WriteKey(tsec *triplesec.Cipher) (err error) {
	var p3skb *P3SKB
	if p3skb, err = s.Bundle.ToP3SKB(tsec); err != nil {
	} else if G.Keyrings == nil {
		err = fmt.Errorf("No keyrings available")
	} else if err = G.Keyrings.P3SKB.Push(p3skb); err != nil {
	} else if err = G.Keyrings.P3SKB.Save(); err != nil {
	}
	return
}

type KeyGenArg struct {
	Tsec        *triplesec.Cipher
	PrimaryBits int
	SubkeyBits  int
	Id          *Identity
	Config      *packet.Config
}

func KeyGen(arg KeyGenArg) (ret *PgpKeyBundle, err error) {
	state := keyGenState{}

	G.Log.Debug("+ KeyGen")
	defer func() {
		G.Log.Debug("- Keygen: %s", ErrToOk(err))
	}()

	G.Log.Debug("| Load me")
	if err = state.LoadMe(); err != nil {
		return
	}
	G.Log.Debug("| CheckNoKey")
	if err = state.CheckNoKey(); err != nil {
		return
	}
	G.Log.Debug("| GenerateKey")
	if err = state.GenerateKey(arg); err != nil {
		return
	}
	G.Log.Debug("| WriteKey")
	if err = state.WriteKey(arg.Tsec); err != nil {
		return
	}
	return
}
