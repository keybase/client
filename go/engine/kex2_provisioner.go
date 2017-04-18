// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/kex2"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	jsonw "github.com/keybase/go-jsonw"
	"golang.org/x/net/context"
)

// Kex2Provisioner is an engine.
type Kex2Provisioner struct {
	libkb.Contextified
	secret                kex2.Secret
	secretCh              chan kex2.Secret
	me                    *libkb.User
	signingKey            libkb.GenericKey
	encryptionKey         libkb.NaclDHKeyPair
	pps                   keybase1.PassphraseStream
	provisioneeDeviceName string
	provisioneeDeviceType string
	ctx                   *Context
}

// Kex2Provisioner implements kex2.Provisioner interface.
var _ kex2.Provisioner = (*Kex2Provisioner)(nil)

// NewKex2Provisioner creates a Kex2Provisioner engine.
func NewKex2Provisioner(g *libkb.GlobalContext, secret kex2.Secret, pps *libkb.PassphraseStream) *Kex2Provisioner {
	e := &Kex2Provisioner{
		Contextified: libkb.NewContextified(g),
		secret:       secret,
		secretCh:     make(chan kex2.Secret),
	}
	if pps != nil {
		e.pps = pps.Export()
	}

	return e
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
		libkb.ProvisionUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *Kex2Provisioner) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the provisioner engine.
func (e *Kex2Provisioner) Run(ctx *Context) error {
	// before starting provisioning, need to load some information:

	// load self:
	var err error
	e.me, err = libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	if err != nil {
		return err
	}

	err = e.loadSecretKeys(ctx)
	if err != nil {
		return err
	}

	// get current passphrase stream if necessary:
	if e.pps.PassphraseStream == nil {
		e.G().Log.Debug("kex2 provisioner needs passphrase stream, getting it from LoginState")
		pps, err := e.G().LoginState().GetPassphraseStreamStored(ctx.SecretUI)
		if err != nil {
			return err
		}
		e.pps = pps.Export()
	}

	// ctx needed by some kex2 functions
	e.ctx = ctx

	deviceID := e.G().Env.GetDeviceID()

	nctx := ctx.NetContext
	if nctx == nil {
		e.G().Log.Debug("no NetContext in engine.Context, using context.Background()")
		nctx = context.Background()
	}

	// all set:  start provisioner
	karg := kex2.KexBaseArg{
		Ctx:           nctx,
		ProvisionCtx:  e.G(),
		Mr:            libkb.NewKexRouter(e.G()),
		DeviceID:      deviceID,
		Secret:        e.secret,
		SecretChannel: e.secretCh,
		Timeout:       5 * time.Minute,
	}
	parg := kex2.ProvisionerArg{
		KexBaseArg:   karg,
		Provisioner:  e,
		HelloTimeout: 15 * time.Second,
	}
	if err := kex2.RunProvisioner(parg); err != nil {
		return err
	}

	// successfully provisioned the other device
	sarg := keybase1.ProvisionerSuccessArg{
		DeviceName: e.provisioneeDeviceName,
		DeviceType: e.provisioneeDeviceType,
	}
	if err := ctx.ProvisionUI.ProvisionerSuccess(context.TODO(), sarg); err != nil {
		return err
	}

	return nil
}

