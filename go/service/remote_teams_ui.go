package service

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type RemoteTeamsUI struct {
	sessionID int
	cli       keybase1.TeamsUiClient
}

var _ keybase1.TeamsUiInterface = (*RemoteTeamsUI)(nil)

func NewRemoteTeamsUI(sessionID int, c *rpc.Client) *RemoteTeamsUI {
	return &RemoteTeamsUI{
		sessionID: sessionID,
		cli:       keybase1.TeamsUiClient{Cli: c},
	}
}

func (r *RemoteTeamsUI) ConfirmRootTeamDelete(ctx context.Context, arg keybase1.ConfirmRootTeamDeleteArg) (bool, error) {
	arg.SessionID = r.sessionID
	return r.cli.ConfirmRootTeamDelete(ctx, arg)
}

func (r *RemoteTeamsUI) ConfirmSubteamDelete(ctx context.Context, arg keybase1.ConfirmSubteamDeleteArg) (bool, error) {
	arg.SessionID = r.sessionID
	return r.cli.ConfirmSubteamDelete(ctx, arg)
}

func (r *RemoteTeamsUI) ConfirmInviteLinkAccept(ctx context.Context, arg keybase1.ConfirmInviteLinkAcceptArg) (bool, error) {
	arg.SessionID = r.sessionID
	return r.cli.ConfirmInviteLinkAccept(ctx, arg)
}
