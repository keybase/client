// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/stream_ui.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type CloseArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	S         Stream `codec:"s" json:"s"`
}

type ReadArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	S         Stream `codec:"s" json:"s"`
	Sz        int    `codec:"sz" json:"sz"`
}

type ResetArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	S         Stream `codec:"s" json:"s"`
}

type WriteArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	S         Stream `codec:"s" json:"s"`
	Buf       []byte `codec:"buf" json:"buf"`
}

type StreamUiInterface interface {
	Close(context.Context, CloseArg) error
	Read(context.Context, ReadArg) ([]byte, error)
	Reset(context.Context, ResetArg) error
	Write(context.Context, WriteArg) (int, error)
}

func StreamUiProtocol(i StreamUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.streamUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"close": {
				MakeArg: func() interface{} {
					var ret [1]CloseArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CloseArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CloseArg)(nil), args)
						return
					}
					err = i.Close(ctx, typedArgs[0])
					return
				},
			},
			"read": {
				MakeArg: func() interface{} {
					var ret [1]ReadArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ReadArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ReadArg)(nil), args)
						return
					}
					ret, err = i.Read(ctx, typedArgs[0])
					return
				},
			},
			"reset": {
				MakeArg: func() interface{} {
					var ret [1]ResetArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ResetArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ResetArg)(nil), args)
						return
					}
					err = i.Reset(ctx, typedArgs[0])
					return
				},
			},
			"write": {
				MakeArg: func() interface{} {
					var ret [1]WriteArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]WriteArg)
					if !ok {
						err = rpc.NewTypeError((*[1]WriteArg)(nil), args)
						return
					}
					ret, err = i.Write(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type StreamUiClient struct {
	Cli rpc.GenericClient
}

func (c StreamUiClient) Close(ctx context.Context, __arg CloseArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.streamUi.close", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c StreamUiClient) Read(ctx context.Context, __arg ReadArg) (res []byte, err error) {
	err = c.Cli.Call(ctx, "keybase.1.streamUi.read", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c StreamUiClient) Reset(ctx context.Context, __arg ResetArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.streamUi.reset", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c StreamUiClient) Write(ctx context.Context, __arg WriteArg) (res int, err error) {
	err = c.Cli.Call(ctx, "keybase.1.streamUi.write", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
