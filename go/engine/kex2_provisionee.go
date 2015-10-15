package engine

import (
	"errors"
	"time"

	"github.com/keybase/client/go/kex2"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	jsonw "github.com/keybase/go-jsonw"
	"golang.org/x/net/context"
)

// Kex2Provisionee is an engine.
type Kex2Provisionee struct {
	libkb.Contextified
	device    *libkb.Device
	secret    kex2.Secret
	secretCh  chan kex2.Secret
	eddsa     libkb.NaclKeyPair
	lastSeqno int
}

// NewKex2Provisionee creates a Kex2Provisionee engine.
func NewKex2Provisionee(g *libkb.GlobalContext, device *libkb.Device, secret kex2.Secret) *Kex2Provisionee {
	return &Kex2Provisionee{
		Contextified: libkb.NewContextified(g),
		device:       device,
		secret:       secret,
		secretCh:     make(chan kex2.Secret),
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

	// check device struct:
	if len(e.device.Type) == 0 {
		return errors.New("provisionee device requires Type to be set")
	}
	if e.device.ID.IsNil() {
		return errors.New("provisionee device requires ID to be set")
	}

	karg := kex2.KexBaseArg{
		Ctx:           context.TODO(),
		Mr:            libkb.NewKexRouter(e.G()),
		DeviceID:      e.device.ID,
		Secret:        e.secret,
		SecretChannel: e.secretCh,
		Timeout:       1 * time.Second,
	}
	parg := kex2.ProvisioneeArg{
		KexBaseArg:  karg,
		Provisionee: e,
	}
	err := kex2.RunProvisionee(parg)
	e.G().Log.Debug("- Kex2Provisionee.Run() -> %s", libkb.ErrToOk(err))

	return err
}

func (e *Kex2Provisionee) AddSecret(s kex2.Secret) {
	e.secretCh <- s
}

func (e *Kex2Provisionee) GetLogFactory() rpc.LogFactory {
	return rpc.NewSimpleLogFactory(e.G().Log, nil)
}

func (e *Kex2Provisionee) HandleHello(harg keybase1.HelloArg) (res keybase1.HelloRes, err error) {
	e.G().Log.Debug("+ HandleHello()")
	defer func() { e.G().Log.Debug("- HandleHello() -> %s", libkb.ErrToOk(err)) }()

	var jw *jsonw.Wrapper
	jw, err = jsonw.Unmarshal([]byte(harg.SigBody))
	if err != nil {
		return res, err
	}
	e.G().Log.Debug("sibkey skeleton: %s", jw.MarshalPretty())

	e.eddsa, err = libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		return res, err
	}

	// set device id, device name, new device signing pub key in the jw blob

	// TODO:
	// if e.device.Description == nil { get a device name from the user }

	body := jw.AtKey("body")

	s := libkb.DeviceStatusActive
	e.device.Status = &s
	e.device.Kid = e.eddsa.GetKID()
	var dw *jsonw.Wrapper
	dw, err = e.device.Export(libkb.SibkeyType)
	if err != nil {
		return res, err
	}
	body.SetKey("device", dw)

	if err = jw.SetValueAtPath("body.sibkey.kid", jsonw.NewString(e.eddsa.GetKID().String())); err != nil {
		return res, err
	}

	// sign the blob
	var sig string
	sig, _, _, err = libkb.SignJSON(jw, e.eddsa)

	// put the signature in reverse_sig
	if err = jw.SetValueAtPath("body.sibkey.reverse_sig", jsonw.NewString(sig)); err != nil {
		return res, err
	}

	var out []byte
	out, err = jw.Marshal()
	if err != nil {
		return res, err
	}

	e.G().Log.Debug("reverse sig blob: %s\n", jw.MarshalPretty())

	// need the last seqno here for HandleDidCounterSign
	e.lastSeqno, err = jw.AtPath("seqno").GetInt()
	if err != nil {
		return res, err
	}

	res = keybase1.HelloRes(out)
	return res, err
}

func (e *Kex2Provisionee) HandleDidCounterSign(sig []byte) (err error) {
	e.G().Log.Debug("+ HandleDidCounterSign()")
	defer func() { e.G().Log.Debug("- HandleDidCounterSign() -> %s", libkb.ErrToOk(err)) }()

	e.G().Log.Debug("HandleDidCounterSign sig: %s", string(sig))

	// need another sig for the dh key
	var dh libkb.NaclKeyPair
	dh, err = libkb.GenerateNaclDHKeyPair()
	if err != nil {
		return err
	}

	delg := libkb.Delegator{
		ExistingKey:    e.eddsa,
		NewKey:         dh,
		DelegationType: libkb.SubkeyType,
		Expire:         libkb.NaclDHExpireIn,
		LastSeqno:      libkb.Seqno(e.lastSeqno),
	}

	var jw *jsonw.Wrapper
	if jw, err = libkb.KeyProof(delg); err != nil {
		return err
	}

	e.G().Log.Debug("dh sig: %s", jw.MarshalPretty())

	// XXX post both via key/multi

	return nil
}
