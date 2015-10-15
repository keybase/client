package engine

import (
	"time"

	"github.com/keybase/client/go/kex2"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	jsonw "github.com/keybase/go-jsonw"
	"golang.org/x/net/context"
)

// Kex2Provisioner is an engine.
type Kex2Provisioner struct {
	libkb.Contextified
	deviceID   keybase1.DeviceID
	secret     kex2.Secret
	secretCh   chan kex2.Secret
	me         *libkb.User
	signingKey libkb.GenericKey
	pps        *libkb.PassphraseStream
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

	arg := libkb.SecretKeyArg{
		Me:      e.me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	e.signingKey, err = e.G().Keyrings.GetSecretKeyWithPrompt(ctx.LoginContext, arg, ctx.SecretUI, "new device install")
	if err != nil {
		return err
	}

	// get passphrase stream
	e.pps, err = e.G().LoginState().GetPassphraseStream(ctx.SecretUI)
	if err != nil {
		return err
	}

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

	delg := libkb.Delegator{
		ExistingKey:    e.signingKey,
		Me:             e.me,
		DelegationType: libkb.SibkeyType,
		Expire:         libkb.NaclEdDSAExpireIn,
	}

	var jw *jsonw.Wrapper
	if jw, err = libkb.KeyProof(delg); err != nil {
		return arg, err
	}
	var body []byte
	body, err = jw.Marshal()
	if err != nil {
		return arg, err
	}
	e.G().Log.Debug("sibkey skeleton: %s", string(body))

	arg = keybase1.HelloArg{
		Uid:     e.me.GetUID(),
		Pps:     e.pps.Export(),
		Token:   keybase1.SessionToken(token),
		SigBody: string(body),
	}
	return arg, nil
}

func (e *Kex2Provisioner) CounterSign(input keybase1.HelloRes) ([]byte, error) {
	e.G().Log.Debug("+ CounterSign()")
	defer e.G().Log.Debug("- CounterSign()")

	jw, err := jsonw.Unmarshal([]byte(input))
	if err != nil {
		return nil, err
	}

	e.G().Log.Debug("input to CounterSign: %s", jw.MarshalPretty())
	kid, err := jw.AtPath("body.sibkey.kid").GetString()
	if err != nil {
		return nil, err
	}

	keypair, err := libkb.ImportKeypairFromKID(keybase1.KIDFromString(kid))
	if err != nil {
		return nil, err
	}

	revsig, err := jw.AtPath("body.sibkey.reverse_sig").GetString()
	if err != nil {
		return nil, err
	}

	sigPayload, _, err := keypair.VerifyStringAndExtract(revsig)
	if err != nil {
		return nil, err
	}

	e.G().Log.Debug("sig payload: %s", sigPayload)

	// XXX verify payload + jw

	var sig string
	sig, _, _, err = libkb.SignJSON(jw, e.signingKey)
	if err != nil {
		return nil, err
	}

	return []byte(sig), nil
}
