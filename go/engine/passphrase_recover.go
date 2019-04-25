// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"sort"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// PassphraseRecover is an engine that implements the "password recovery" flow,
// where the user is shown instructions on how to either change their password
// on other devices or allows them to change the password using a paper key.
type PassphraseRecover struct {
	arg             *keybase1.RecoverPassphraseArg
	pipelineEnabled bool
	libkb.Contextified
}

func NewPassphraseRecover(g *libkb.GlobalContext, arg *keybase1.RecoverPassphraseArg) *PassphraseRecover {
	return &PassphraseRecover{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name provides the name of the engine for the engine interface
func (e *PassphraseRecover) Name() string {
	return "PassphraseRecover"
}

// Prereqs returns engine prereqs
func (e *PassphraseRecover) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *PassphraseRecover) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers requires the other UI consumers of this engine
func (e *PassphraseRecover) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

// Run the engine
func (e *PassphraseRecover) Run(mctx libkb.MetaContext) (err error) {
	defer mctx.Trace("PassphraseRecover#Run", func() error { return err })()

	// Check to see if already logged in
	if loggedIn, _ := isLoggedIn(mctx); loggedIn {
		mctx.Debug("Already logged in with unlocked device keys")
		return nil
	}

	mctx.Debug("No device keys available, proceeding with recovery")

	// Load the user by username
	ueng := newLoginLoadUser(mctx.G(), e.arg.Username)
	if err := RunEngine2(mctx, ueng); err != nil {
		return err
	}

	// Now we're taking that user info and evaluating our options
	ckf := ueng.User().GetComputedKeyFamily()
	if ckf == nil {
		return libkb.NewNotFoundError("Account missing key family")
	}

	// If the reset pipeline is not enabled, we'll want this to act exactly the same way as before
	if !mctx.G().Env.GetFeatureFlags().HasFeature(libkb.EnvironmentFeatureAutoresetPipeline) {
		return e.legacyRecovery(mctx)
	}

	if !ckf.HasActiveDevice() {
		// Go directly to reset
		return e.suggestReset(mctx)
	}

	return nil
}

func (e *PassphraseRecover) legacyRecovery(mctx libkb.MetaContext) (err error) {
	return nil
}

func (e *PassphraseRecover) chooseDevice(mctx libkb.MetaContext, ckf *libkb.ComputedKeyFamily) (err error) {
	defer mctx.Trace("PassphraseRecover#chooseDevice", func() error { return err })()

	// Reorder the devices for the list
	devices := partitionDeviceList(ckf.GetAllActiveDevices())
	sort.Sort(devices)

	// Choose an existing device
	expDevices := make([]keybase1.Device, len(devices))
	idMap := make(map[keybase1.DeviceID]*libkb.Device)
	for i, d := range devices {
		expDevices[i] = *d.ProtExport()
		idMap[d.ID] = d
	}
	id, err := mctx.UIs().ProvisionUI.ChooseDevice(mctx.Ctx(), keybase1.ChooseDeviceArg{
		Devices:           expDevices,
		CanSelectNoDevice: true,
	})
	if err != nil {
		return err
	}

	// No device chosen, we're going into the reset flow
	if len(id) == 0 {
		// Go directly to reset
		return e.suggestReset(mctx)
	}

	mctx.Debug("user selected device %s", id)
	selected, ok := idMap[id]
	if !ok {
		return fmt.Errorf("selected device %s not in local device map", id)
	}
	mctx.Debug("device details: %+v", selected)

	// Roughly the same flow as in provisioning
	switch selected.Type {
	case libkb.DeviceTypePaper:
		return e.changeWithPaper(mctx, selected)
	case libkb.DeviceTypeDesktop, libkb.DeviceTypeMobile:
		return e.explainChange(mctx, selected)
	default:
		return fmt.Errorf("unknown device type: %v", selected.Type)
	}
}

func (e *PassphraseRecover) suggestReset(mctx libkb.MetaContext) (err error) {
	return nil
}

func (e *PassphraseRecover) changeWithPaper(mctx libkb.MetaContext, paperKey *libkb.Device) (err error) {
	return nil
}

func (e *PassphraseRecover) explainChange(mctx libkb.MetaContext, paperKey *libkb.Device) (err error) {
	return nil
}
