package libkb

import (
	"crypto/rsa"
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

type KeyGen struct {
	me       *User
	bundle   *PgpKeyBundle
	p3skb    *P3SKB
	tsec     *triplesec.Cipher
	httpArgs *HttpArgs
	arg      *KeyGenArg
	phase    int
}

func (s *KeyGen) CheckNoKey() error {
	fp, err := s.me.GetActivePgpFingerprint()
	if err == nil && fp != nil {
		err = KeyExistsError{fp}
	}
	return err
}

func (s *KeyGen) LoadMe() (err error) {
	s.me, err = LoadMe(LoadUserArg{PublicKeyOptional: true})
	return err
}

func (s *KeyGen) GenerateKey() (err error) {
	if s.arg.Id == nil {
		s.arg.Id = KeybaseIdentity("")
	}
	s.bundle, err = NewPgpKeyBundle(*s.arg)
	return
}

func (s *KeyGen) WriteKey() (err error) {
	return WriteP3SKBToKeyring(s.bundle, s.tsec)
}

func (s *KeyGen) GeneratePost() (err error) {
	var jw *jsonw.Wrapper
	var seckey, pubkey string
	var sig string
	var sigid *SigId

	if jw, err = s.me.SelfProof(); err != nil {
		return
	}
	if sig, sigid, err = SignJson(jw, s.bundle); err != nil {
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
		"is_primary":   I{1},
	}
	if s.arg.DoSecretPush {
		s.httpArgs.Add("private_key", S{seckey})
	}
	return
}

func (s *KeyGen) PostToServer() error {
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
	DoSecretPush bool
	NoPassphrase bool
	KbPassphrase bool
	DoNaclEddsa  bool
	DoNaclDH     bool
	Pregen       *PgpKeyBundle
}

func (s *KeyGen) UpdateUser() error {
	err := s.me.SetActiveKey(s.bundle)
	fp := s.bundle.GetFingerprint()
	G.Env.GetConfigWriter().SetPgpFingerprint(&fp)
	return err
}

func (s *KeyGen) ReloadMe() (err error) {
	s.me, err = LoadMe(LoadUserArg{ForceReload: true})
	return
}

func NewKeyGen(arg *KeyGenArg) *KeyGen {
	return &KeyGen{arg: arg, phase: KEYGEN_PHASE_NONE}
}

const (
	KEYGEN_PHASE_NONE      = iota
	KEYGEN_PHASE_CHECKED   = iota
	KEYGEN_PHASE_GENERATED = iota
	KEYGEN_PHASE_POSTED    = iota
)

func (s *KeyGen) LoginAndCheckKey() (err error) {

	G.Log.Debug("+ KeyGen::LoginAndCheckKey")
	defer func() {
		G.Log.Debug("- Keygen::LoginAndCheckKey: %s", ErrToOk(err))
	}()

	if s.phase == KEYGEN_PHASE_CHECKED {
		G.Log.Debug("| LoginAndCheckKey skipped (already performed)")
		return nil
	} else if s.phase != KEYGEN_PHASE_NONE {
		return InternalError{"bad use of Keygen; wrong phase"}
	}

	if err = G.LoginState.Login(LoginArg{}); err != nil {
		return
	}

	G.Log.Debug("| Load me")
	if err = s.LoadMe(); err != nil {
		return
	}

	G.Log.Debug("| CheckNoKey")
	if err = s.CheckNoKey(); err != nil {
		return
	}

	s.phase = KEYGEN_PHASE_CHECKED

	return
}

func (s *KeyGen) GenNacl() (err error) {
	var sibkey GenericKey
	sibkey = s.bundle
	if s.arg.DoNaclEddsa {
		gen := NewNaclKeyGen(NaclKeyGenArg{
			Sibling:   sibkey,
			Generator: GenerateNaclSigningKeyPair,
		})
		if err = gen.Run(); err == nil {
			sibkey = gen.GetKeyPair()
		}
	}
	if err == nil && s.arg.DoNaclDH {
		gen := NewNaclKeyGen(NaclKeyGenArg{
			Sibling:   sibkey,
			Generator: GenerateNaclDHKeyPair,
		})
		err = gen.Run()
	}
	return err
}

func (s *KeyGen) Run() (ret *PgpKeyBundle, err error) {

	G.Log.Debug("+ KeyGen::Run")
	defer func() {
		G.Log.Debug("- KeyGen::Run -> %s", ErrToOk(err))
	}()

	if err = s.LoginAndCheckKey(); err != nil {
	} else if ret, err = s.Generate(); err != nil {
	} else if err = s.Push(); err != nil {
	} else {
		err = s.GenNacl()
	}

	return
}

func (s *KeyGen) Generate() (ret *PgpKeyBundle, err error) {

	G.Log.Debug("+ KeyGen::Generate")
	defer func() {
		G.Log.Debug("- KeyGen::Generate -> %s", ErrToOk(err))
	}()

	if s.phase != KEYGEN_PHASE_CHECKED {
		err = InternalError{"bad use of Keygen; wrong phase"}
		return
	}

	useKbPp := s.arg.DoSecretPush || s.arg.KbPassphrase

	larg := LoginArg{}

	if useKbPp {
		// If we're not using a PW, we have to check that we have the right
		// password loaded into our triplesec, so need to force a relogin
		larg.Force = true
		larg.Retry = 4
	}

	if useKbPp && G.LoginState.tsec == nil {
		if err = G.LoginState.Login(LoginArg{Force: true, Retry: 4}); err != nil {
			return
		}
	}

	if useKbPp {
		s.tsec = G.LoginState.tsec
	} else if !s.arg.NoPassphrase {
		s.tsec, err = PromptForNewTsec(PromptArg{
			TerminalPrompt: "A good passphrase to protect your key",
			PinentryDesc:   "Please pick a good passphrase to protect your key (12+ characters)",
			PinentryPrompt: "Key passphrase",
		})
		if err != nil {
			return
		}
	}

	G.Log.Debug("| GenerateKey")
	if s.arg.Pregen == nil {
		if err = s.GenerateKey(); err != nil {
			return
		}
	} else {
		s.bundle = s.arg.Pregen
	}

	G.Log.Debug("| WriteKey")
	if err = s.WriteKey(); err != nil {
		return
	}

	s.phase = KEYGEN_PHASE_GENERATED
	return
}

func (s *KeyGen) Push() (err error) {

	G.Log.Debug("+ KeyGen::Push")
	defer func() {
		G.Log.Debug("- KeyGen::Push -> %s", ErrToOk(err))
	}()

	if s.phase != KEYGEN_PHASE_GENERATED {
		return InternalError{"bad use of Keygen; wrong phase"}
	}

	if !s.arg.DoPush && !s.arg.DoSecretPush {
		G.Log.Debug("| Push skipped")
		return nil
	}

	G.Log.Debug("| UpdateUser")
	if err = s.UpdateUser(); err != nil {
		return
	}
	G.Log.Debug("| Generate HTTP Post")
	if err = s.GeneratePost(); err != nil {
		return
	}
	G.Log.Debug("| Post to server")
	if err = s.PostToServer(); err != nil {
		return
	}
	G.Log.Debug("| Reload user")
	err = s.ReloadMe()

	s.phase = KEYGEN_PHASE_POSTED

	return
}
