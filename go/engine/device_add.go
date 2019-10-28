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

func (e *DeviceAdd) promptLoop(m libkb.MetaContext, provisioner *Kex2Provisioner, secret *libkb.Kex2Secret, provisioneeType keybase1.DeviceType) (err error) {
	sb := secret.Secret()
	arg := keybase1.DisplayAndPromptSecretArg{
		Secret:          sb[:],
		Phrase:          secret.Phrase(),
		OtherDeviceType: provisioneeType,
	}
	for i := 0; i < 10; i++ {
		receivedSecret, err := m.UIs().ProvisionUI.DisplayAndPromptSecret(m.Ctx(), arg)
		if err != nil {
			m.Warning("DisplayAndPromptSecret error: %s", err)
			return err
		}

		if receivedSecret.Secret != nil && len(receivedSecret.Secret) > 0 {
			m.Debug("received secret, adding to provisioner")
			var ks kex2.Secret
			copy(ks[:], receivedSecret.Secret)
			provisioner.AddSecret(ks)
			return nil
		}

		if len(receivedSecret.Phrase) > 0 {
			m.Debug("received secret phrase, checking validity")
			checker := libkb.MakeCheckKex2SecretPhrase(m.G())
			if !checker.F(receivedSecret.Phrase) {
				m.Debug("secret phrase failed validity check (attempt %d)", i+1)
				arg.PreviousErr = checker.Hint
				continue
			}
			uid := m.CurrentUID()
			m.Debug("received secret phrase, adding to provisioner with uid=%s", uid)
			ks, err := libkb.NewKex2SecretFromUIDAndPhrase(uid, receivedSecret.Phrase)
			if err != nil {
				m.Warning("NewKex2SecretFromPhrase error: %s", err)
				return err
			}
			provisioner.AddSecret(ks.Secret())
			return nil
		}

		if provisioneeType == keybase1.DeviceType_MOBILE {
			// for mobile provisionee, only displaying the secret so it's
			// ok/expected that nothing came back
			m.Debug("device add DisplayAndPromptSecret returned empty secret, stopping retry loop")
			return nil
		}
	}

	return libkb.RetryExhaustedError{}
}

// Run starts the engine.
func (e *DeviceAdd) Run(m libkb.MetaContext) (err error) {
	defer m.Trace("DeviceAdd#Run", func() error { return err })()

	m.G().LocalSigchainGuard().Set(m.Ctx(), "DeviceAdd")
	defer m.G().LocalSigchainGuard().Clear(m.Ctx(), "DeviceAdd")

	arg := keybase1.ChooseDeviceTypeArg{Kind: keybase1.ChooseType_NEW_DEVICE}
	provisioneeType, err := m.UIs().ProvisionUI.ChooseDeviceType(context.TODO(), arg)
	if err != nil {
		return err
	}
	uid := m.CurrentUID()

	// make a new secret; continue to generate legacy Kex2 secrets for now.
	kex2SecretTyp := libkb.Kex2SecretTypeV1Desktop
	if provisioneeType == keybase1.DeviceType_MOBILE || m.G().GetAppType() == libkb.DeviceTypeMobile {
		kex2SecretTyp = libkb.Kex2SecretTypeV1Mobile
	}
	m.Debug("provisionee device type: %v; uid: %s; secret type: %d", provisioneeType, uid, kex2SecretTyp)
	secret, err := libkb.NewKex2SecretFromTypeAndUID(kex2SecretTyp, uid)
	if err != nil {
		return err
	}
	m.Debug("secret phrase received")

	// provisioner needs ppstream, and UI is confusing when it asks for
	// it at the same time as asking for the secret, so get it first
	// before prompting for the kex2 secret:
	pps, err := libkb.GetPassphraseStreamStored(m)
	if err != nil {
		return err
	}

	// create provisioner engine
	provisioner := NewKex2Provisioner(m.G(), secret.Secret(), pps)

	var canceler func()
	m, canceler = m.WithContextCancel()

	// display secret and prompt for secret from X in a goroutine:
	go func() {
		err := e.promptLoop(m, provisioner, secret, provisioneeType)
		if err != nil {
			m.Debug("DeviceAdd prompt loop error: %s", err)
			canceler()
		}
	}()

	defer func() {
		canceler()
	}()

	if err := RunEngine2(m, provisioner); err != nil {
		if err == kex2.ErrHelloTimeout {
			err = libkb.CanceledError{M: "Failed to provision device: are you sure you typed the secret properly?"}
		}
		return err
	}

	m.G().KeyfamilyChanged(m.Ctx(), m.G().Env.GetUID())

	return nil
}
