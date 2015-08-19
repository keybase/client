package engine

import (
	"bytes"
	"encoding/hex"
	"errors"
	"fmt"

	"github.com/agl/ed25519"
	"golang.org/x/crypto/nacl/box"
	"golang.org/x/crypto/scrypt"

	"github.com/keybase/client/go/libkb"
)

type PaperKeyGenArg struct {
	Passphrase libkb.PaperKeyPhrase
	SkipPush   bool
	Me         *libkb.User
	SigningKey libkb.GenericKey
}

// PaperKeyGen is an engine.
type PaperKeyGen struct {
	arg    *PaperKeyGenArg
	sigKey libkb.GenericKey
	encKey libkb.GenericKey
	libkb.Contextified
}

// NewPaperKeyGen creates a PaperKeyGen engine.
func NewPaperKeyGen(arg *PaperKeyGenArg, g *libkb.GlobalContext) *PaperKeyGen {
	return &PaperKeyGen{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *PaperKeyGen) Name() string {
	return "PaperKeyGen"
}

// GetPrereqs returns the engine prereqs.
func (e *PaperKeyGen) Prereqs() Prereqs {
	// only need session if pushing keys
	return Prereqs{
		Session: !e.arg.SkipPush,
	}
}

// RequiredUIs returns the required UIs.
func (e *PaperKeyGen) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PaperKeyGen) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (e *PaperKeyGen) SigKey() libkb.GenericKey {
	return e.sigKey
}

func (e *PaperKeyGen) EncKey() libkb.GenericKey {
	return e.encKey
}

// Run starts the engine.
func (e *PaperKeyGen) Run(ctx *Context) error {
	// make the passphrase stream
	key, err := scrypt.Key(e.arg.Passphrase.Bytes(), nil,
		libkb.PaperKeyScryptCost, libkb.PaperKeyScryptR, libkb.PaperKeyScryptP, libkb.PaperKeyScryptKeylen)
	if err != nil {
		return err
	}

	ppStream := libkb.NewPassphraseStream(key)

	// make keys for the paper device
	if err := e.makeSigKey(ppStream.EdDSASeed()); err != nil {
		return err
	}
	if err := e.makeEncKey(ppStream.DHSeed()); err != nil {
		return err
	}

	// push everything to the server
	if err := e.push(ctx); err != nil {
		return err
	}

	return nil
}

func (e *PaperKeyGen) makeSigKey(seed []byte) error {
	pub, priv, err := ed25519.GenerateKey(bytes.NewBuffer(seed))
	if err != nil {
		return err
	}

	var key libkb.NaclSigningKeyPair
	copy(key.Public[:], (*pub)[:])
	key.Private = &libkb.NaclSigningKeyPrivate{}
	copy(key.Private[:], (*priv)[:])

	e.sigKey = key

	return nil
}

func (e *PaperKeyGen) makeEncKey(seed []byte) error {
	pub, priv, err := box.GenerateKey(bytes.NewBuffer(seed))
	if err != nil {
		return err
	}
	var key libkb.NaclDHKeyPair
	copy(key.Public[:], (*pub)[:])
	key.Private = &libkb.NaclDHKeyPrivate{}
	copy(key.Private[:], (*priv)[:])

	e.encKey = key

	return nil
}

