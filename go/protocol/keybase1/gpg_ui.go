// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/gpg_ui.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type SelectKeyRes struct {
	KeyID        string `codec:"keyID" json:"keyID"`
	DoSecretPush bool   `codec:"doSecretPush" json:"doSecretPush"`
}

func (o SelectKeyRes) DeepCopy() SelectKeyRes {
	return SelectKeyRes{
		KeyID:        o.KeyID,
		DoSecretPush: o.DoSecretPush,
	}
}

type WantToAddGPGKeyArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type ConfirmDuplicateKeyChosenArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type ConfirmImportSecretToExistingKeyArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type SelectKeyAndPushOptionArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Keys      []GPGKey `codec:"keys" json:"keys"`
}

type SelectKeyArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Keys      []GPGKey `codec:"keys" json:"keys"`
}

type SignArg struct {
	Msg         []byte `codec:"msg" json:"msg"`
	Fingerprint []byte `codec:"fingerprint" json:"fingerprint"`
}

type GetTTYArg struct {
}

type GpgUiInterface interface {
	WantToAddGPGKey(context.Context, int) (bool, error)
	ConfirmDuplicateKeyChosen(context.Context, int) (bool, error)
	ConfirmImportSecretToExistingKey(context.Context, int) (bool, error)
	SelectKeyAndPushOption(context.Context, SelectKeyAndPushOptionArg) (SelectKeyRes, error)
	SelectKey(context.Context, SelectKeyArg) (string, error)
	Sign(context.Context, SignArg) (string, error)
	GetTTY(context.Context) (string, error)
}

func GpgUiProtocol(i GpgUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.gpgUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"wantToAddGPGKey": {
				MakeArg: func() interface{} {
					var ret [1]WantToAddGPGKeyArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]WantToAddGPGKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[1]WantToAddGPGKeyArg)(nil), args)
						return
					}
					ret, err = i.WantToAddGPGKey(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"confirmDuplicateKeyChosen": {
				MakeArg: func() interface{} {
					var ret [1]ConfirmDuplicateKeyChosenArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ConfirmDuplicateKeyChosenArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ConfirmDuplicateKeyChosenArg)(nil), args)
						return
					}
					ret, err = i.ConfirmDuplicateKeyChosen(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"confirmImportSecretToExistingKey": {
				MakeArg: func() interface{} {
					var ret [1]ConfirmImportSecretToExistingKeyArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ConfirmImportSecretToExistingKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ConfirmImportSecretToExistingKeyArg)(nil), args)
						return
					}
					ret, err = i.ConfirmImportSecretToExistingKey(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"selectKeyAndPushOption": {
				MakeArg: func() interface{} {
					var ret [1]SelectKeyAndPushOptionArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SelectKeyAndPushOptionArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SelectKeyAndPushOptionArg)(nil), args)
						return
					}
					ret, err = i.SelectKeyAndPushOption(ctx, typedArgs[0])
					return
				},
			},
			"selectKey": {
				MakeArg: func() interface{} {
					var ret [1]SelectKeyArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SelectKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SelectKeyArg)(nil), args)
						return
					}
					ret, err = i.SelectKey(ctx, typedArgs[0])
					return
				},
			},
			"sign": {
				MakeArg: func() interface{} {
					var ret [1]SignArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SignArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SignArg)(nil), args)
						return
					}
					ret, err = i.Sign(ctx, typedArgs[0])
					return
				},
			},
			"getTTY": {
				MakeArg: func() interface{} {
					var ret [1]GetTTYArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetTTY(ctx)
					return
				},
			},
		},
	}
}

type GpgUiClient struct {
	Cli rpc.GenericClient
}

func (c GpgUiClient) WantToAddGPGKey(ctx context.Context, sessionID int) (res bool, err error) {
	__arg := WantToAddGPGKeyArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.gpgUi.wantToAddGPGKey", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c GpgUiClient) ConfirmDuplicateKeyChosen(ctx context.Context, sessionID int) (res bool, err error) {
	__arg := ConfirmDuplicateKeyChosenArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.gpgUi.confirmDuplicateKeyChosen", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c GpgUiClient) ConfirmImportSecretToExistingKey(ctx context.Context, sessionID int) (res bool, err error) {
	__arg := ConfirmImportSecretToExistingKeyArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.gpgUi.confirmImportSecretToExistingKey", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c GpgUiClient) SelectKeyAndPushOption(ctx context.Context, __arg SelectKeyAndPushOptionArg) (res SelectKeyRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.gpgUi.selectKeyAndPushOption", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c GpgUiClient) SelectKey(ctx context.Context, __arg SelectKeyArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.gpgUi.selectKey", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c GpgUiClient) Sign(ctx context.Context, __arg SignArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.gpgUi.sign", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c GpgUiClient) GetTTY(ctx context.Context) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.gpgUi.getTTY", []interface{}{GetTTYArg{}}, &res, 0*time.Millisecond)
	return
}
