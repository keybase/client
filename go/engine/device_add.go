// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/kex2"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// DeviceAdd is an engine.
type DeviceAdd struct {
	libkb.Contextified
}

// NewDeviceAdd creates a DeviceAdd engine.
func NewDeviceAdd(g *libkb.GlobalContext) *DeviceAdd {
	return &DeviceAdd{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *DeviceAdd) Name() string {
	return "DeviceAdd"
}

// GetPrereqs returns the engine prereqs.
func (e *DeviceAdd) Prereqs() Prereqs {
	return Prereqs{Device: true}
}

// RequiredUIs returns the required UIs.
func (e *DeviceAdd) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{libkb.ProvisionUIKind}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *DeviceAdd) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&Kex2Provisioner{},
	}
}

// Run starts the engine.
func (e *DeviceAdd) Run(ctx *Context) (err error) {
	e.G().Log.Debug("+ DeviceAdd.Run()")
	defer func() { e.G().Log.Debug("- DeviceAdd.Run() -> %s", libkb.ErrToOk(err)) }()

	arg := keybase1.ChooseDeviceTypeArg{Kind: keybase1.ChooseType_NEW_DEVICE}
	provisioneeType, err := ctx.ProvisionUI.ChooseDeviceType(context.TODO(), arg)
	if err != nil {
		return err
	}
	e.G().Log.Debug("provisionee device type: %v", provisioneeType)

	// make a new secret:
	secret, err := libkb.NewKex2Secret(provisioneeType == keybase1.DeviceType_MOBILE)
	if err != nil {
		return err
	}
	e.G().Log.Debug("secret phrase received")

	// provisioner needs ppstream, and UI is confusing when it asks for
	// it at the same time as asking for the secret, so get it first
	// before prompting for the kex2 secret:
	pps, err := e.G().LoginState().GetPassphraseStreamStored(ctx.SecretUI)
	if err != nil {
		return err
	}

	// create provisioner engine
	provisioner := NewKex2Provisioner(e.G(), secret.Secret(), pps)

	var canceler func()
	ctx.NetContext, canceler = context.WithCancel(ctx.NetContext)

	// display secret and prompt for secret from X in a goroutine:
	go func() {
		sb := secret.Secret()
		arg := keybase1.DisplayAndPromptSecretArg{
			Secret:          sb[:],
			Phrase:          secret.Phrase(),
			OtherDeviceType: provisioneeType,
		}
		receivedSecret, err := ctx.ProvisionUI.DisplayAndPromptSecret(ctx.NetContext, arg)
		if err != nil {
			e.G().Log.Warning("DisplayAndPromptSecret error: %s", err)
			canceler()
		} else if receivedSecret.Secret != nil && len(receivedSecret.Secret) > 0 {
			e.G().Log.Debug("received secret, adding to provisioner")
			var ks kex2.Secret
			copy(ks[:], receivedSecret.Secret)
			provisioner.AddSecret(ks)
		} else if len(receivedSecret.Phrase) > 0 {
			e.G().Log.Debug("received secret phrase, adding to provisioner")
			ks, err := libkb.NewKex2SecretFromPhrase(receivedSecret.Phrase)
			if err != nil {
				e.G().Log.Warning("NewKex2SecretFromPhrase error: %s", err)
				canceler()
			} else {
				provisioner.AddSecret(ks.Secret())
			}
		}
	}()

	defer func() {
		canceler()
	}()

	if err := RunEngine(provisioner, ctx); err != nil {
		if err == kex2.ErrHelloTimeout {
			err = libkb.CanceledError{M: "Failed to provision device: are you sure you typed the secret properly?"}
		}
		return err
	}

	e.G().KeyfamilyChanged(e.G().Env.GetUID())

	return nil
}
