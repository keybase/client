package engine

import (
	"github.com/keybase/client/go/kex2"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

// Kex2Provisioner is an engine.
type Kex2Provisioner struct {
	libkb.Contextified
}

// NewKex2Provisioner creates a Kex2Provisioner engine.
func NewKex2Provisioner(g *libkb.GlobalContext) *Kex2Provisioner {
	return &Kex2Provisioner{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *Kex2Provisioner) Name() string {
	return "Kex2Provisioner"
}

// GetPrereqs returns the engine prereqs.
func (e *Kex2Provisioner) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *Kex2Provisioner) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *Kex2Provisioner) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *Kex2Provisioner) Run(ctx *Context) error {
	e.G().Log.Debug("+ Kex2Provisioner.Run()")
	karg := kex2.KexBaseArg{
		Mr: libkb.NewKexRouter(e.G()),
	}
	parg := kex2.ProvisionerArg{
		KexBaseArg:  karg,
		Provisioner: e,
	}
	err := kex2.RunProvisioner(parg)
	e.G().Log.Debug("- Kex2Provisioner.Run() -> %s", libkb.ErrToOk(err))

	return err
}

func (e *Kex2Provisioner) GetLogFactory() rpc.LogFactory {
	return rpc.NewSimpleLogFactory(e.G().Log, nil)
}

func (e *Kex2Provisioner) GetHelloArg() keybase1.HelloArg {
	return keybase1.HelloArg{}
}

func (e *Kex2Provisioner) CounterSign(keybase1.HelloRes) ([]byte, error) {
	return nil, nil
}
