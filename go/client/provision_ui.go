// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/qrcode"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type ProvisionUI struct {
	libkb.Contextified
	parent *UI
	role   libkb.KexRole
}

func NewProvisionUIProtocol(g *libkb.GlobalContext, role libkb.KexRole) rpc.Protocol {
	return keybase1.ProvisionUiProtocol(g.UI.GetProvisionUI(role))
}

func (p ProvisionUI) ChooseProvisioningMethod(ctx context.Context, arg keybase1.ChooseProvisioningMethodArg) (keybase1.ProvisionMethod, error) {
	_ = p.parent.Output("How would you like to sign this install of Keybase?\n\n")
	_ = p.parent.Output("(1) Use an existing device\n")
	_ = p.parent.Output("(2) Use a paper key\n")
	_ = p.parent.Output("(3) Use my Keybase passphrase\n")
	max := 3
	if arg.GpgOption {
		_, _ = p.parent.Printf("(4) Use GPG\n")
		max = 4
	}

	var res keybase1.ProvisionMethod
	ret, err := PromptSelectionOrCancel(PromptDescriptorChooseProvisioningMethod, p.parent, "Choose a signing option", 1, max)
	if err != nil {
		if err == ErrInputCanceled {
			return res, libkb.CanceledError{M: "user canceled input"}
		}
		return res, err
	}
	switch ret {
	case 1:
		return keybase1.ProvisionMethod_DEVICE, nil
	case 2:
		return keybase1.ProvisionMethod_PAPER_KEY, nil
	case 3:
		return keybase1.ProvisionMethod_PASSPHRASE, nil
	case 4:
		_ = p.parent.Output(`In order to authorize this installation, keybase needs to sign this installation
with your GPG secret key.

You have two options.

(1) Keybase can use GPG commands to sign the installation.

(2) Keybase can export your secret key from GPG and save it to keybase's local encrypted
    keyring. This way, it can be used in 'keybase pgp sign' and 'keybase pgp decrypt'
    going forward.
`)
		gret, err := PromptSelectionOrCancel(PromptDescriptorChooseGPGMethod, p.parent, "Which do you prefer?", 1, 2)
		if err != nil {
			if err == ErrInputCanceled {
				return res, libkb.CanceledError{M: "user canceled input"}
			}
			return res, err
		}
		if gret == 1 {
			return keybase1.ProvisionMethod_GPG_SIGN, nil
		} else if gret == 2 {
			return keybase1.ProvisionMethod_GPG_IMPORT, nil
		}
	}
	return res, fmt.Errorf("invalid provision option: %d", ret)
}

func (p ProvisionUI) ChooseGPGMethod(ctx context.Context, arg keybase1.ChooseGPGMethodArg) (keybase1.GPGMethod, error) {
	if len(arg.Keys) == 0 {
		return keybase1.GPGMethod_GPG_NONE, errors.New("no keys passed to ChooseGPGMethod")
	}

	_ = p.parent.Output("In order to authorize this installation, keybase needs to sign this installation\n")
	if len(arg.Keys) == 1 {
		p.parent.Printf("with your GPG secret key %s.\n", arg.Keys[0].KeyID)
	} else {
		ids := make([]string, len(arg.Keys))
		for i, key := range arg.Keys {
			ids[i] = key.KeyID
		}

		p.parent.Printf("with one of these GPG secret keys: %s.\n", strings.Join(ids, ", "))
	}
	_ = p.parent.Output("\n")
	_ = p.parent.Output(`You have two options.

(1) Keybase can use GPG commands to sign the installation.

(2) Keybase can export your secret key from GPG and save it to keybase's local encrypted
    keyring. This way, it can be used in 'keybase pgp sign' and 'keybase pgp decrypt'
    going forward.
`)
	gret, err := PromptSelectionOrCancel(PromptDescriptorChooseGPGMethod, p.parent, "Which do you prefer?", 1, 2)
	if err != nil {
		if err == ErrInputCanceled {
			err = libkb.InputCanceledError{}
		}
		return keybase1.GPGMethod_GPG_NONE, err
	}
	switch gret {
	case 1:
		return keybase1.GPGMethod_GPG_SIGN, nil
	case 2:
		return keybase1.GPGMethod_GPG_IMPORT, nil
	default:
		return keybase1.GPGMethod_GPG_NONE, fmt.Errorf("invalid provision option: %d", gret)
	}
}

func (p ProvisionUI) SwitchToGPGSignOK(ctx context.Context, arg keybase1.SwitchToGPGSignOKArg) (bool, error) {
	p.parent.Printf("\nThere was a problem importing your GPG secret key %s.\n\n", arg.Key.KeyID)
	p.parent.Printf("\t%s\n\n", arg.ImportError)
	return p.parent.PromptYesNo(PromptDescriptorProvisionSwitchToGPGSign, "Would you like to try using GPG commands to sign this installation instead?", libkb.PromptDefaultYes)
}

