package engine

import (
	"github.com/keybase/client/go/libkb"
)

// Doctor is an engine.
type Doctor struct {
	libkb.Contextified
}

// NewDoctor creates a Doctor engine.
func NewDoctor() *Doctor {
	return &Doctor{}
}

// Name is the unique engine name.
func (e *Doctor) Name() string {
	return "Doctor"
}

// GetPrereqs returns the engine prereqs.
func (e *Doctor) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{}
}

// RequiredUIs returns the required UIs.
func (e *Doctor) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *Doctor) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *Doctor) Run(ctx *Context) error {
	ctx.DoctorUI.DisplayStatus()
	return nil
}
