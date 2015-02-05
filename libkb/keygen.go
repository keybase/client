package libkb

import (
	"crypto/rsa"
	stderrors "errors"
	"fmt"
	"strings"

	jsonw "github.com/keybase/go-jsonw"
	triplesec "github.com/keybase/go-triplesec"
	keybase_1 "github.com/keybase/protocol/go"
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

	if len(arg.Ids) == 0 {
		return nil, errors.InvalidArgumentError("No Ids in KeyGenArg")
	}
	uids, err := arg.PGPUserIDs()
	if err != nil {
		return nil, err
	}
	for i, id := range arg.Ids {
		extra := ""
		if i == 0 {
			extra = "[primary]"
		}
		arg.LogUI.Info("PGP User ID: %s %s", id, extra)
	}

	arg.LogUI.Info("Generating primary key (%d bits)", arg.PrimaryBits)
	masterPriv, err := rsa.GenerateKey(arg.Config.Random(), arg.PrimaryBits)
	if err != nil {
		return nil, err
	}

	arg.LogUI.Info("Generating encryption subkey (%d bits)", arg.SubkeyBits)
	encryptingPriv, err := rsa.GenerateKey(arg.Config.Random(), arg.SubkeyBits)
	if err != nil {
		return nil, err
	}

	e := &openpgp.Entity{
		PrimaryKey: packet.NewRSAPublicKey(currentTime, &masterPriv.PublicKey),
		PrivateKey: packet.NewRSAPrivateKey(currentTime, masterPriv),
		Identities: make(map[string]*openpgp.Identity),
	}
	for i, uid := range uids {
		isPrimaryId := true
		if i > 0 {
			isPrimaryId = false
		}
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
	}

	e.Subkeys = make([]openpgp.Subkey, 1)
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

	return (*PgpKeyBundle)(e), nil
}

type KeyGen struct {
	me        *User
	bundle    *PgpKeyBundle
	p3skb     *P3SKB
	tsec      *triplesec.Cipher
	httpArgs  *HttpArgs
	arg       *KeyGenArg
	phase     int
	chainTail MerkleTriple
}

func (s *KeyGen) CheckNoKey() error {
	if s.me.HasActiveKey() {
		return KeyExistsError{}
	}
	return nil
}

func (s *KeyGen) LoadMe() (err error) {
	s.me, err = LoadMe(LoadUserArg{PublicKeyOptional: true})
	return err
}

func (s *KeyGen) GenerateKey() (err error) {
	if err = s.arg.CreatePgpIDs(); err != nil {
		return
	}
	s.bundle, err = NewPgpKeyBundle(*s.arg)
	return
}

func (s *KeyGen) WriteKey() (err error) {
	s.p3skb, err = WriteTsecP3SKBToKeyring(s.bundle, s.tsec, s.arg.LogUI)
	return
}

func (s *KeyGen) GeneratePost() (err error) {
	var jw *jsonw.Wrapper
	var seckey, pubkey string
	var sig string
	var sigid *SigId

	fokid := GenericKeyToFOKID(s.bundle)

	if jw, err = s.me.SelfProof(s.bundle, &fokid); err != nil {
		return
	}
	if sig, sigid, s.chainTail.linkId, err = SignJson(jw, s.bundle); err != nil {
		return
	}
	s.chainTail.sigId = sigid
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
	Ids          Identities
	Config       *packet.Config
	NoPublicPush bool
	DoSecretPush bool
	NoPassphrase bool
	KbPassphrase bool
	NoNaclEddsa  bool
	NoNaclDh     bool
	Pregen       *PgpKeyBundle
	KeyGenUI     KeyGenUI
	LoginUI      LoginUI
	LogUI        LogUI
	SecretUI     SecretUI
	Passphrase   string
	PGPUids      []string
	NoDefPGPUid  bool
}

var ErrKeyGenArgNoDefNoCustom = stderrors.New("invalid args:  NoDefPGPUid set, but no custom PGPUids.")

// CreateIDs creates identities for KeyGenArg.Ids if none exist.
// It uses PGPUids to determine the set of Ids.  It does not set the
// default keybase.io uid.  AddDefaultUid() does that.
func (a *KeyGenArg) CreatePgpIDs() error {
	if len(a.Ids) > 0 {
		return nil
	}
	for _, id := range a.PGPUids {
		if !strings.Contains(id, "<") && CheckEmail.F(id) {
			a.Ids = append(a.Ids, Identity{Email: id})
			continue
		}
		parsed, err := ParseIdentity(id)
		if err != nil {
			return err
		}
		a.Ids = append(a.Ids, *parsed)
	}
	return nil
}

func (a *KeyGenArg) AddDefaultUid() {
	if a.NoDefPGPUid {
		return
	}
	a.Ids = append(a.Ids, KeybaseIdentity(""))
}

func (a *KeyGenArg) PGPUserIDs() ([]*packet.UserId, error) {
	uids := make([]*packet.UserId, len(a.Ids))
	for i, id := range a.Ids {
		uids[i] = id.ToPgpUserId()
		if uids[i] == nil {
			return nil, fmt.Errorf("Id[%d] failed to convert to PGPUserId (%+v)", i, id)
		}
	}
	return uids, nil
}

