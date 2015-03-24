package engine

import (
	"github.com/keybase/client/go/libkb"
)

// PGPVerify is an engine.
type PGPVerify struct{}

// NewPGPVerify creates a PGPVerify engine.
func NewPGPVerify() *PGPVerify {
	return &PGPVerify{}
}

// Name is the unique engine name.
func (e *PGPVerify) Name() string {
	return "PGPVerify"
}

// GetPrereqs returns the engine prereqs.
func (e *PGPVerify) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{}
}

// RequiredUIs returns the required UIs.
func (e *PGPVerify) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPVerify) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *PGPVerify) Run(ctx *Context) error {
	return nil
}
