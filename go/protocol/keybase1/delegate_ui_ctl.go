// Code generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler). DO NOT EDIT.
//   Input file: avdl/keybase1/delegate_ui_ctl.avdl

package keybase1

import (
	"context"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"time"
)

type RegisterIdentifyUIArg struct {
}

type RegisterSecretUIArg struct {
}

type RegisterUpdateUIArg struct {
}

type RegisterRekeyUIArg struct {
}

type RegisterHomeUIArg struct {
}

type RegisterIdentify3UIArg struct {
}

type RegisterChatUIArg struct {
}

type RegisterLogUIArg struct {
}

type RegisterGregorFirehoseArg struct {
}

type RegisterGregorFirehoseFilteredArg struct {
	Systems []string `codec:"systems" json:"systems"`
}

type DelegateUiCtlInterface interface {
	RegisterIdentifyUI(context.Context) error
	RegisterSecretUI(context.Context) error
	RegisterUpdateUI(context.Context) error
	RegisterRekeyUI(context.Context) error
	RegisterHomeUI(context.Context) error
	RegisterIdentify3UI(context.Context) error
	RegisterChatUI(context.Context) error
	RegisterLogUI(context.Context) error
	RegisterGregorFirehose(context.Context) error
	// registerGregorFirehoseFilter allows a client to register for a filtered
	// firehose, limited to only the OOBMs of the systems provided.
	// Like the firehose handler, but less pressure.
	RegisterGregorFirehoseFiltered(context.Context, []string) error
}

func DelegateUiCtlProtocol(i DelegateUiCtlInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.delegateUiCtl",
		Methods: map[string]rpc.ServeHandlerDescription{
			"registerIdentifyUI": {
				MakeArg: func() any {
					var ret [1]RegisterIdentifyUIArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					err = i.RegisterIdentifyUI(ctx)
					return
				},
			},
			"registerSecretUI": {
				MakeArg: func() any {
					var ret [1]RegisterSecretUIArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					err = i.RegisterSecretUI(ctx)
					return
				},
			},
			"registerUpdateUI": {
				MakeArg: func() any {
					var ret [1]RegisterUpdateUIArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					err = i.RegisterUpdateUI(ctx)
					return
				},
			},
			"registerRekeyUI": {
				MakeArg: func() any {
					var ret [1]RegisterRekeyUIArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					err = i.RegisterRekeyUI(ctx)
					return
				},
			},
			"registerHomeUI": {
				MakeArg: func() any {
					var ret [1]RegisterHomeUIArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					err = i.RegisterHomeUI(ctx)
					return
				},
			},
			"registerIdentify3UI": {
				MakeArg: func() any {
					var ret [1]RegisterIdentify3UIArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					err = i.RegisterIdentify3UI(ctx)
					return
				},
			},
			"registerChatUI": {
				MakeArg: func() any {
					var ret [1]RegisterChatUIArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					err = i.RegisterChatUI(ctx)
					return
				},
			},
			"registerLogUI": {
				MakeArg: func() any {
					var ret [1]RegisterLogUIArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					err = i.RegisterLogUI(ctx)
					return
				},
			},
			"registerGregorFirehose": {
				MakeArg: func() any {
					var ret [1]RegisterGregorFirehoseArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					err = i.RegisterGregorFirehose(ctx)
					return
				},
			},
			"registerGregorFirehoseFiltered": {
				MakeArg: func() any {
					var ret [1]RegisterGregorFirehoseFilteredArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					typedArgs, ok := args.(*[1]RegisterGregorFirehoseFilteredArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RegisterGregorFirehoseFilteredArg)(nil), args)
						return
					}
					err = i.RegisterGregorFirehoseFiltered(ctx, typedArgs[0].Systems)
					return
				},
			},
		},
	}
}

type DelegateUiCtlClient struct {
	Cli rpc.GenericClient
}

func (c DelegateUiCtlClient) RegisterIdentifyUI(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.delegateUiCtl.registerIdentifyUI", []any{RegisterIdentifyUIArg{}}, nil, 0*time.Millisecond)
	return
}

func (c DelegateUiCtlClient) RegisterSecretUI(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.delegateUiCtl.registerSecretUI", []any{RegisterSecretUIArg{}}, nil, 0*time.Millisecond)
	return
}

func (c DelegateUiCtlClient) RegisterUpdateUI(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.delegateUiCtl.registerUpdateUI", []any{RegisterUpdateUIArg{}}, nil, 0*time.Millisecond)
	return
}

func (c DelegateUiCtlClient) RegisterRekeyUI(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.delegateUiCtl.registerRekeyUI", []any{RegisterRekeyUIArg{}}, nil, 0*time.Millisecond)
	return
}

func (c DelegateUiCtlClient) RegisterHomeUI(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.delegateUiCtl.registerHomeUI", []any{RegisterHomeUIArg{}}, nil, 0*time.Millisecond)
	return
}

func (c DelegateUiCtlClient) RegisterIdentify3UI(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.delegateUiCtl.registerIdentify3UI", []any{RegisterIdentify3UIArg{}}, nil, 0*time.Millisecond)
	return
}

func (c DelegateUiCtlClient) RegisterChatUI(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.delegateUiCtl.registerChatUI", []any{RegisterChatUIArg{}}, nil, 0*time.Millisecond)
	return
}

func (c DelegateUiCtlClient) RegisterLogUI(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.delegateUiCtl.registerLogUI", []any{RegisterLogUIArg{}}, nil, 0*time.Millisecond)
	return
}

func (c DelegateUiCtlClient) RegisterGregorFirehose(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.delegateUiCtl.registerGregorFirehose", []any{RegisterGregorFirehoseArg{}}, nil, 0*time.Millisecond)
	return
}

// registerGregorFirehoseFilter allows a client to register for a filtered
// firehose, limited to only the OOBMs of the systems provided.
// Like the firehose handler, but less pressure.
func (c DelegateUiCtlClient) RegisterGregorFirehoseFiltered(ctx context.Context, systems []string) (err error) {
	__arg := RegisterGregorFirehoseFilteredArg{Systems: systems}
	err = c.Cli.Call(ctx, "keybase.1.delegateUiCtl.registerGregorFirehoseFiltered", []any{__arg}, nil, 0*time.Millisecond)
	return
}
