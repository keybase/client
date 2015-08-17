// PaperKeyPrimary creates the initial paper backup key for a user.  It
// differs from the Backup engine in that it already knows the
// signing key and it doesn't offer to revoke any devices, plus it
// uses a different UI call to display the phrase.
package engine

import (
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

// PaperKeyPrimary is an engine.
type PaperKeyPrimary struct {
	passphrase string
	args       *PaperKeyPrimaryArgs
	libkb.Contextified
}

type PaperKeyPrimaryArgs struct {
	SigningKey libkb.GenericKey
	Me         *libkb.User
}

// NewPaperKeyPrimary creates a PaperKeyPrimary engine.
func NewPaperKeyPrimary(g *libkb.GlobalContext, args *PaperKeyPrimaryArgs) *PaperKeyPrimary {
	return &PaperKeyPrimary{
		args:         args,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *PaperKeyPrimary) Name() string {
	return "PaperKeyPrimary"
}

// GetPrereqs returns the engine prereqs.
func (e *PaperKeyPrimary) Prereqs() Prereqs {
	return Prereqs{
		Session: true,
	}
}

// RequiredUIs returns the required UIs.
func (e *PaperKeyPrimary) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LoginUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PaperKeyPrimary) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *PaperKeyPrimary) Run(ctx *Context) error {
	words, err := libkb.SecWordList(libkb.PaperKeyPhraseEntropy)
	if err != nil {
		return err
	}
	e.passphrase = strings.Join(words, " ")

	kgarg := &PaperKeyGenArg{
		Passphrase: e.passphrase,
		Me:         e.args.Me,
		SigningKey: e.args.SigningKey,
	}
	kgeng := NewPaperKeyGen(kgarg, e.G())
	if err := RunEngine(kgeng, ctx); err != nil {
		return err
	}

	return ctx.LoginUI.DisplayPrimaryPaperKey(keybase1.DisplayPrimaryPaperKeyArg{Phrase: e.passphrase})
}
