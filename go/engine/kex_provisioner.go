// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
	keybase1 "github.com/keybase/client/go/protocol"
	jsonw "github.com/keybase/go-jsonw"
)

type KexProvisioner struct {
	KexCommon
	secretPhrase string
	engctx       *Context
	deviceSibkey libkb.GenericKey
	sigKey       libkb.GenericKey
	devidY       keybase1.DeviceID
	sec          *kex.Secret
}

// NewKexProvisioner creates a sibkey add engine.
// This runs on device X to provision device Y in forward kex.
// The secretPhrase is needed before this engine can run because
// the weak id used in receive() is based on it.
func NewKexProvisioner(g *libkb.GlobalContext, secretPhrase string) *KexProvisioner {
	kc := newKexCommon(g)
	return &KexProvisioner{
		KexCommon:    *kc,
		secretPhrase: secretPhrase,
	}
}

func (k *KexProvisioner) Name() string {
	return "KexProvisioner"
}

func (k *KexProvisioner) Prereqs() Prereqs {
	return Prereqs{Device: true}
}

func (k *KexProvisioner) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{libkb.SecretUIKind, libkb.LocksmithUIKind}
}

func (k *KexProvisioner) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (k *KexProvisioner) Run(ctx *Context) error {
	k.engctx = ctx

	var err error
	uarg := libkb.NewLoadUserPubOptionalArg(k.G())
	uarg.LoginContext = ctx.LoginContext
	k.user, err = libkb.LoadMe(uarg)
	if err != nil {
		return err
	}

	dp := k.G().Env.GetDeviceID()
	if dp.IsNil() {
		// Prereqs w/ Device: true should catch this earlier, but just in case:
		return libkb.DeviceRequiredError{}
	}
	k.deviceID = dp
	k.G().Log.Debug("device id: %s", k.deviceID)

	if k.user.GetComputedKeyFamily() == nil {
		return libkb.KeyFamilyError{Msg: "nil ckf"}
	}

	k.deviceSibkey, err = k.user.GetComputedKeyFamily().GetSibkeyForDevice(k.deviceID)
	if err != nil {
		k.G().Log.Warning("KexProvisioner.Run: error getting device sibkey: %s", err)
		return err
	}

	token, csrf := k.sessionArgs(ctx)

	k.sec, err = kex.SecretFromPhrase(k.user.GetName(), k.secretPhrase)
	if err != nil {
		return err
	}
	k.serverMu.Lock()
	k.server = kex.NewSender(kex.DirectionXtoY, k.sec.Secret(), token, csrf, k.G())
	k.serverMu.Unlock()

	arg := libkb.SecretKeyArg{
		Me:      k.user,
		KeyType: libkb.DeviceSigningKeyType,
	}
	k.sigKey, err = k.G().Keyrings.GetSecretKeyWithPrompt(ctx.LoginContext, arg, ctx.SecretUI, "new device install")
	if err != nil {
		k.G().Log.Warning("KexProvisioner.Run: GetSecretKey error: %s", err)
		return err
	}

	k.G().Log.Debug("KexProvisioner: starting receive loop")
	var nilDeviceID keybase1.DeviceID
	m := kex.NewMeta(k.user.GetUID(), k.sec.StrongID(), nilDeviceID, k.deviceID, kex.DirectionYtoX)
	err = k.loopReceives(ctx, m, k.sec)
	if err != nil {
		k.G().Log.Warning("Error in KEX receive: %s", err)
	}
	return err
}

func (k *KexProvisioner) Cancel() error {
	var nilDeviceID keybase1.DeviceID
	m := kex.NewMeta(k.user.GetUID(), k.sec.StrongID(), nilDeviceID, k.deviceID, kex.DirectionYtoX)
	return k.cancel(m)
}

