package engine

import (
	"github.com/keybase/client/go/libkb"
)

// PGPTrackEncrypt encrypts data read from a source into a sink
// for a set of users.  It will track them if necessary.
type PGPTrackEncrypt struct{}

// NewPGPTrackEncrypt creates a PGPTrackEncrypt engine.
func NewPGPTrackEncrypt() *PGPTrackEncrypt {
	return &PGPTrackEncrypt{}
}

// Name is the unique engine name.
func (e *PGPTrackEncrypt) Name() string {
	return "PGPTrackEncrypt"
}

// GetPrereqs returns the engine prereqs.
func (e *PGPTrackEncrypt) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{Session: true}
}

// RequiredUIs returns the required UIs.
func (e *PGPTrackEncrypt) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPTrackEncrypt) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		NewPGPEncrypt(nil),
		NewPGPKeyfinder(nil),
	}
}

// Run starts the engine.
func (e *PGPTrackEncrypt) Run(ctx *Context, args, reply interface{}) error {
	return nil
}
