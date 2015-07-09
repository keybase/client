// BackupKeygen creates backup keys for a user.
//

package engine

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/scrypt"
)

// BackupKeygen is an engine.
type BackupKeygen struct {
	passphrase string
	libkb.Contextified
}

// NewBackupKeygen creates a BackupKeygen engine.
func NewBackupKeygen(g *libkb.GlobalContext) *BackupKeygen {
	return &BackupKeygen{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *BackupKeygen) Name() string {
	return "BackupKeygen"
}

// GetPrereqs returns the engine prereqs.
func (e *BackupKeygen) Prereqs() Prereqs {
	return Prereqs{
		Session: true,
	}
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

// Run starts the engine.
func (e *BackupKeygen) Run(ctx *Context) error {
	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return err
	}

	eldest := me.GetEldestFOKID()
	if eldest == nil {
		return fmt.Errorf("no eldest key found.  cannot generate backup keys.")
	}
	eldestKID := eldest.Kid
	if eldestKID.IsNil() {
		return fmt.Errorf("no eldest kid found.  cannot generate backup keys.")
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

	key, err := scrypt.Key([]byte(e.passphrase), []byte(me.GetName()),
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
		Tsp:         ppStream,
		Me:          me,
		SigningKey:  signingKey,
		EldestKeyID: eldestKID,
		Device:      dev,
	}

	dkeng := NewDetKeyEngine(dkarg, e.G())
	err = RunEngine(dkeng, ctx)
	if err != nil {
		return err
	}

	return nil
}

func (e *BackupKeygen) Passphrase() string {
	return e.passphrase
}
