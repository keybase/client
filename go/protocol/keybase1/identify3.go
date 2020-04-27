// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/identify3.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type Identify3Arg struct {
	Assertion   Identify3Assertion `codec:"assertion" json:"assertion"`
	GuiID       Identify3GUIID     `codec:"guiID" json:"guiID"`
	IgnoreCache bool               `codec:"ignoreCache" json:"ignoreCache"`
}

type Identify3FollowUserArg struct {
	GuiID  Identify3GUIID `codec:"guiID" json:"guiID"`
	Follow bool           `codec:"follow" json:"follow"`
}

type Identify3IgnoreUserArg struct {
	GuiID Identify3GUIID `codec:"guiID" json:"guiID"`
}

type Identify3Interface interface {
	Identify3(context.Context, Identify3Arg) error
	Identify3FollowUser(context.Context, Identify3FollowUserArg) error
	Identify3IgnoreUser(context.Context, Identify3GUIID) error
}

func Identify3Protocol(i Identify3Interface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.identify3",
		Methods: map[string]rpc.ServeHandlerDescription{
			"identify3": {
				MakeArg: func() interface{} {
					var ret [1]Identify3Arg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]Identify3Arg)
					if !ok {
						err = rpc.NewTypeError((*[1]Identify3Arg)(nil), args)
						return
					}
					err = i.Identify3(ctx, typedArgs[0])
					return
				},
			},
			"identify3FollowUser": {
				MakeArg: func() interface{} {
					var ret [1]Identify3FollowUserArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]Identify3FollowUserArg)
					if !ok {
						err = rpc.NewTypeError((*[1]Identify3FollowUserArg)(nil), args)
						return
					}
					err = i.Identify3FollowUser(ctx, typedArgs[0])
					return
				},
			},
			"identify3IgnoreUser": {
				MakeArg: func() interface{} {
					var ret [1]Identify3IgnoreUserArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]Identify3IgnoreUserArg)
					if !ok {
						err = rpc.NewTypeError((*[1]Identify3IgnoreUserArg)(nil), args)
						return
					}
					err = i.Identify3IgnoreUser(ctx, typedArgs[0].GuiID)
					return
				},
			},
		},
	}
}

type Identify3Client struct {
	Cli rpc.GenericClient
}

func (c Identify3Client) Identify3(ctx context.Context, __arg Identify3Arg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identify3.identify3", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c Identify3Client) Identify3FollowUser(ctx context.Context, __arg Identify3FollowUserArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identify3.identify3FollowUser", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c Identify3Client) Identify3IgnoreUser(ctx context.Context, guiID Identify3GUIID) (err error) {
	__arg := Identify3IgnoreUserArg{GuiID: guiID}
	err = c.Cli.Call(ctx, "keybase.1.identify3.identify3IgnoreUser", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
