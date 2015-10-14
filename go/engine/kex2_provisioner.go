package engine

import (
	"time"

	"github.com/keybase/client/go/kex2"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

// Kex2Provisioner is an engine.
type Kex2Provisioner struct {
	libkb.Contextified
	deviceID keybase1.DeviceID
	secret   kex2.Secret
	secretCh chan kex2.Secret
	me       *libkb.User
	ctx      *Context
}

// NewKex2Provisioner creates a Kex2Provisioner engine.
func NewKex2Provisioner(g *libkb.GlobalContext, deviceID keybase1.DeviceID, secret kex2.Secret) *Kex2Provisioner {
	return &Kex2Provisioner{
		Contextified: libkb.NewContextified(g),
		deviceID:     deviceID,
		secret:       secret,
		secretCh:     make(chan kex2.Secret),
	}
}

// Name is the unique engine name.
func (e *Kex2Provisioner) Name() string {
	return "Kex2Provisioner"
}

// GetPrereqs returns the engine prereqs.
func (e *Kex2Provisioner) Prereqs() Prereqs {
	return Prereqs{Device: true}
}

// RequiredUIs returns the required UIs.
func (e *Kex2Provisioner) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.SecretUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *Kex2Provisioner) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *Kex2Provisioner) Run(ctx *Context) (err error) {
	e.G().Log.Debug("+ Kex2Provisioner.Run()")
	defer func() { e.G().Log.Debug("- Kex2Provisioner.Run() -> %s", libkb.ErrToOk(err)) }()

	e.me, err = libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	if err != nil {
		return err
	}

	// need to hold onto the context for use in the kex2 functions:
	e.ctx = ctx

	karg := kex2.KexBaseArg{
		Ctx:           context.TODO(),
		Mr:            libkb.NewKexRouter(e.G()),
		DeviceID:      e.deviceID,
		Secret:        e.secret,
		SecretChannel: e.secretCh,
		Timeout:       1 * time.Second,
	}
	parg := kex2.ProvisionerArg{
		KexBaseArg:  karg,
		Provisioner: e,
	}
	err = kex2.RunProvisioner(parg)

	return err
}

func (e *Kex2Provisioner) AddSecret(s kex2.Secret) {
	e.secretCh <- s
}

func (e *Kex2Provisioner) GetLogFactory() rpc.LogFactory {
	return rpc.NewSimpleLogFactory(e.G().Log, nil)
}

func (e *Kex2Provisioner) GetHelloArg() (arg keybase1.HelloArg, err error) {
	e.G().Log.Debug("+ GetHelloArg()")
	defer func() { e.G().Log.Debug("- GetHelloArg() -> %s", libkb.ErrToOk(err)) }()

	// get passphrase stream
	pps, err := e.G().LoginState().GetPassphraseStream(e.ctx.SecretUI)
	if err != nil {
		return arg, err
	}

	// get a session token that device Y can use
	var resp *libkb.APIRes
	resp, err = e.G().API.Post(libkb.APIArg{
		Endpoint:     "new_session",
		NeedSession:  true,
		Contextified: libkb.NewContextified(e.G()),
	})
	e.G().Log.Debug("new_session response: %+v", resp.Body)
	token, err := resp.Body.AtKey("session").GetString()
	if err != nil {
		return arg, err
	}

	arg = keybase1.HelloArg{
		Uid:     e.me.GetUID(),
		Pps:     pps.Export(),
		Token:   keybase1.SessionToken(token),
		SigBody: "hi",
	}
	return arg, nil
}

func (e *Kex2Provisioner) CounterSign(keybase1.HelloRes) ([]byte, error) {
	e.G().Log.Debug("+ CounterSign()")
	defer e.G().Log.Debug("- CounterSign()")
	return nil, nil
}