func (k *KexProvisioner) loopReceives(ctx *Context, m *kex.Meta, sec *kex.Secret) error {
	// start receive loop
	k.poll(ctx, m, sec)

	// wait for StartKex() from Y
	k.kexStatus(ctx, "waiting for StartKex from Y", keybase1.KexStatusCode_START_WAIT)
	if err := k.next(ctx, kex.StartKexMsg, kex.StartTimeout, k.handleStart); err != nil {
		if _, ok := err.(libkb.TimeoutError); !ok {
			return err
		}
		// a timeout error while waiting for StartKex most likely means that the
		// secret phrase the user entered is invalid.
		return libkb.InvalidKexPhraseError{}
	}
	k.kexStatus(ctx, "received StartKex from Y", keybase1.KexStatusCode_START_RECEIVED)

	pair, ok := k.deviceSibkey.(libkb.NaclSigningKeyPair)
	if !ok {
		return libkb.BadKeyError{Msg: fmt.Sprintf("invalid device sibkey type %T", k.deviceSibkey)}
	}
	m.Sender = k.deviceID
	m.Receiver = k.devidY
	k.kexStatus(ctx, "sending Hello to Y", keybase1.KexStatusCode_HELLO_SEND)
	if err := k.server.Hello(m, m.Sender, pair.GetKID()); err != nil {
		return err
	}

	// wait for PleaseSign() from Y
	k.kexStatus(ctx, "waiting for PleaseSign from Y", keybase1.KexStatusCode_PLEASE_SIGN_WAIT)
	if err := k.next(ctx, kex.PleaseSignMsg, kex.IntraTimeout, k.handlePleaseSign); err != nil {
		return err
	}
	k.kexStatus(ctx, "received PleaseSign from Y", keybase1.KexStatusCode_PLEASE_SIGN_RECEIVED)

	m.Sender = k.deviceID
	m.Receiver = k.devidY
	k.kexStatus(ctx, "sending Done to Y", keybase1.KexStatusCode_DONE_SEND)
	if err := k.server.Done(m); err != nil {
		return err
	}

	k.G().Log.Debug("KexProvisioner: finished with messages, waiting for receive to end.")
	k.wg.Wait()
	k.G().Log.Debug("KexProvisioner: done.")
	k.kexStatus(ctx, "kexsib complete on existing device X ", keybase1.KexStatusCode_END)
	return nil
}

func (k *KexProvisioner) handleStart(ctx *Context, m *kex.Msg) error {
	k.devidY = m.Sender
	return nil
}

func (k *KexProvisioner) verifyPleaseSign(jw *jsonw.Wrapper, newKID keybase1.KID) (err error) {
	jw.AssertEqAtPath("body.key.kid", k.sigKey.GetKID().ToJsonw(), &err)
	jw.AssertEqAtPath("body.key.uid", libkb.UIDWrapper(k.user.GetUID()), &err)
	jw.AssertEqAtPath("body.key.eldest_kid", k.user.GetEldestKID().ToJsonw(), &err)
	jw.AssertEqAtPath("body.key.username", jsonw.NewString(k.user.GetName()), &err)
	jw.AssertEqAtPath("body.device.kid", newKID.ToJsonw(), &err)
	jw.AssertEqAtPath("body.type", jsonw.NewString("sibkey"), &err)
	return err
}

func (k *KexProvisioner) handlePleaseSign(ctx *Context, m *kex.Msg) error {
	eddsa := m.Args().SigningKey
	sig := m.Args().Sig

	keypair := libkb.NaclSigningKeyPair{Public: eddsa}
	sigPayload, _, err := keypair.VerifyStringAndExtract(sig)
	if err != nil {
		return err
	}

	k.G().Log.Debug("Got PleaseSign() on verified JSON blob %s\n", string(sigPayload))

	// k.deviceSibkey is public only
	if k.sigKey == nil {
		var err error
		arg := libkb.SecretKeyArg{
			Me:      k.user,
			KeyType: libkb.DeviceSigningKeyType,
		}
		k.sigKey, err = k.G().Keyrings.GetSecretKeyWithPrompt(nil, arg, k.engctx.SecretUI, "new device install")
		if err != nil {
			return err
		}
	}

	jw, err := jsonw.Unmarshal(sigPayload)
	if err != nil {
		return err
	}

	var newKID keybase1.KID
	var newKey libkb.GenericKey

	if newKID, err = libkb.GetKID(jw.AtPath("body.sibkey.kid")); err != nil {
		return err
	}

	if newKey, err = libkb.ImportKeypairFromKID(newKID); err != nil {
		return err
	}

	if err = k.verifyPleaseSign(jw, newKID); err != nil {
		return err
	}

	if err = jw.SetValueAtPath("body.sibkey.reverse_sig", jsonw.NewString(sig)); err != nil {
		return err
	}

	del := libkb.Delegator{
		NewKey:         newKey,
		ExistingKey:    k.sigKey,
		Me:             k.user,
		Expire:         libkb.NaclEdDSAExpireIn,
		DelegationType: libkb.SibkeyType,
		EldestKID:      k.user.GetEldestKID(),
		Contextified:   libkb.NewContextified(k.G()),
	}

	if err = del.CheckArgs(); err != nil {
		return err
	}

	if err = del.SignAndPost(ctx.LoginContext, jw); err != nil {
		return err
	}

	return nil
}
