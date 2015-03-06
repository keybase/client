//
package engine

import (
	"github.com/keybase/client/go/libkb"
)

// SigsList is an engine for the sigs-list command.
type SigsList struct{}

// NewTemplate creates a Template engine.
func NewSigsList() *SigsList {
	return &SigsList{}
}

// Name is the unique engine name.
func (e *SigsList) Name() string {
	return "SigsList"
}

// GetPrereqs returns the engine prereqs.
func (e *SigsList) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{}
}

// RequiredUIs returns the required UIs.
func (e *SigsList) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *SigsList) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *SigsList) Run(ctx *Context, args, reply interface{}) error {
	return nil
}
