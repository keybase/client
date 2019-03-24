// This engine enters a user into the reset pipeline.
package engine

import (
	"github.com/keybase/client/go/libkb"
)

// AccountReset is an engine.
type AccountReset struct {
	libkb.Contextified
	username string
	email    string
}

// NewAccountReset creates a AccountReset engine.
func NewAccountReset(g *libkb.GlobalContext, username, email string) *AccountReset {
	return &AccountReset{
		Contextified: libkb.NewContextified(g),
		username:     username,
		email:        email,
	}
}

// Name is the unique engine name.
func (e *AccountReset) Name() string {
	return "AccountReset"
}

// Prereqs returns the engine prereqs.
func (e *AccountReset) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *AccountReset) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *AccountReset) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *AccountReset) Run(mctx libkb.MetaContext) error {
	return libkb.EnterResetPipeline(mctx, e.username, e.email)
}
