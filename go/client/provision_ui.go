package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type ProvisionUI struct {
	parent *UI
}

func (p ProvisionUI) ChooseProvisioningMethod(ctx context.Context, arg keybase1.ChooseProvisioningMethodArg) (keybase1.ProvisionMethod, error) {
	return keybase1.ProvisionMethod_DEVICE, nil
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