func (e *Kex2Provisioner) loadSecretKeys(ctx *Context) (err error) {
	// get signing key (including secret key)
	ska1 := libkb.SecretKeyArg{
		Me:      e.me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	e.signingKey, err = e.G().Keyrings.GetSecretKeyWithPrompt(ctx.SecretKeyPromptArg(ska1, "new device install"))
	if err != nil {
		return err
	}

	// get encryption key (including secret key)
	ska2 := libkb.SecretKeyArg{
		Me:      e.me,
		KeyType: libkb.DeviceEncryptionKeyType,
	}
	encryptionKeyGeneric, err := e.G().Keyrings.GetSecretKeyWithPrompt(ctx.SecretKeyPromptArg(ska2, "new device install"))
	if err != nil {
		return err
	}
	var ok bool
	e.encryptionKey, ok = encryptionKeyGeneric.(libkb.NaclDHKeyPair)
	if !ok {
		return fmt.Errorf("Unexpected encryption key type")
	}
	return nil
}

// AddSecret inserts a received secret into the provisioner's
// secret channel.
func (e *Kex2Provisioner) AddSecret(s kex2.Secret) {
	e.secretCh <- s
}

// GetLogFactory implements GetLogFactory in kex2.Provisioner.
func (e *Kex2Provisioner) GetLogFactory() rpc.LogFactory {
	return rpc.NewSimpleLogFactory(e.G().Log, nil)
}

// GetHelloArg implements GetHelloArg in kex2.Provisioner.
func (e *Kex2Provisioner) GetHelloArg() (arg keybase1.HelloArg, err error) {
	e.G().Log.Debug("+ GetHelloArg()")
	defer func() { e.G().Log.Debug("- GetHelloArg() -> %s", libkb.ErrToOk(err)) }()

	e.ctx.ProvisionUI.DisplaySecretExchanged(context.TODO(), 0)

	// get a session token that device Y can use
	token, csrf, err := e.sessionForY()
	if err != nil {
		return arg, err
	}

	// generate a skeleton key proof
	sigBody, err := e.skeletonProof()
	if err != nil {
		return arg, err
	}

	// return the HelloArg
	arg = keybase1.HelloArg{
		Uid:     e.me.GetUID(),
		Pps:     e.pps,
		Token:   keybase1.SessionToken(token),
		Csrf:    keybase1.CsrfToken(csrf),
		SigBody: sigBody,
	}
	return arg, nil
}

// GetHello2Arg implements GetHello2Arg in kex2.Provisioner.
func (e *Kex2Provisioner) GetHello2Arg() (arg2 keybase1.Hello2Arg, err error) {
	e.G().Log.Debug("+ GetHello2Arg()")
	defer func() { e.G().Log.Debug("- GetHello2Arg() -> %s", libkb.ErrToOk(err)) }()
	var arg1 keybase1.HelloArg
	arg1, err = e.GetHelloArg()
	arg2 = keybase1.Hello2Arg{
		Uid:     arg1.Uid,
		Token:   arg1.Token,
		Csrf:    arg1.Csrf,
		SigBody: arg1.SigBody,
	}
	return arg2, nil
}

// CounterSign implements CounterSign in kex2.Provisioner.
func (e *Kex2Provisioner) CounterSign(input keybase1.HelloRes) (sig []byte, err error) {
	e.G().Log.Debug("+ CounterSign()")
	defer func() { e.G().Log.Debug("- CounterSign() -> %s", libkb.ErrToOk(err)) }()

	jw, err := jsonw.Unmarshal([]byte(input))
	if err != nil {
		return nil, err
	}

	// check the reverse signature
	if err = e.checkReverseSig(jw); err != nil {
		e.G().Log.Debug("provisioner failed to verify reverse sig: %s", err)
		return nil, err
	}
	e.G().Log.Debug("provisioner verified reverse sig")

	// remember some device information for ProvisionUI.ProvisionerSuccess()
	if err = e.rememberDeviceInfo(jw); err != nil {
		return nil, err
	}

	// sign the whole thing with provisioner's signing key
	s, _, _, err := libkb.SignJSON(jw, e.signingKey)
	if err != nil {
		return nil, err
	}

	return []byte(s), nil
}

// CounterSign2 implements CounterSign in kex2.Provisioner.
func (e *Kex2Provisioner) CounterSign2(input keybase1.Hello2Res) (output keybase1.DidCounterSign2Arg, err error) {
	defer e.G().Trace("CounterSign2()", func() error { return err })()
	var key libkb.GenericKey
	key, err = libkb.ImportKeypairFromKID(input.EncryptionKey)
	if err != nil {
		return output, err
	}

	output.Sig, err = e.CounterSign(input.SigPayload)
	if err != nil {
		return output, err
	}

	var ppsPacked []byte
	ppsPacked, err = libkb.MsgpackEncode(e.pps)
	if err != nil {
		return output, err
	}
	output.PpsEncrypted, err = key.EncryptToString(ppsPacked, nil)

	if e.G().Env.GetEnableSharedDH() {
		sdhBoxes, err := e.makeSdhBoxes(key)
		if err != nil {
			return output, err
		}
		output.SdhBoxes = sdhBoxes
		// TODO if SDH_UPGRADE: may want to add a key here.
	}

	return output, err
}

// sessionForY gets session tokens that Y can use to interact with
// API server.
func (e *Kex2Provisioner) sessionForY() (token, csrf string, err error) {
	resp, err := e.G().API.Post(libkb.APIArg{
		Endpoint:    "new_session",
		SessionType: libkb.APISessionTypeREQUIRED,
	})
	if err != nil {
		return "", "", err
	}
	token, err = resp.Body.AtKey("session").GetString()
	if err != nil {
		return "", "", err
	}
	csrf, err = resp.Body.AtKey("csrf_token").GetString()
	if err != nil {
		return "", "", err
	}

	return token, csrf, nil
}

// skeletonProof generates a partial key proof structure that
// device Y can fill in.
func (e *Kex2Provisioner) skeletonProof() (string, error) {
	delg := libkb.Delegator{
		ExistingKey:    e.signingKey,
		Me:             e.me,
		DelegationType: libkb.DelegationTypeSibkey,
		Expire:         libkb.NaclEdDSAExpireIn,
		Contextified:   libkb.NewContextified(e.G()),
	}

	jw, err := libkb.KeyProof(delg)
	if err != nil {
		return "", err
	}
	body, err := jw.Marshal()
	if err != nil {
		return "", err
	}
	return string(body), nil
}

// checkReverseSig verifies that the reverse sig in jw is valid
// and matches jw.
func (e *Kex2Provisioner) checkReverseSig(jw *jsonw.Wrapper) error {
	kid, err := jw.AtPath("body.sibkey.kid").GetString()
	if err != nil {
		return err
	}

	keypair, err := libkb.ImportKeypairFromKID(keybase1.KIDFromString(kid))
	if err != nil {
		return err
	}

	revsig, err := jw.AtPath("body.sibkey.reverse_sig").GetString()
	if err != nil {
		return err
	}

	// set reverse_sig to nil to verify it:
	jw.SetValueAtPath("body.sibkey.reverse_sig", jsonw.NewNil())
	msg, err := jw.Marshal()
	if err != nil {
		return err
	}
	_, err = keypair.VerifyString(e.G().Log, revsig, msg)
	if err != nil {
		return err
	}

	// put reverse_sig back in
	jw.SetValueAtPath("body.sibkey.reverse_sig", jsonw.NewString(revsig))

	return nil
}

// rememberDeviceInfo saves the device name and type in
// Kex2Provisioner for later use.
func (e *Kex2Provisioner) rememberDeviceInfo(jw *jsonw.Wrapper) error {
	name, err := jw.AtPath("body.device.name").GetString()
	if err != nil {
		return err
	}
	e.provisioneeDeviceName = name

	dtype, err := jw.AtPath("body.device.type").GetString()
	if err != nil {
		return err
	}
	e.provisioneeDeviceType = dtype

	return nil
}

func (e *Kex2Provisioner) makeSdhBoxes(receiverKeyGeneric libkb.GenericKey) (res []keybase1.SharedDhSecretKeyBox, err error) {
	receiverKey, ok := receiverKeyGeneric.(libkb.NaclDHKeyPair)
	if !ok {
		return res, fmt.Errorf("Unexpected receiver key type")
	}

	sdhk, err := e.G().GetSharedDHKeyring()
	if err != nil {
		return res, err
	}
	err = sdhk.Sync(e.ctx.NetContext)
	if err != nil {
		return res, err
	}

	sdhBoxes, err := sdhk.PrepareBoxesForNewDevice(e.ctx.NetContext,
		receiverKey,     // receiver key: provisionee enc
		e.encryptionKey) // sender key: this device enc
	if err != nil {
		return res, err
	}
	return e.convertBoxes(sdhBoxes), nil
}

func (e *Kex2Provisioner) convertBoxes(bs []libkb.SharedDHSecretKeyBox) (res []keybase1.SharedDhSecretKeyBox) {
	for _, b := range bs {
		res = append(res, b.ToKex())
	}
	return
}
