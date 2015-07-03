package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

// ChangePassphrase engine is used for changing the user's passphrase, either
// by replacement or by force.
type ChangePassphrase struct {
	arg *keybase1.ChangePassphraseArg
	me  *libkb.User
	libkb.Contextified
}

// NewChangePassphrase creates a new engine for changing user passphrases,
// either if the current passphrase is known, or in "force" mode
func NewChangePassphrase(a *keybase1.ChangePassphraseArg, g *libkb.GlobalContext) *ChangePassphrase {
	return &ChangePassphrase{
		arg:          a,
		Contextified: libkb.NewContextified(g),
	}
}
