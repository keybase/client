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

func NewProvisionUIProtocol() rpc.Protocol {
	return keybase1.ProvisionUiProtocol(&ProvisionUIServer{ui: GlobUI.GetProvisionUI()})
}

type ProvisionUIServer struct {
	ui libkb.ProvisionUI
}

func (p *ProvisionUIServer) ChooseProvisioningMethod(ctx context.Context, arg keybase1.ChooseProvisioningMethodArg) (keybase1.ProvisionMethod, error) {
	return p.ui.ChooseProvisioningMethod(ctx, arg)
}
