// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"sort"

	"github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// PassphraseRecover is an engine that implements the "password recovery" flow,
// where the user is shown instructions on how to either change their password
// on other devices or allows them to change the password using a paper key.
type PassphraseRecover struct {
	arg keybase1.RecoverPassphraseArg
	libkb.Contextified
	usernameFound bool
}

func NewPassphraseRecover(g *libkb.GlobalContext, arg keybase1.RecoverPassphraseArg) *PassphraseRecover {
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
	return []libkb.UIKind{
		libkb.LoginUIKind,
		libkb.SecretUIKind,
	}
}

// SubConsumers requires the other UI consumers of this engine
func (e *PassphraseRecover) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&LoginWithPaperKey{},
	}
}

// Run the engine
func (e *PassphraseRecover) Run(mctx libkb.MetaContext) (err error) {
	defer mctx.Trace("PassphraseRecover#Run", &err)()

	// If no username was passed, ask for one
	if e.arg.Username == "" {
		res, err := mctx.UIs().LoginUI.GetEmailOrUsername(mctx.Ctx(), 0)
		if err != nil {
			return err
		}
		e.arg.Username = res
	}

	// Look up the passed username against the list of configured users
	if err := e.processUsername(mctx); err != nil {
		return err
	}

	// In the new flow we noop if we're already logged in
	if loggedIn, _ := isLoggedIn(mctx); loggedIn {
		mctx.Warning("Already logged in with unlocked device keys")
		return libkb.LoggedInError{}
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

	// HasActiveKey rather than HasActiveDevice to handle PGP cases
	if !ckf.HasActiveKey() {
		// Go directly to password reset
		return e.resetPassword(mctx)
	}
	if !ckf.HasActiveDevice() {
		// No point in asking for device selection
		return e.suggestReset(mctx)
	}

	return e.chooseDevice(mctx, ckf)
}

func (e *PassphraseRecover) processUsername(mctx libkb.MetaContext) error {
	// Fetch usernames from user configs
	currentUsername, otherUsernames, err := mctx.G().GetAllUserNames()
	if err != nil {
		return err
	}
	usernamesMap := map[libkb.NormalizedUsername]struct{}{
		currentUsername: {},
	}
	for _, username := range otherUsernames {
		usernamesMap[username] = struct{}{}
	}

	var normalized kbun.NormalizedUsername
	if e.arg.Username != "" {
		normalized = libkb.NewNormalizedUsername(e.arg.Username)
	} else {
		normalized = currentUsername
	}
	e.arg.Username = normalized.String()

	// Check if the passed username is in the map
	_, ok := usernamesMap[normalized]
	e.usernameFound = ok
	return nil
}

func (e *PassphraseRecover) chooseDevice(mctx libkb.MetaContext, ckf *libkb.ComputedKeyFamily) (err error) {
	defer mctx.Trace("PassphraseRecover#chooseDevice", &err)()

	// Reorder the devices for the list
	devices := partitionDeviceList(ckf.GetAllActiveDevices())
	sort.Sort(devices)

	// Choose an existing device
	expDevices := make([]keybase1.Device, 0, len(devices))
	idMap := make(map[keybase1.DeviceID]libkb.DeviceWithDeviceNumber)
	for _, d := range devices {
		// Don't show paper keys if the user has not provisioned on this device
		if !e.usernameFound && d.Type == keybase1.DeviceTypeV2_PAPER {
			continue
		}
		expDevices = append(expDevices, *d.ProtExportWithDeviceNum())
		idMap[d.ID] = d
	}
	id, err := mctx.UIs().LoginUI.ChooseDeviceToRecoverWith(mctx.Ctx(), keybase1.ChooseDeviceToRecoverWithArg{
		Devices: expDevices,
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
	case keybase1.DeviceTypeV2_PAPER:
		return e.loginWithPaperKey(mctx)
	case keybase1.DeviceTypeV2_DESKTOP, keybase1.DeviceTypeV2_MOBILE:
		return e.explainChange(mctx, selected)
	default:
		return fmt.Errorf("unknown device type: %v", selected.Type)
	}
}

func (e *PassphraseRecover) resetPassword(mctx libkb.MetaContext) (err error) {
	enterReset, err := mctx.UIs().LoginUI.PromptResetAccount(mctx.Ctx(), keybase1.PromptResetAccountArg{
		Prompt: keybase1.NewResetPromptDefault(keybase1.ResetPromptType_ENTER_RESET_PW),
	})
	if err != nil {
		return err
	}
	if enterReset != keybase1.ResetPromptResponse_CONFIRM_RESET {
		// Flow cancelled
		return nil
	}

	// User wants a reset password email
	res, err := mctx.G().API.Post(mctx, libkb.APIArg{
		Endpoint:    "send-reset-pw",
		SessionType: libkb.APISessionTypeNONE,
		Args: libkb.HTTPArgs{
			"email_or_username": libkb.S{Val: e.arg.Username},
		},
		AppStatusCodes: []int{libkb.SCOk, libkb.SCBadLoginUserNotFound},
	})
	if err != nil {
		return err
	}
	if res.AppStatus.Code == libkb.SCBadLoginUserNotFound {
		return libkb.NotFoundError{Msg: "User not found"}
	}
	// done
	if err := mctx.UIs().LoginUI.DisplayResetMessage(mctx.Ctx(), keybase1.DisplayResetMessageArg{
		Kind: keybase1.ResetMessage_RESET_LINK_SENT,
	}); err != nil {
		return err
	}
	return nil
}

func (e *PassphraseRecover) suggestReset(mctx libkb.MetaContext) (err error) {
	enterReset, err := mctx.UIs().LoginUI.PromptResetAccount(mctx.Ctx(), keybase1.PromptResetAccountArg{
		Prompt: keybase1.NewResetPromptDefault(keybase1.ResetPromptType_ENTER_FORGOT_PW),
	})
	if err != nil {
		return err
	}
	if enterReset != keybase1.ResetPromptResponse_CONFIRM_RESET {
		// Cancel the engine as the user elected not to reset their account
		return nil
	}

	// We are certain the user will not know their password, so we can disable that prompt.
	eng := NewAccountReset(mctx.G(), e.arg.Username)
	eng.skipPasswordPrompt = true
	if err := eng.Run(mctx); err != nil {
		return err
	}

	// We're ignoring eng.ResetPending() as we've disabled reset completion
	return nil
}

func (e *PassphraseRecover) loginWithPaperKey(mctx libkb.MetaContext) (err error) {
	// First log in using the paper key
	loginEng := NewLoginWithPaperKey(mctx.G(), e.arg.Username)
	if err := RunEngine2(mctx, loginEng); err != nil {
		return err
	}

	if err := e.changePassword(mctx); err != nil {
		// Log out before returning
		if err2 := RunEngine2(mctx, NewLogout(libkb.LogoutOptions{KeepSecrets: false, Force: true})); err2 != nil {
			mctx.Warning("Unable to log out after password change failed: %v", err2)
		}

		return err
	}

	mctx.Debug("PassphraseRecover with paper key success, sending login notification")
	mctx.G().NotifyRouter.HandleLogin(mctx.Ctx(), e.arg.Username)
	mctx.Debug("PassphraseRecover with paper key success, calling login hooks")
	mctx.G().CallLoginHooks(mctx)

	return nil
}

func (e *PassphraseRecover) changePassword(mctx libkb.MetaContext) (err error) {
	// Once logged in, check if there are any server keys
	hskEng := NewHasServerKeys(mctx.G())
	if err := RunEngine2(mctx, hskEng); err != nil {
		return err
	}
	if hskEng.GetResult().HasServerKeys {
		// Prompt the user explaining that they'll lose server keys
		proceed, err := mctx.UIs().LoginUI.PromptPassphraseRecovery(mctx.Ctx(), keybase1.PromptPassphraseRecoveryArg{
			Kind: keybase1.PassphraseRecoveryPromptType_ENCRYPTED_PGP_KEYS,
		})
		if err != nil {
			return err
		}
		if !proceed {
			return libkb.NewCanceledError("Password recovery canceled")
		}
	}

	// We either have no server keys or the user is OK with resetting them
	// Prompt the user for a new passphrase.
	passphrase, err := e.promptPassphrase(mctx)
	if err != nil {
		return err
	}

	// ppres.Passphrase contains our new password
	// Run passphrase change to finish the flow
	changeEng := NewPassphraseChange(mctx.G(), &keybase1.PassphraseChangeArg{
		Passphrase: passphrase,
		Force:      true,
	})
	if err := RunEngine2(mctx, changeEng); err != nil {
		return err
	}

	// We have a new passphrase!
	return nil
}

func (e *PassphraseRecover) explainChange(mctx libkb.MetaContext, device libkb.DeviceWithDeviceNumber) (err error) {
	var name string
	if device.Description != nil {
		name = *device.Description
	}

	// The actual contents of the shown prompt will depend on the UI impl
	return mctx.UIs().LoginUI.ExplainDeviceRecovery(mctx.Ctx(), keybase1.ExplainDeviceRecoveryArg{
		Name: name,
		Kind: device.Type.ToDeviceType(),
	})
}

func (e *PassphraseRecover) promptPassphrase(mctx libkb.MetaContext) (string, error) {
	arg := libkb.DefaultPassphraseArg(mctx)
	arg.WindowTitle = "Pick a new passphrase"
	arg.Prompt = fmt.Sprintf("Pick a new strong passphrase (%d+ characters)", libkb.MinPassphraseLength)
	arg.Type = keybase1.PassphraseType_VERIFY_PASS_PHRASE

	ppres, err := libkb.GetKeybasePassphrase(mctx, mctx.UIs().SecretUI, arg)
	if err != nil {
		return "", err
	}
	return ppres.Passphrase, nil
}
