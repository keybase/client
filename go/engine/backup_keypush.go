// BackupKeypush creates backup keys for a user and pushes them to
// the server.
//

package engine

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

// BackupKeypush is an engine.
type BackupKeypush struct {
	passphrase string
	libkb.Contextified
}

// NewBackupKeypush creates a BackupKeypush engine.
func NewBackupKeypush(g *libkb.GlobalContext) *BackupKeypush {
	return &BackupKeypush{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *BackupKeypush) Name() string {
	return "BackupKeypush"
}

// GetPrereqs returns the engine prereqs.
func (e *BackupKeypush) Prereqs() Prereqs {
	return Prereqs{
		Session: true,
	}
}

// RequiredUIs returns the required UIs.
func (e *BackupKeypush) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LoginUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *BackupKeypush) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&DetKeyEngine{},
		&RevokeEngine{},
	}
}

// Run starts the engine.
func (e *BackupKeypush) Run(ctx *Context) error {
	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return err
	}

	eldest := me.GetEldestKID()
	if eldest == nil {
		return fmt.Errorf("no eldest key found; cannot generate backup keys")
	}

	// check for existing backup keys
	cki := me.GetComputedKeyInfos()
	if cki == nil {
		return fmt.Errorf("no computed key infos")
	}
	var needReload bool
	for _, bdev := range cki.BackupDevices() {
		revoke, err := ctx.LoginUI.PromptRevokeBackupDeviceKeys(
			keybase1.PromptRevokeBackupDeviceKeysArg{
				Device: *bdev.ProtExport(),
			})
		if err != nil {
			e.G().Log.Warning("prompt error: %s", err)
			continue
		}
		if !revoke {
			continue
		}
		reng := NewRevokeDeviceEngine(bdev.ID, e.G())
		if err := RunEngine(reng, ctx); err != nil {
			// probably not a good idea to continue...
			return err
		}
		needReload = true
	}

	if needReload {
		me, err = libkb.LoadMe(libkb.LoadUserArg{})
		if err != nil {
			return err
		}
	}

	locked, which, err := e.G().Keyrings.GetSecretKeyLocked(ctx.LoginContext, libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	})
	if err != nil {
		return err
	}
	signingKey, err := locked.PromptAndUnlock(ctx.LoginContext, "backup key signature", which, nil, ctx.SecretUI, nil)
	if err != nil {
		return err
	}

	words, err := libkb.SecWordList(libkb.BackupKeyPhraseEntropy)
	if err != nil {
		return err
	}
	e.passphrase = strings.Join(words, " ")

	/*
		key, err := scrypt.Key([]byte(e.passphrase), nil,
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
			Me:          me,
			SigningKey:  signingKey,
			EldestKeyID: *eldest,
			Device:      dev,
		}

		dkeng := NewDetKeyEngine(dkarg, e.G())
		err = RunEngine(dkeng, ctx)
		if err != nil {
			return err
		}
	*/
	kgarg := &BackupKeygenArg{
		Passphrase:  e.passphrase,
		Me:          me,
		SigningKey:  signingKey,
		EldestKeyID: *eldest,
	}
	kgeng := NewBackupKeygen(kgarg, e.G())
	if err := RunEngine(kgeng, ctx); err != nil {
		return err
	}

	return nil
}

func (e *BackupKeypush) Passphrase() string {
	return e.passphrase
}
