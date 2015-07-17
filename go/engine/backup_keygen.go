package engine

import (
	"bytes"
	"fmt"

	"github.com/agl/ed25519"
	"golang.org/x/crypto/nacl/box"
	"golang.org/x/crypto/scrypt"

	"github.com/keybase/client/go/libkb"
)

type BackupKeygenArg struct {
	Passphrase string
	SkipPush   bool
	Me         *libkb.User
	SigningKey libkb.GenericKey
}

// BackupKeygen is an engine.
type BackupKeygen struct {
	arg    *BackupKeygenArg
	sigKey libkb.GenericKey
	encKey libkb.GenericKey
	libkb.Contextified
}

// NewBackupKeygen creates a BackupKeygen engine.
func NewBackupKeygen(arg *BackupKeygenArg, g *libkb.GlobalContext) *BackupKeygen {
	return &BackupKeygen{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *BackupKeygen) Name() string {
	return "BackupKeygen"
}

// GetPrereqs returns the engine prereqs.
func (e *BackupKeygen) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *BackupKeygen) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *BackupKeygen) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&DetKeyEngine{},
	}
}

func (e *BackupKeygen) SigKey() libkb.GenericKey {
	return e.sigKey
}

func (e *BackupKeygen) EncKey() libkb.GenericKey {
	return e.encKey
}

// Run starts the engine.
func (e *BackupKeygen) Run(ctx *Context) error {

	fmt.Printf("keygen passphrase: %q\n", e.arg.Passphrase)

	// make the passphrase stream
	key, err := scrypt.Key([]byte(e.arg.Passphrase), nil,
		libkb.BackupKeyScryptCost, libkb.BackupKeyScryptR, libkb.BackupKeyScryptP, libkb.BackupKeyScryptKeylen)
	if err != nil {
		return err
	}

	ppStream := libkb.NewPassphraseStream(key)

	if err := e.makeSigKey(ppStream); err != nil {
		return err
	}
	if err := e.makeEncKey(ppStream); err != nil {
		return err
	}

	if err := e.push(ctx); err != nil {
		return err
	}

	return nil
}

func (e *BackupKeygen) makeSigKey(ppStream *libkb.PassphraseStream) error {
	pub, priv, err := ed25519.GenerateKey(bytes.NewBuffer(ppStream.EdDSASeed()))
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

func (e *BackupKeygen) makeEncKey(ppStream *libkb.PassphraseStream) error {
	pub, priv, err := box.GenerateKey(bytes.NewBuffer(ppStream.DHSeed()))
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

func (e *BackupKeygen) push(ctx *Context) error {
	if e.arg.SkipPush {
		return nil
	}

	dev, err := libkb.NewBackupDevice()
	if err != nil {
		return err
	}

	sigDel := libkb.Delegator{
		NewKey:      e.sigKey,
		Sibkey:      true,
		Expire:      libkb.NaclEdDSAExpireIn,
		ExistingKey: e.arg.SigningKey,
		Me:          e.arg.Me,
		Device:      dev,
	}
	if err := sigDel.Run(ctx.LoginContext); err != nil {
		return err
	}

	sigEnc := libkb.Delegator{
		NewKey:      e.encKey,
		Sibkey:      false,
		Expire:      libkb.NaclDHExpireIn,
		ExistingKey: e.sigKey,
		Me:          e.arg.Me,
		Device:      dev,
	}
	if err := sigEnc.Run(ctx.LoginContext); err != nil {
		return err
	}

	return nil
}
