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

func (u *RemoteProvisionUI) ChooseDeviceType(ctx context.Context, _ int) (keybase1.DeviceType, error) {
	return u.cli.ChooseDeviceType(ctx, u.sessionID)
}

func (u *RemoteProvisionUI) DisplayAndPromptSecret(ctx context.Context, arg keybase1.DisplayAndPromptSecretArg) ([]byte, error) {
	arg.SessionID = u.sessionID
	return u.cli.DisplayAndPromptSecret(ctx, arg)
}

func (u *RemoteProvisionUI) PromptNewDeviceName(ctx context.Context, arg keybase1.PromptNewDeviceNameArg) (string, error) {
	arg.SessionID = u.sessionID
	return u.cli.PromptNewDeviceName(ctx, arg)
}

func (u *RemoteProvisionUI) DisplaySecretExchanged(ctx context.Context, _ int) error {
	return u.cli.DisplaySecretExchanged(ctx, u.sessionID)
}

func (u *RemoteProvisionUI) ProvisionerSuccess(ctx context.Context, arg keybase1.ProvisionerSuccessArg) error {
	arg.SessionID = u.sessionID
	return u.cli.ProvisionerSuccess(ctx, arg)
}

func (u *RemoteProvisionUI) ProvisioneeSuccess(ctx context.Context, arg keybase1.ProvisioneeSuccessArg) error {
	arg.SessionID = u.sessionID
	return u.cli.ProvisioneeSuccess(ctx, arg)
}
