package service

import (
	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type RemoteProvisionUI struct {
	sessionID int
	cli       keybase1.ProvisionUiClient
}

func NewRemoteProvisionUI(sessionID int, c *rpc.Client) *RemoteProvisionUI {
	return &RemoteProvisionUI{
		sessionID: sessionID,
		cli:       keybase1.ProvisionUiClient{Cli: c},
	}
}

func (u *RemoteProvisionUI) ChooseProvisioningMethod(ctx context.Context, arg keybase1.ChooseProvisioningMethodArg) (keybase1.ProvisionMethod, error) {
	arg.SessionID = u.sessionID
	return u.cli.ChooseProvisioningMethod(ctx, arg)
}

func (u *RemoteProvisionUI) ChooseProvisionerDeviceType(ctx context.Context, _ int) (keybase1.DeviceType, error) {
	return u.cli.ChooseProvisionerDeviceType(ctx, u.sessionID)
}
