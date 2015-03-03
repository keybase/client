package engine

import (
	"github.com/keybase/client/go/libkb"
)

// DevList is an engine that gets a list of all the user's
// devices.
type DevList struct{}

// NewDevList creates a DevList engine.
func NewDevList() *DevList {
	return &DevList{}
}

func (k *DevList) Name() string {
	return "DevList"
}

func (k *DevList) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{Session: true}
}

func (k *DevList) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{libkb.LogUIKind}
}

func (k *DevList) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (k *DevList) Run(ctx *Context, args, reply interface{}) error {
	ctx.LogUI.Info("hi")
	return nil
}
