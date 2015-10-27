package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type ProvisionUI struct {
	parent      *UI
	provisioner bool // set to true if the client UI is the device provisioner
}

func NewProvisionUIProtocol(g *libkb.GlobalContext, provisioner bool) rpc.Protocol {
	return keybase1.ProvisionUiProtocol(g.UI.GetProvisionUI(provisioner))
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
	p.parent.Output("(1) Desktop\n")
	p.parent.Output("(2) Mobile\n")

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
	if p.provisioner {
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

	} else {
		// this is the provisionee device (device Y)
		// For command line app, the provisionee displays secrets only

		p.parent.Output("Type this verification code into your other device:\n\n")
		p.parent.Output("\t" + arg.Phrase + "\n\n")

		// TODO: if arg.OtherDeviceType == keybase1.DeviceType_MOBILE { show qr code as well }
		return nil, nil
	}
}

func (p ProvisionUI) PromptNewDeviceName(ctx context.Context, arg keybase1.PromptNewDeviceNameArg) (string, error) {
	// TODO check for duplicates (existing device list in arg)
	return PromptWithChecker(PromptDescriptorProvisionDeviceName, p.parent, "Enter a public name for this device", false, libkb.CheckDeviceName)
}

func (p ProvisionUI) DisplaySecretExchanged(ctx context.Context, sessionID int) error {
	p.parent.Output("Secret successfully exchanged.  On your new device, choose and save a public name for it.")
	return nil
}

func (p ProvisionUI) ProvisionSuccess(ctx context.Context, sessionID int) error {
	p.parent.Output("Device successfully provisioned.")
	return nil
}
