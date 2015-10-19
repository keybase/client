package service

import (
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

type RemoteGPGUI struct {
	sessionID int
	uicli     keybase1.GpgUiClient
}

func NewRemoteGPGUI(sessionID int, c *rpc.Client) *RemoteGPGUI {
	return &RemoteGPGUI{
		sessionID: sessionID,
		uicli:     keybase1.GpgUiClient{Cli: c},
	}
}

func (r *RemoteGPGUI) SelectKey(ctx context.Context, arg keybase1.SelectKeyArg) (string, error) {
	arg.SessionID = r.sessionID
	return r.uicli.SelectKey(ctx, arg)
}

func (r *RemoteGPGUI) SelectKeyAndPushOption(ctx context.Context, arg keybase1.SelectKeyAndPushOptionArg) (keybase1.SelectKeyRes, error) {
	arg.SessionID = r.sessionID
	return r.uicli.SelectKeyAndPushOption(ctx, arg)
}

func (r *RemoteGPGUI) WantToAddGPGKey(ctx context.Context, _ int) (bool, error) {
	return r.uicli.WantToAddGPGKey(ctx, r.sessionID)
}

func (r *RemoteGPGUI) ConfirmDuplicateKeyChosen(ctx context.Context, _ int) (bool, error) {
	return r.uicli.ConfirmDuplicateKeyChosen(ctx, r.sessionID)
}
