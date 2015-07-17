package engine

import (
	"golang.org/x/crypto/scrypt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

type BackupKeygenArg struct {
	Passphrase  string
	SkipPush    bool
	Me          *libkb.User
	SigningKey  libkb.GenericKey
	EldestKeyID keybase1.KID
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
	// make the passphrase stream
	key, err := scrypt.Key([]byte(e.arg.Passphrase), nil,
		libkb.BackupKeyScryptCost, libkb.BackupKeyScryptR, libkb.BackupKeyScryptP, libkb.BackupKeyScryptKeylen)
	if err != nil {
		return err
	}

	ppStream := libkb.NewPassphraseStream(key)

	dev, err := libkb.NewBackupDevice()
	if err != nil {
		return err
	}

	dkarg := &DetKeyArgs{
		PPStream:    ppStream,
		Device:      dev,
		Me:          e.arg.Me,
		SigningKey:  e.arg.SigningKey,
		EldestKeyID: e.arg.EldestKeyID,
		SkipPush:    e.arg.SkipPush,
	}

	dkeng := NewDetKeyEngine(dkarg, e.G())
	err = RunEngine(dkeng, ctx)
	if err != nil {
		return err
	}

	e.sigKey = dkeng.SigKey()
	e.encKey = dkeng.EncKey()

	return nil
}
