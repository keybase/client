package libkb

import (
	"crypto/rsa"
	"fmt"
	"github.com/keybase/go-jsonw"
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

//
// Todos:
//    A. Verify that the PW is correct (with server?) and/or allow other key
//       passwords to be used on the key
//    3. Signatures
//    4. Upload
//    5. Local DB changed to reflect the upload
//    B. Custom usernames
//    C. Custom Email Addresses
//

//
// Password strategy:
//   1. If server push, 3sec with login password.
//   2. If local write, prompt for new password
//
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
	me       *User
	bundle   *PgpKeyBundle
	p3skb    *P3SKB
	tsec     *triplesec.Cipher
	httpArgs *HttpArgs
}

func (s *keyGenState) CheckNoKey() error {
	fp, err := s.me.GetActivePgpFingerprint()
	if err == nil && fp != nil {
		err = KeyExistsError{fp}
	}
	return nil
}

func (s *keyGenState) LoadMe() (err error) {
	s.me, err = LoadMe(LoadUserArg{PublicKeyOptional: true})
	return err
}

func (s *keyGenState) GenerateKey(arg KeyGenArg) (err error) {
	if arg.Id == nil {
		arg.Id = KeybaseIdentity("")
	}
	s.bundle, err = NewPgpKeyBundle(arg)
	return
}

func (s *keyGenState) WriteKey() (err error) {
	if s.p3skb, err = s.bundle.ToP3SKB(s.tsec); err != nil {
	} else if G.Keyrings == nil {
		err = fmt.Errorf("No keyrings available")
	} else if err = G.Keyrings.P3SKB.Push(s.p3skb); err != nil {
	} else if err = G.Keyrings.P3SKB.Save(); err != nil {
	}
	return
}

func (s *keyGenState) GeneratePost() (err error) {
	var jw *jsonw.Wrapper
	var tmp []byte
	var seckey, pubkey string
	var sig string
	var sigid *SigId

	if jw, err = s.me.SelfProof(); err != nil {
		return
	}
	if tmp, err = jw.Marshal(); err != nil {
		return
	}
	fmt.Printf("XXX %s\n", string(tmp))
	if sig, sigid, err = SimpleSign(tmp, *s.bundle); err != nil {
		return
	}
	if pubkey, err = s.bundle.Encode(); err != nil {
		return
	}
	if seckey, err = s.p3skb.ArmoredEncode(); err != nil {
		return
	}

	s.httpArgs = &HttpArgs{
		"sig_id_base":  S{sigid.ToString(false)},
		"sig_id_short": S{sigid.ToShortId()},
		"sig":          S{sig},
		"public_key":   S{pubkey},
		"secret_key":   S{seckey},
		"is_primary":   I{1},
	}

	return
}

func (s *keyGenState) PostToServer() error {
	_, err := G.API.Post(ApiArg{
		Endpoint:    "key/add",
		NeedSession: true,
		Args:        *s.httpArgs,
	})
	return err
}

type KeyGenArg struct {
	PrimaryBits  int
	SubkeyBits   int
	Id           *Identity
	Config       *packet.Config
	DoPush       bool
	NoPassphrase bool
}

func (s *keyGenState) UpdateUser() error {
	return s.me.SetActiveKey(s.bundle)
}

func KeyGen(arg KeyGenArg) (ret *PgpKeyBundle, err error) {
	state := keyGenState{}

	G.Log.Debug("+ KeyGen")
	defer func() {
		G.Log.Debug("- Keygen: %s", ErrToOk(err))
	}()

	larg := LoginArg{}

	// If we're not using a PW, we have to check that we have the right
	// password loaded into our triplesec, so need to force a relogin
	if arg.DoPush {
		larg.Force = true
		larg.Retry = 4
	}

	if err = G.LoginState.Login(larg); err != nil {
		return
	}

	if arg.DoPush {
		state.tsec = G.LoginState.tsec
	} else if !arg.NoPassphrase {
		state.tsec, err = PromptForNewTsec(PromptArg{
			TerminalPrompt: "A good passphrase to protect your key",
			PinentryDesc:   "Please pick a good passphrase to protect your key (12+ characters)",
			PinentryPrompt: "Key passphrase",
		})
		if err != nil {
			return
		}
	}

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
	if err = state.WriteKey(); err != nil {
		return
	}
	G.Log.Debug("| UpdateUser")
	if err = state.UpdateUser(); err != nil {
		return
	}
	G.Log.Debug("| Generate HTTP Post")
	if err = state.GeneratePost(); err != nil {
		return
	}
	G.Log.Debug("| Post to server")
	if err = state.PostToServer(); err != nil {
		return
	}
	return
}
