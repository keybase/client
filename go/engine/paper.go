// Paper creates the initial paper backup key for a user.  It
// differs from the Backup engine in that it already knows the
// signing key and it doesn't offer to revoke any devices, plus it
// uses a different UI.
package engine

import (
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

// Paper is an engine.
type Paper struct {
	passphrase string
	args       *PaperArgs
	libkb.Contextified
}

type PaperArgs struct {
	SigningKey libkb.GenericKey
	Me         *libkb.User
}

// NewPaper creates a Paper engine.
func NewPaper(g *libkb.GlobalContext, args *PaperArgs) *Paper {
	return &Paper{
		args:         args,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *Paper) Name() string {
	return "Paper"
}

// GetPrereqs returns the engine prereqs.
func (e *Paper) Prereqs() Prereqs {
	return Prereqs{
		Session: true,
	}
}

// RequiredUIs returns the required UIs.
func (e *Paper) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LoginUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *Paper) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *Paper) Run(ctx *Context) error {
	words, err := libkb.SecWordList(libkb.BackupKeyPhraseEntropy)
	if err != nil {
		return err
	}
	e.passphrase = strings.Join(words, " ")

	kgarg := &BackupKeygenArg{
		Passphrase: e.passphrase,
		Me:         e.args.Me,
		SigningKey: e.args.SigningKey,
	}
	kgeng := NewBackupKeygen(kgarg, e.G())
	if err := RunEngine(kgeng, ctx); err != nil {
		return err
	}

	return ctx.LoginUI.DisplayBackupPhrase(keybase1.DisplayBackupPhraseArg{Phrase: e.passphrase})
}