func (s *KeyGen) UpdateUser() error {
	err := s.me.localDelegateKey(s.bundle, nil, nil, true)
	fp := s.bundle.GetFingerprint()
	G.Env.GetConfigWriter().SetPgpFingerprint(&fp)
	G.Log.Debug("| Fudge User Sig Chain")
	s.me.sigChain.Bump(s.chainTail)
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

	if err = G.LoginState.Login(LoginArg{
		Ui:       s.arg.LoginUI,
		SecretUI: s.arg.SecretUI,
		NoUi:     true}); err != nil {
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
	var signer GenericKey
	signer = s.bundle
	G.Log.Debug("+ GenNacl()")
	defer func() {
		G.Log.Debug("- GenNacl() -> %s", ErrToOk(err))
	}()
	if !s.arg.NoNaclEddsa {
		s.arg.LogUI.Info("Generating NaCl EdDSA key (255 bits on Curve25519)")
		gen := NewNaclKeyGen(NaclKeyGenArg{
			Signer:    signer,
			Primary:   s.bundle,
			Generator: GenerateNaclSigningKeyPair,
			Type:      SIBKEY_TYPE,
			Me:        s.me,
			ExpireIn:  NACL_EDDSA_EXPIRE_IN,
			LogUI:     s.arg.LogUI,
		})
		err = gen.Run()
		signer = gen.GetKeyPair()
	}

	if err != nil || s.arg.NoNaclDh {
		return
	}

	s.arg.LogUI.Info("Generating NaCl DH-key (255 bits on Curve25519)")
	gen := NewNaclKeyGen(NaclKeyGenArg{
		Signer:    signer,
		Primary:   s.bundle,
		Generator: GenerateNaclDHKeyPair,
		Type:      SUBKEY_TYPE,
		Me:        s.me,
		ExpireIn:  NACL_DH_EXPIRE_IN,
		LogUI:     s.arg.LogUI,
	})
	err = gen.Run()
	return err
}

func (a *KeyGenArg) Init() (err error) {
	if a.LogUI == nil {
		a.LogUI = G.Log
	}
	if a.PrimaryBits == 0 {
		a.PrimaryBits = 4096
	}
	if a.SubkeyBits == 0 {
		a.SubkeyBits = 4096
	}
	if (!a.NoNaclDh || !a.NoNaclEddsa) && a.NoPublicPush {
		err = KeyGenError{"Can't generate NaCl keys without a public push"}
	}
	return
}

func (s *KeyGen) Init() error {
	return s.arg.Init()
}

func (s *KeyGen) Prompt() (err error) {
	if ui := s.arg.KeyGenUI; ui != nil {
		var pp keybase_1.PushPreferences
		if pp, err = ui.GetPushPreferences(); err == nil {
			s.arg.NoPublicPush = !pp.Public
			s.arg.DoSecretPush = pp.Private
		}
	}
	return err
}

func (s *KeyGen) Run() (ret *PgpKeyBundle, err error) {

	G.Log.Debug("+ KeyGen::Run")
	defer func() {
		G.Log.Debug("- KeyGen::Run -> %s", ErrToOk(err))
	}()

	if err = s.Init(); err != nil {
	} else if err = s.LoginAndCheckKey(); err != nil {
	} else if err = s.Prompt(); err != nil {
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
		G.Log.Debug("| checking login state, with useKbPp=true")
		if err = G.LoginState.Login(LoginArg{
			Force:    true,
			Retry:    4,
			SecretUI: s.arg.SecretUI,
			Ui:       s.arg.LoginUI,
		}); err != nil {
			return
		}
	}

	if useKbPp {
		s.tsec = G.LoginState.tsec
	} else if s.arg.NoPassphrase {
	} else if len(s.arg.Passphrase) > 0 {
		s.tsec, err = triplesec.NewCipher([]byte(s.arg.Passphrase), nil)
	} else if s.arg.SecretUI == nil {
		G.Log.Debug("| No SecretUI before prompt")
		err = NoUiError{"secret"}
	} else {
		s.tsec, err = PromptForNewTsec(keybase_1.GetNewPassphraseArg{
			TerminalPrompt: "A good passphrase to protect your key",
			PinentryDesc:   "Please pick a good passphrase to protect your key (12+ characters)",
			PinentryPrompt: "Key passphrase",
		}, s.arg.SecretUI)
	}

	if err != nil {
		return
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

	if s.arg.NoPublicPush && !s.arg.DoSecretPush {
		G.Log.Debug("| Push skipped")
		return nil
	}

	G.Log.Debug("| Generate HTTP Post")
	if err = s.GeneratePost(); err != nil {
		return
	}
	G.Log.Debug("| Post to server")
	if err = s.PostToServer(); err != nil {
		return
	}

	G.Log.Debug("| UpdateUser")
	if err = s.UpdateUser(); err != nil {
		return
	}

	s.phase = KEYGEN_PHASE_POSTED

	return
}