func (e *PaperKeyGen) getClientHalfFromSecretStore() ([]byte, libkb.PassphraseGeneration, error) {
	zeroGen := libkb.PassphraseGeneration(0)

	secretStore := libkb.NewSecretStore(e.arg.Me.GetNormalizedName())
	if secretStore == nil {
		return nil, zeroGen, errors.New("No secret store available")
	}

	secret, err := secretStore.RetrieveSecret()
	if err != nil {
		return nil, zeroGen, err
	}

	devid := e.G().Env.GetDeviceID()
	if devid.IsNil() {
		return nil, zeroGen, fmt.Errorf("no device id set")
	}

	var dev libkb.DeviceKey
	aerr := e.G().LoginState().Account(func(a *libkb.Account) {
		if err = libkb.RunSyncer(a.SecretSyncer(), e.arg.Me.GetUID(), a.LoggedIn(), a.LocalSession()); err != nil {
			return
		}
		dev, err = a.SecretSyncer().FindDevice(devid)
	}, "BackupKeygen.Run() -- retrieving passphrase generation)")
	if aerr != nil {
		return nil, zeroGen, aerr
	}
	if err != nil {
		return nil, zeroGen, err
	}

	serverHalf, err := hex.DecodeString(dev.LksServerHalf)
	if err != nil {
		return nil, zeroGen, err
	}

	if len(secret) != len(serverHalf) {
		return nil, zeroGen, fmt.Errorf("secret has length %d, server half has length %d", len(secret), len(serverHalf))
	}

	clientHalf := make([]byte, len(secret))
	libkb.XORBytes(clientHalf, secret, serverHalf)

	return clientHalf, dev.PPGen, nil
}

func (e *PaperKeyGen) push(ctx *Context) error {
	if e.arg.SkipPush {
		return nil
	}

	// Create a new paper key device. Need the passphrase prefix
	// for the paper device name.  This is the first two words in
	// the passphrase.  There is sufficient entropy to cover this...
	backupDev, err := libkb.NewPaperDevice(e.arg.Passphrase.Prefix())
	if err != nil {
		return err
	}

	// create lks halves for this device.  Note that they aren't used for
	// local, encrypted storage of the paper keys, but just for recovery
	// purposes.

	foundStream := false
	var ppgen libkb.PassphraseGeneration
	var clientHalf []byte
	if ctx.LoginContext != nil {
		stream := ctx.LoginContext.PassphraseStreamCache().PassphraseStream()
		if stream != nil {
			foundStream = true
			ppgen = stream.Generation()
			clientHalf = stream.LksClientHalf()
		}
	} else {
		e.G().LoginState().Account(func(a *libkb.Account) {
			stream := a.PassphraseStream()
			if stream == nil {
				return
			}
			foundStream = true
			ppgen = stream.Generation()
			clientHalf = stream.LksClientHalf()
		}, "BackupKeygen - push")
	}

	// stream was nil, so we must have loaded lks from the secret
	// store.
	if !foundStream {
		clientHalf, ppgen, err = e.getClientHalfFromSecretStore()
		if err != nil {
			return err
		}
	}

	backupLks := libkb.NewLKSecWithClientHalf(clientHalf, ppgen, e.arg.Me.GetUID(), e.G())
	// Set the server half to be empty, as we don't need it.
	backupLks.SetServerHalf(make([]byte, len(clientHalf)))

	ctext, err := backupLks.EncryptClientHalfRecovery(e.encKey)
	if err != nil {
		return err
	}

	// post them to the server.
	if err := libkb.PostDeviceLKS(ctx.LoginContext, backupDev.ID, libkb.DeviceTypePaper, backupLks.GetServerHalf(), backupLks.Generation(), ctext, e.encKey.GetKID()); err != nil {
		return err
	}

	// push the paper signing key
	sigDel := libkb.Delegator{
		NewKey:      e.sigKey,
		Sibkey:      true,
		Expire:      libkb.NaclEdDSAExpireIn,
		ExistingKey: e.arg.SigningKey,
		Me:          e.arg.Me,
		Device:      backupDev,
	}

	// push the paper encryption key
	sigEnc := libkb.Delegator{
		NewKey:      e.encKey,
		Sibkey:      false,
		Expire:      libkb.NaclDHExpireIn,
		ExistingKey: e.sigKey,
		Me:          e.arg.Me,
		Device:      backupDev,
	}

	return libkb.DelegatorAggregator(ctx.LoginContext, []libkb.Delegator{sigDel, sigEnc})
}
