package engine

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
)

// KexRev is an engine for running the Device Key Exchange
// Protocol, reverse version.
//
// This isn't implemented yet, just a placeholder engine.
type KexRev struct {
	KexCom
}

func NewKexRev(server kex.Handler) *KexRev {
	kr := &KexRev{KexCom: KexCom{server: server}}
	return kr
}

func (k *KexRev) Name() string {
	return "KexRev"
}

func (k *KexRev) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{Session: true}
}

func (k *KexRev) RequiredUIs() []libkb.UIKind {
	return nil
}

func (k *KexRev) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (k *KexRev) Run(ectx *Context, args, reply interface{}) error {
	return nil
}
