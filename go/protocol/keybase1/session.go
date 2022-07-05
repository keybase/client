// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/session.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type Session struct {
	Uid             UID    `codec:"uid" json:"uid"`
	Username        string `codec:"username" json:"username"`
	Token           string `codec:"token" json:"token"`
	DeviceSubkeyKid KID    `codec:"deviceSubkeyKid" json:"deviceSubkeyKid"`
	DeviceSibkeyKid KID    `codec:"deviceSibkeyKid" json:"deviceSibkeyKid"`
}

func (o Session) DeepCopy() Session {
	return Session{
		Uid:             o.Uid.DeepCopy(),
		Username:        o.Username,
		Token:           o.Token,
		DeviceSubkeyKid: o.DeviceSubkeyKid.DeepCopy(),
		DeviceSibkeyKid: o.DeviceSibkeyKid.DeepCopy(),
	}
}

type CurrentSessionArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type SessionPingArg struct {
}

type SessionInterface interface {
	CurrentSession(context.Context, int) (Session, error)
	SessionPing(context.Context) error
}

func SessionProtocol(i SessionInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.session",
		Methods: map[string]rpc.ServeHandlerDescription{
			"currentSession": {
				MakeArg: func() interface{} {
					var ret [1]CurrentSessionArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CurrentSessionArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CurrentSessionArg)(nil), args)
						return
					}
					ret, err = i.CurrentSession(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"sessionPing": {
				MakeArg: func() interface{} {
					var ret [1]SessionPingArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.SessionPing(ctx)
					return
				},
			},
		},
	}
}

type SessionClient struct {
	Cli rpc.GenericClient
}

func (c SessionClient) CurrentSession(ctx context.Context, sessionID int) (res Session, err error) {
	__arg := CurrentSessionArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.session.currentSession", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c SessionClient) SessionPing(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.session.sessionPing", []interface{}{SessionPingArg{}}, nil, 0*time.Millisecond)
	return
}
