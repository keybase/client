package engine

import (
	"github.com/keybase/client/go/kex2"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

// Kex2Provisionee is an engine.
type Kex2Provisionee struct {
	libkb.Contextified
}

// NewKex2Provisionee creates a Kex2Provisionee engine.
func NewKex2Provisionee(g *libkb.GlobalContext) *Kex2Provisionee {
	return &Kex2Provisionee{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *Kex2Provisionee) Name() string {
	return "Kex2Provisionee"
}

// GetPrereqs returns the engine prereqs.
func (e *Kex2Provisionee) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *Kex2Provisionee) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *Kex2Provisionee) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *Kex2Provisionee) Run(ctx *Context) error {
	e.G().Log.Debug("+ Kex2Provisionee.Run()")
	karg := kex2.KexBaseArg{
		Mr: libkb.NewKexRouter(e.G()),
	}
	parg := kex2.ProvisioneeArg{
		KexBaseArg:  karg,
		Provisionee: e,
	}
	err := kex2.RunProvisionee(parg)
	e.G().Log.Debug("- Kex2Provisionee.Run() -> %s", libkb.ErrToOk(err))

	return err
}

func (e *Kex2Provisionee) GetLogFactory() rpc.LogFactory {
	return rpc.NewSimpleLogFactory(e.G().Log, nil)
}

func (e *Kex2Provisionee) HandleHello(harg keybase1.HelloArg) (keybase1.HelloRes, error) {
	return "", nil
}

func (e *Kex2Provisionee) HandleDidCounterSign([]byte) error {
	return nil
}