func (p ProvisionUI) ChooseDevice(ctx context.Context, arg keybase1.ChooseDeviceArg) (keybase1.DeviceID, error) {
	_ = p.parent.Output("\nThe device you are currently using needs to be provisioned.\n")
	_ = p.parent.Output("Which one of your existing devices would you like to use\n")
	_ = p.parent.Output("to provision this new device?\n\n")
	for i, d := range arg.Devices {
		var ft string
		switch d.Type {
		case keybase1.DeviceTypeV2_PAPER:
			ft = "paper key"
		case keybase1.DeviceTypeV2_DESKTOP:
			ft = "computer"
		case keybase1.DeviceTypeV2_MOBILE:
			ft = "mobile"
		}
		p.parent.Printf("\t%d. [%s]\t%s\n", i+1, ft, d.Name)
	}

	allowed := len(arg.Devices)
	if arg.CanSelectNoDevice {
		p.parent.Printf("\t%d. I don't have access to any of these devices.\n", len(arg.Devices)+1)
		allowed++
	}
	_ = p.parent.Output("\n")

	ret, err := PromptSelectionOrCancel(PromptDescriptorChooseDevice, p.parent, "Choose a device", 1, allowed)

	if err != nil {
		if err == ErrInputCanceled {
			return keybase1.DeviceID(""), libkb.InputCanceledError{}
		}
		return keybase1.DeviceID(""), err
	}

	if arg.CanSelectNoDevice && ret == len(arg.Devices)+1 {
		// no access selection
		return keybase1.DeviceID(""), nil
	}

	return arg.Devices[ret-1].DeviceID, nil
}

func (p ProvisionUI) ChooseDeviceType(ctx context.Context, arg keybase1.ChooseDeviceTypeArg) (keybase1.DeviceType, error) {
	var res keybase1.DeviceType
	switch arg.Kind {
	case keybase1.ChooseType_EXISTING_DEVICE:
		_ = p.parent.Output("What is your existing device?")
	case keybase1.ChooseType_NEW_DEVICE:
		_ = p.parent.Output("What kind of device are you adding?")
	default:
		return res, fmt.Errorf("Invalid ChooseType: %v", arg.Kind)
	}
	_ = p.parent.Output("\n\n")
	_ = p.parent.Output("(1) Desktop or laptop\n")
	_ = p.parent.Output("(2) Mobile phone\n\n")

	ret, err := PromptSelectionOrCancel(PromptDescriptorChooseDeviceType, p.parent, "Choose a device type", 1, 2)
	if err != nil {
		if err == ErrInputCanceled {
			return res, libkb.CanceledError{M: "user canceled input"}
		}
		return res, err
	}
	switch ret {
	case 1:
		return keybase1.DeviceType_DESKTOP, nil
	case 2:
		return keybase1.DeviceType_MOBILE, nil
	}
	return res, fmt.Errorf("invalid device type option: %d", ret)

}

func (p ProvisionUI) DisplayAndPromptSecret(ctx context.Context, arg keybase1.DisplayAndPromptSecretArg) (keybase1.SecretResponse, error) {
	var resp keybase1.SecretResponse
	if p.role == libkb.KexRoleProvisioner {
		// This is the provisioner device (device X)

		// For mobile, show the QR code and the phrase, do not prompt:
		if arg.OtherDeviceType == keybase1.DeviceType_MOBILE {
			encodings, err := qrcode.Encode([]byte(arg.Phrase))
			// ignoring any of these errors...phrase above will suffice.
			if err == nil {
				_ = p.parent.Output("Scan this QR Code with the keybase app on your mobile phone:\n\n")
				_, _ = p.parent.PrintfUnescaped(encodings.Terminal)
				fname := filepath.Join(os.TempDir(), "keybase_qr.png")
				f, ferr := os.Create(fname)
				if ferr == nil {
					_, _ = f.Write(encodings.PNG)
					f.Close()
					p.parent.Printf("\nThere's also a PNG version in %s that might work better.\n\n", fname)
				}
			}

			_ = p.parent.Output("\n\nOr, you can type this verification code into your other device:\n\n")
			_ = p.parent.Output("\t" + arg.Phrase + "\n\n")
		} else {
			// For command line app desktop provision, all secrets are entered on the
			// provisioner only:
			_ = p.parent.Output("\nEnter the verification code from your other device here.  To get\n")
			_ = p.parent.Output("a verification code, run 'keybase login' on your other device.\n\n")

			ret, err := PromptWithChecker(PromptDescriptorProvisionPhrase, p.parent, "Verification code", false, libkb.MakeCheckKex2SecretPhrase(p.parent.G()))
			if err != nil {
				return resp, err
			}
			resp.Phrase = ret
		}
		return resp, nil
	} else if p.role == libkb.KexRoleProvisionee {
		// this is the provisionee device (device Y)
		// For command line app, the provisionee displays secrets only

		_ = p.parent.Output("\n\nType this verification code into your other device:\n\n")
		_ = p.parent.Output("\t" + arg.Phrase + "\n\n")
		_ = p.parent.Output("If you are using the command line client on your other device, run this command:\n\n")
		_ = p.parent.Output("\tkeybase device add\n\n")
		_ = p.parent.Output("It will then prompt you for the verification code above.\n\n")

		if arg.OtherDeviceType == keybase1.DeviceType_MOBILE {
			encodings, err := qrcode.Encode([]byte(arg.Phrase))
			// ignoring any of these errors...phrase above will suffice.
			if err == nil {
				_ = p.parent.Output("Or, scan this QR Code with the keybase app on your mobile phone:\n\n")
				_, _ = p.parent.PrintfUnescaped(encodings.Terminal)
				fname := filepath.Join(os.TempDir(), "keybase_qr.png")
				f, ferr := os.Create(fname)
				if ferr == nil {
					_, _ = f.Write(encodings.PNG)
					f.Close()
					p.parent.Printf("\nThere's also a PNG version in %s that might work better.\n\n", fname)
				}
			}
		}
		return resp, nil
	}

	return resp, libkb.InvalidArgumentError{Msg: fmt.Sprintf("invalid ProvisionUI role: %d", p.role)}
}

