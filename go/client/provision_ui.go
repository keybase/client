package client

import (
	"fmt"
	"os"
	"path"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/client/go/qrcode"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type ProvisionUI struct {
	parent *UI
	role   libkb.KexRole
}

func NewProvisionUIProtocol(g *libkb.GlobalContext, role libkb.KexRole) rpc.Protocol {
	return keybase1.ProvisionUiProtocol(g.UI.GetProvisionUI(role))
}

func (p ProvisionUI) ChooseProvisioningMethod(ctx context.Context, arg keybase1.ChooseProvisioningMethodArg) (keybase1.ProvisionMethod, error) {
	p.parent.Output("How would you like to sign this install of Keybase?\n\n")
	p.parent.Output("(1) Use an existing device\n")
	p.parent.Output("(2) Use a paper key\n")
	p.parent.Output("(3) Use my Keybase passphrase\n")
	max := 3
	if arg.GpgOption {
		p.parent.Printf("(4) Use GPG\n")
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
		return keybase1.ProvisionMethod_GPG, nil
	}
	return res, fmt.Errorf("invalid provision option: %d", ret)
}

func (p ProvisionUI) ChooseDeviceType(ctx context.Context, sessionID int) (keybase1.DeviceType, error) {
	p.parent.Output("What type of device would you like to connect this device with?\n\n")
	p.parent.Output("(1) Desktop or laptop\n")
	p.parent.Output("(2) Mobile phone\n")

	var res keybase1.DeviceType
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

func (p ProvisionUI) DisplayAndPromptSecret(ctx context.Context, arg keybase1.DisplayAndPromptSecretArg) ([]byte, error) {
	if p.role == libkb.KexRoleProvisioner {
		// This is the provisioner device (device X)
		// For command line app, all secrets are entered on the provisioner only:
		p.parent.Output("Enter the verification code from your other device here:\n\n")
		ret, err := PromptWithChecker(PromptDescriptorProvisionPhrase, p.parent, "Verification code", false, libkb.CheckNotEmpty)
		if err != nil {
			return nil, err
		}
		secret, err := libkb.NewKex2SecretFromPhrase(ret)
		if err != nil {
			return nil, err
		}
		sbytes := secret.Secret()
		return sbytes[:], nil

	}

	if p.role == libkb.KexRoleProvisionee {
		// this is the provisionee device (device Y)
		// For command line app, the provisionee displays secrets only

		p.parent.Output("Type this verification code into your other device:\n\n")
		p.parent.Output("\t" + arg.Phrase + "\n\n")
		p.parent.Output("If you are using the command line client on your other device, run this command:\n\n")
		p.parent.Output("\tkeybase device xadd\n\n")
		p.parent.Output("It will then prompt you for the verification code above.\n\n")

		if arg.OtherDeviceType == keybase1.DeviceType_MOBILE {
			encodings, err := qrcode.Encode(arg.Secret)
			// ignoring any of these errors...phrase above will suffice.
			if err == nil {
				p.parent.Output("Or, scan this QR Code with the keybase app on your mobile phone:\n\n")
				p.parent.Output(encodings.Terminal)
				fname := path.Join(os.TempDir(), "keybase_qr.png")
				f, ferr := os.Create(fname)
				if ferr == nil {
					f.Write(encodings.PNG)
					f.Close()
					p.parent.Printf("\nThere's also a PNG version in %s that might work better.\n\n", fname)
				}
			}
		}
		return nil, nil
	}

	return nil, libkb.InvalidArgumentError{Msg: fmt.Sprintf("invalid ProvisionUI role: %d", p.role)}
}

func (p ProvisionUI) PromptNewDeviceName(ctx context.Context, arg keybase1.PromptNewDeviceNameArg) (string, error) {
	for i := 0; i < 10; i++ {

		name, err := PromptWithChecker(PromptDescriptorProvisionDeviceName, p.parent, "Enter a public name for this device", false, libkb.CheckDeviceName)
		if err != nil {
			return "", err
		}
		var match bool
		for _, existing := range arg.ExistingDevices {
			if libkb.NameCmp(name, existing) {
				match = true
				p.parent.Printf("Device name %q already in use.  Please try again.\n", name)
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
	p.parent.Output("Secret successfully exchanged.  On your new device, choose and save a public name for it.\n\n")
	return nil
}

func (p ProvisionUI) ProvisioneeSuccess(ctx context.Context, arg keybase1.ProvisioneeSuccessArg) error {
	p.parent.Printf(CHECK + " Success! You provisioned your device " + ColorString("bold", arg.DeviceName) + ".\n\n")
	p.parent.Printf("You are logged in as " + ColorString("bold", arg.Username) + "\n")
	// turn on when kbfs active:
	if false {
		p.parent.Printf("  - your keybase public directory is available at /keybase/public/%s\n", arg.Username)
		p.parent.Printf("  - your keybase encrypted directory is available at /keybase/private/%s\n", arg.Username)
	}

	p.parent.Printf("  - type `keybase help` for more info.\n")
	return nil
}

func (p ProvisionUI) ProvisionerSuccess(ctx context.Context, arg keybase1.ProvisionerSuccessArg) error {
	p.parent.Printf(CHECK + " Success! You added a new device named " + ColorString("bold", arg.DeviceName) + " to your account.\n\n")
	return nil
}
