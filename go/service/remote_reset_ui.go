package service

import (
	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type RemoteResetUI struct {
	sessionID int
	cli       keybase1.ResetUIClient
}

func NewRemoteResetUI(sessionID int, c *rpc.Client) *RemoteResetUI {
	return &RemoteResetUI{
		sessionID: sessionID,
		cli:       keybase1.ResetUIClient{Cli: c},
	}
}

func (r *RemoteResetUI) ResetPrompt(ctx context.Context, arg keybase1.ResetPromptArg) (keybase1.ResetPromptResult, error) {
	arg.SessionID = r.sessionID
	return r.cli.ResetPrompt(ctx, arg)
}