func (p ProvisionUI) PromptNewDeviceName(ctx context.Context, arg keybase1.PromptNewDeviceNameArg) (string, error) {
	_ = p.parent.Output("\n\n")
	_, _ = p.parent.PrintfUnescaped(ColorString(p.G(), "magenta", "************************************************************\n"))
	_, _ = p.parent.PrintfUnescaped(ColorString(p.G(), "magenta", "* Name your new device!                                    *\n"))
	_, _ = p.parent.PrintfUnescaped(ColorString(p.G(), "magenta", "************************************************************\n"))
	_ = p.parent.Output("\n\n\n")

	for i := 0; i < 10; i++ {
		name, err := PromptWithChecker(PromptDescriptorProvisionDeviceName, p.parent, "Enter a public name for this device", false, libkb.CheckDeviceName)
		if err != nil {
			return "", err
		}
		var match bool
		for _, existing := range arg.ExistingDevices {
			if libkb.NameCmp(name, existing) {
				match = true
				_, _ = p.parent.Printf("You used device name %q already.\n\n", name)
				_, _ = p.parent.Printf("You can't reuse device names, even ones you've revoked, for security reasons.\n")
				_, _ = p.parent.Printf("Otherwise, someone who stole one of your devices could cause a lot of\n")
				_, _ = p.parent.Printf("confusion.\n\n")
				_, _ = p.parent.Printf("Please enter a new, unique device name for this device.\n\n")
				break
			}
		}
		if !match {
			return name, nil
		}
	}
	return "", libkb.RetryExhaustedError{}
}

func (p ProvisionUI) DisplaySecretExchanged(ctx context.Context, sessionID int) error {
	_, _ = p.parent.PrintfUnescaped("\n\n" + CHECK + " " + ColorString(p.G(), "bold", "Verification code received") + ".\n\n")
	return nil
}

func (p ProvisionUI) ProvisioneeSuccess(ctx context.Context, arg keybase1.ProvisioneeSuccessArg) error {
	_ = p.parent.Output("\n\n\n")
	_, _ = p.parent.PrintfUnescaped(CHECK + " Success! You provisioned your device " + ColorString(p.G(), "bold", arg.DeviceName) + ".\n\n")
	_, _ = p.parent.PrintfUnescaped("You are logged in as " + ColorString(p.G(), "bold", arg.Username) + "\n")
	// turn on when kbfs active:
	if false {
		_, _ = p.parent.Printf("  - your keybase public directory is available at /keybase/public/%s\n", arg.Username)
		_, _ = p.parent.Printf("  - your keybase encrypted directory is available at /keybase/private/%s\n", arg.Username)
	}

	_, _ = p.parent.Printf("  - type `keybase help` for more info.\n")
	return nil
}

func (p ProvisionUI) ProvisionerSuccess(ctx context.Context, arg keybase1.ProvisionerSuccessArg) error {
	_ = p.parent.Output("\n\n")
	_, _ = p.parent.PrintfUnescaped(CHECK + " Success! You added a new device named " + ColorString(p.G(), "bold", arg.DeviceName) + " to your account.\n\n")
	return nil
}
