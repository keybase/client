// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_invite_friends.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type UpdateInviteCountsArg struct {
	Counts InviteCounts `codec:"counts" json:"counts"`
}

type NotifyInviteFriendsInterface interface {
	UpdateInviteCounts(context.Context, InviteCounts) error
}

func NotifyInviteFriendsProtocol(i NotifyInviteFriendsInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyInviteFriends",
		Methods: map[string]rpc.ServeHandlerDescription{
			"updateInviteCounts": {
				MakeArg: func() interface{} {
					var ret [1]UpdateInviteCountsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UpdateInviteCountsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UpdateInviteCountsArg)(nil), args)
						return
					}
					err = i.UpdateInviteCounts(ctx, typedArgs[0].Counts)
					return
				},
			},
		},
	}
}

type NotifyInviteFriendsClient struct {
	Cli rpc.GenericClient
}

func (c NotifyInviteFriendsClient) UpdateInviteCounts(ctx context.Context, counts InviteCounts) (err error) {
	__arg := UpdateInviteCountsArg{Counts: counts}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyInviteFriends.updateInviteCounts", []interface{}{__arg}, 0*time.Millisecond)
	return
}
