// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/kex2"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/msgpack"
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
	mctx                  libkb.MetaContext
	proof                 *jsonw.Wrapper
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
func (e *Kex2Provisioner) Run(m libkb.MetaContext) error {
	// The guard is acquired later, after the potentially long pause by the user.
	defer m.G().LocalSigchainGuard().Clear(m.Ctx(), "Kex2Provisioner")

	// before starting provisioning, need to load some information:
	if err := e.loadMe(); err != nil {
		return err
	}
	if err := m.ActiveDevice().ClearPassphraseStreamCacheIfOutdated(m); err != nil {
		return err
	}
	if err := e.loadSecretKeys(m); err != nil {
		return err
	}

	// get current passphrase stream if necessary:
	if e.pps.PassphraseStream == nil {
		m.Debug("kex2 provisioner needs passphrase stream, getting it via GetPassphraseStreamStored")
		pps, err := libkb.GetPassphraseStreamStored(m)
		if err != nil {
			return err
		}
		e.pps = pps.Export()
	}

	// Go's context.Context needed by some kex2 callback functions
	m = m.EnsureCtx()
	e.mctx = m

	deviceID := m.G().Env.GetDeviceID()

	// all set:  start provisioner
	karg := kex2.KexBaseArg{
		Ctx:           m.Ctx(),
		LogCtx:        newKex2LogContext(m.G()),
		Mr:            libkb.NewKexRouter(m),
		DeviceID:      deviceID,
		Secret:        e.secret,
		SecretChannel: e.secretCh,
		Timeout:       60 * time.Minute,
	}
	parg := kex2.ProvisionerArg{
		KexBaseArg:   karg,
		Provisioner:  e,
		HelloTimeout: 15 * time.Second,
	}
	if err := kex2.RunProvisioner(parg); err != nil {
		return err
	}
	m.G().LocalSigchainGuard().Clear(m.Ctx(), "Kex2Provisioner")

	// successfully provisioned the other device
	sarg := keybase1.ProvisionerSuccessArg{
		DeviceName: e.provisioneeDeviceName,
		DeviceType: e.provisioneeDeviceType,
	}
	return m.UIs().ProvisionUI.ProvisionerSuccess(context.Background(), sarg)
}

