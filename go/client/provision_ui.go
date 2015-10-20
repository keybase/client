package client

import (
	"fmt"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type ProvisionUI struct {
	parent *UI
}

func (p ProvisionUI) ChooseProvisioningMethod(ctx context.Context, arg keybase1.ChooseProvisioningMethodArg) (keybase1.ProvisionMethod, error) {
	p.parent.Output("How would you like to sign this install of Keybase?\n\n")
	p.parent.Output("(1) Use an existing device\n")
	p.parent.Output("(2) Use a paper key\n")
	p.parent.Output("(3) Use my Keybase passphrase\n")
	max := 3
	if len(arg.GpgUsers) > 0 {
		p.parent.Printf("(4) Use GPG (private key found for %s)\n", strings.Join(arg.GpgUsers, ", "))
		max = 4
	}

	var res keybase1.ProvisionMethod
	ret, err := p.parent.PromptSelectionOrCancel("Choose a signing option", 1, max)
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

func (p ProvisionUI) ChooseProvisionerDeviceType(ctx context.Context, sessionID int) (keybase1.DeviceType, error) {
	p.parent.Output("What type of device would you like to connect this device with?\n\n")
	p.parent.Output("(1) Desktop\n")
	p.parent.Output("(2) Mobile\n")

	var res keybase1.DeviceType
	ret, err := p.parent.PromptSelectionOrCancel("Choose a device type", 1, 2)
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
	if arg.ProvisionerDeviceType == keybase1.DeviceType_MOBILE {
		// TODO: if provisioner is a mobile device, should show arg.Secret as a QR code here:

		// also allow them to enter the phrase from the mobile device:
		p.parent.Output("Enter the verification code from your mobile device here:\n\n")
		ret, err := p.parent.Prompt("Verification code", false, libkb.CheckNotEmpty)
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

	if arg.ProvisionerDeviceType == keybase1.DeviceType_DESKTOP {
		p.parent.Output("Type this verification code into your other device:\n\n")
		p.parent.Output("\t" + arg.Phrase + "\n")

		// in C2 > C1 flow, there's no secret input on C2
		// (computer -> computer provisioning, device Y (provisionee) does not
		// offer to accept a secret from device X (provisioner) even though
		// the protocol allows it.)
		return nil, nil
	}

	return nil, fmt.Errorf("invalid device type: %d", arg.ProvisionerDeviceType)
}

func (p ProvisionUI) PromptNewDeviceName(ctx context.Context, arg keybase1.PromptNewDeviceNameArg) (string, error) {
	// XXX check for duplicates
	return p.parent.Prompt("Enter a public name for this device", false, libkb.CheckDeviceName)
}

func (p ProvisionUI) DisplaySecretExchanged(ctx context.Context, sessionID int) error {
	p.parent.Output("Secret successfully exchanged.  On your new device, choose and save a public name for it.")
	return nil
}

func NewProvisionUIProtocol() rpc.Protocol {
	// return keybase1.ProvisionUiProtocol(&ProvisionUIServer{ui: GlobUI.GetProvisionUI()})
	return keybase1.ProvisionUiProtocol(GlobUI.GetProvisionUI())
}

/*
type ProvisionUIServer struct {
	ui libkb.ProvisionUI
}

func (p *ProvisionUIServer) ChooseProvisioningMethod(ctx context.Context, arg keybase1.ChooseProvisioningMethodArg) (keybase1.ProvisionMethod, error) {
	return p.ui.ChooseProvisioningMethod(ctx, arg)
}

func (p *ProvisionUIServer) ChooseProvisionerDeviceType(ctx context.Context, sessionID int) (keybase1.DeviceType, error) {
	return p.ui.ChooseProvisionerDeviceType(ctx, sessionID)
}

func (p *ProvisionUIServer) DisplayAndPromptSecret(ctx context.Context, arg keybase1.DisplayAndPromptSecretArg) ([]byte, error) {
	return p.ui.DisplayAndPromptSecret(ctx, arg)
}
*/
