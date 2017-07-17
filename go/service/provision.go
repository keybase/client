// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
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

func (u *RemoteProvisionUI) ChooseGPGMethod(ctx context.Context, arg keybase1.ChooseGPGMethodArg) (keybase1.GPGMethod, error) {
	arg.SessionID = u.sessionID
	return u.cli.ChooseGPGMethod(ctx, arg)
}

func (u *RemoteProvisionUI) SwitchToGPGSignOK(ctx context.Context, arg keybase1.SwitchToGPGSignOKArg) (bool, error) {
	arg.SessionID = u.sessionID
	return u.cli.SwitchToGPGSignOK(ctx, arg)
}

func (u *RemoteProvisionUI) ChooseDevice(ctx context.Context, arg keybase1.ChooseDeviceArg) (keybase1.DeviceID, error) {
	arg.SessionID = u.sessionID
	return u.cli.ChooseDevice(ctx, arg)
}

func (u *RemoteProvisionUI) ChooseDeviceType(ctx context.Context, arg keybase1.ChooseDeviceTypeArg) (keybase1.DeviceType, error) {
	arg.SessionID = u.sessionID
	return u.cli.ChooseDeviceType(ctx, arg)
}

func (u *RemoteProvisionUI) DisplayAndPromptSecret(ctx context.Context, arg keybase1.DisplayAndPromptSecretArg) (keybase1.SecretResponse, error) {
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