func (e *Kex2Provisioner) loadSecretKeys(m libkb.MetaContext) (err error) {
	// get signing key (including secret key)
	ska1 := libkb.SecretKeyArg{
		Me:      e.me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	e.signingKey, err = m.G().Keyrings.GetSecretKeyWithPrompt(m, m.SecretKeyPromptArg(ska1, "new device install"))
	if err != nil {
		return err
	}

	// get encryption key (including secret key)
	ska2 := libkb.SecretKeyArg{
		Me:      e.me,
		KeyType: libkb.DeviceEncryptionKeyType,
	}
	encryptionKeyGeneric, err := e.G().Keyrings.GetSecretKeyWithPrompt(m, m.SecretKeyPromptArg(ska2, "new device install"))
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

	// Pull the metaContext out of the this object, since we can't pass it through the
	// kex2/provisioner interface
	m := e.mctx

	defer m.Trace("Kex2Provisioner#GetHelloArg()", func() error { return err })()

	m.UIs().ProvisionUI.DisplaySecretExchanged(context.Background(), 0)

	// get a session token that device Y can use
	mctx := libkb.NewMetaContextBackground(e.G())
	tokener, err := libkb.NewSessionTokener(mctx)
	if err != nil {
		return arg, err
	}
	token, csrf := tokener.Tokens()

	// generate a skeleton key proof
	sigBody, err := e.skeletonProof(m)
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
	// Pull the metaContext out of the this object, since we can't pass it through the
	// kex2/provisioner interface
	m := e.mctx

	defer m.Trace("Kex2Provisioner#GetHello2Arg", func() error { return err })()

	var arg1 keybase1.HelloArg
	arg1, err = e.GetHelloArg()
	if err != nil {
		return arg2, err
	}

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
	m := e.mctx
	defer m.Trace("Kex2Provisioner#CounterSign", func() error { return err })()

	jw, err := jsonw.Unmarshal([]byte(input))
	if err != nil {
		return nil, err
	}

	// check the reverse signature and put the values from the provisionee into
	// e.proof
	if err = e.checkReverseSig(jw); err != nil {
		m.Debug("provisioner failed to verify reverse sig: %s", err)
		return nil, err
	}
	m.Debug("provisioner verified reverse sig")

	// remember some device information for ProvisionUI.ProvisionerSuccess()
	if err = e.rememberDeviceInfo(e.proof); err != nil {
		return nil, err
	}

	// sign the whole thing with provisioner's signing key
	s, _, _, err := libkb.SignJSON(e.proof, e.signingKey)
	if err != nil {
		return nil, err
	}

	return []byte(s), nil
}

// CounterSign2 implements CounterSign in kex2.Provisioner.
func (e *Kex2Provisioner) CounterSign2(input keybase1.Hello2Res) (output keybase1.DidCounterSign2Arg, err error) {

	m := e.mctx

	defer m.Trace("Kex2Provisioner#CounterSign2", func() error { return err })()
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
	ppsPacked, err = msgpack.Encode(e.pps)
	if err != nil {
		return output, err
	}
	output.PpsEncrypted, err = key.EncryptToString(ppsPacked, nil)

	// Sync the PUK, if the pukring is nil, we don't have a PUK and have
	// nothing to box. We also can't make a userEKBox which is signed by the
	// PUK.
	pukring, err := e.syncPUK(m)
	if err != nil || pukring == nil {
		return output, err
	}

	output.PukBox, err = e.makePukBox(m, pukring, key)
	if err != nil {
		return output, err
	}

	userEKBoxStorage := m.G().GetUserEKBoxStorage()
	if input.DeviceEkKID.Exists() && userEKBoxStorage != nil {
		// If we error out here the provisionee will create it's own keys later
		// but we shouldn't fail kex.
		userEKBox, ekErr := makeUserEKBoxForProvisionee(m, input.DeviceEkKID)
		if ekErr != nil {
			userEKBox = nil
			m.Debug("Unable to makeUserEKBox %v", ekErr)
		}
		output.UserEkBox = userEKBox
	} else {
		m.Debug("Skipping userEKBox generation empty KID or storage. KID: %v, storage: %v", input.DeviceEkKID, userEKBoxStorage)
	}

	return output, nil
}

// skeletonProof generates a partial key proof structure that device Y can
// fill in. When verifying the reverse signature we fill in the values from Y
// to check the reverse signature
func (e *Kex2Provisioner) skeletonProof(m libkb.MetaContext) (sigBody string, err error) {

	// Set the local sigchain guard to tell background tasks
	// to stay off the sigchain while we do this.
	// This is released at the end of Kex2Provisioner#Run
	e.G().LocalSigchainGuard().Set(context.TODO(), "Kex2Provisioner")

	// reload the self user to make sure it is fresh
	// (this fixes TestProvisionWithRevoke [CORE-5631, CORE-5636])
	if err := e.loadMe(); err != nil {
		return "", err
	}

	delg := libkb.Delegator{
		ExistingKey:    e.signingKey,
		Me:             e.me,
		DelegationType: libkb.DelegationTypeSibkey,
		Expire:         libkb.NaclEdDSAExpireIn,
		Contextified:   libkb.NewContextified(e.G()),
	}

	e.proof, err = libkb.KeyProof(m, delg)
	if err != nil {
		return "", err
	}
	body, err := e.proof.Marshal()
	if err != nil {
		return "", err
	}
	return string(body), nil
}

// checkReverseSig verifies that the reverse sig in jw is valid and matches
// e.proof. The provisionee is only allowed to pass the following fields to the
// provisioner:
// body.device
// body.sibkey.kid
// The values at these paths in the json reserialized and are inserted into the
// skeleton proof that we initially passed to the provisionee so we can ensure
// no other values were added when verifying the signature.
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
	e.proof.SetValueAtPath("body.sibkey.reverse_sig", jsonw.NewNil())

	// Copy known fields that provisionee set into e.proof
	deviceWrapper := jw.AtPath("body.device")
	// NOTE the time value is dropped during Export, value here is arbitrary.
	device, err := libkb.ParseDevice(deviceWrapper, time.Now())
	if err != nil {
		return err
	}
	dw, err := device.Export(libkb.LinkType(libkb.DelegationTypeSibkey))
	if err != nil {
		return err
	}
	e.proof.SetValueAtPath("body.device", dw)
	e.proof.SetValueAtPath("body.sibkey.kid", jsonw.NewString(kid))

	msg, err := e.proof.Marshal()
	if err != nil {
		return err
	}
	_, err = keypair.VerifyString(e.G().Log, revsig, msg)
	if err != nil {
		return err
	}

	// put reverse_sig back in
	e.proof.SetValueAtPath("body.sibkey.reverse_sig", jsonw.NewString(revsig))

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

// Returns nil if there are no per-user-keys.
func (e *Kex2Provisioner) syncPUK(m libkb.MetaContext) (*libkb.PerUserKeyring, error) {
	pukring, err := e.G().GetPerUserKeyring(m.Ctx())
	if err != nil {
		return nil, err
	}
	if err = pukring.Sync(m); err != nil {
		return nil, err
	}
	if !pukring.HasAnyKeys() {
		return nil, nil
	}
	return pukring, nil
}

func (e *Kex2Provisioner) makePukBox(m libkb.MetaContext, pukring *libkb.PerUserKeyring, receiverKeyGeneric libkb.GenericKey) (*keybase1.PerUserKeyBox, error) {
	receiverKey, ok := receiverKeyGeneric.(libkb.NaclDHKeyPair)
	if !ok {
		return nil, fmt.Errorf("Unexpected receiver key type")
	}

	pukBox, err := pukring.PrepareBoxForNewDevice(m,
		receiverKey,     // receiver key: provisionee enc
		e.encryptionKey) // sender key: this device enc
	return &pukBox, err
}

func (e *Kex2Provisioner) loadMe() error {
	var err error
	e.me, err = libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	return err
}
