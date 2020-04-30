// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_users.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type UserChangedArg struct {
	Uid UID `codec:"uid" json:"uid"`
}

type WebOfTrustChangedArg struct {
	Username string `codec:"username" json:"username"`
}

type PasswordChangedArg struct {
	State PassphraseState `codec:"state" json:"state"`
}

type IdentifyUpdateArg struct {
	OkUsernames     []string `codec:"okUsernames" json:"okUsernames"`
	BrokenUsernames []string `codec:"brokenUsernames" json:"brokenUsernames"`
}

type NotifyUsersInterface interface {
	UserChanged(context.Context, UID) error
	WebOfTrustChanged(context.Context, string) error
	PasswordChanged(context.Context, PassphraseState) error
	IdentifyUpdate(context.Context, IdentifyUpdateArg) error
}

func NotifyUsersProtocol(i NotifyUsersInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyUsers",
		Methods: map[string]rpc.ServeHandlerDescription{
			"userChanged": {
				MakeArg: func() interface{} {
					var ret [1]UserChangedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UserChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UserChangedArg)(nil), args)
						return
					}
					err = i.UserChanged(ctx, typedArgs[0].Uid)
					return
				},
			},
			"webOfTrustChanged": {
				MakeArg: func() interface{} {
					var ret [1]WebOfTrustChangedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]WebOfTrustChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]WebOfTrustChangedArg)(nil), args)
						return
					}
					err = i.WebOfTrustChanged(ctx, typedArgs[0].Username)
					return
				},
			},
			"passwordChanged": {
				MakeArg: func() interface{} {
					var ret [1]PasswordChangedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PasswordChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PasswordChangedArg)(nil), args)
						return
					}
					err = i.PasswordChanged(ctx, typedArgs[0].State)
					return
				},
			},
			"identifyUpdate": {
				MakeArg: func() interface{} {
					var ret [1]IdentifyUpdateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]IdentifyUpdateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]IdentifyUpdateArg)(nil), args)
						return
					}
					err = i.IdentifyUpdate(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type NotifyUsersClient struct {
	Cli rpc.GenericClient
}

func (c NotifyUsersClient) UserChanged(ctx context.Context, uid UID) (err error) {
	__arg := UserChangedArg{Uid: uid}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyUsers.userChanged", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyUsersClient) WebOfTrustChanged(ctx context.Context, username string) (err error) {
	__arg := WebOfTrustChangedArg{Username: username}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyUsers.webOfTrustChanged", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyUsersClient) PasswordChanged(ctx context.Context, state PassphraseState) (err error) {
	__arg := PasswordChangedArg{State: state}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyUsers.passwordChanged", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyUsersClient) IdentifyUpdate(ctx context.Context, __arg IdentifyUpdateArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyUsers.identifyUpdate", []interface{}{__arg}, 0*time.Millisecond)
	return
}
