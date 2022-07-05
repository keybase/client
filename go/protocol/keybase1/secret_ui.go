// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/secret_ui.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type SecretEntryArg struct {
	Desc       string `codec:"desc" json:"desc"`
	Prompt     string `codec:"prompt" json:"prompt"`
	Err        string `codec:"err" json:"err"`
	Cancel     string `codec:"cancel" json:"cancel"`
	Ok         string `codec:"ok" json:"ok"`
	Reason     string `codec:"reason" json:"reason"`
	ShowTyping bool   `codec:"showTyping" json:"showTyping"`
}

func (o SecretEntryArg) DeepCopy() SecretEntryArg {
	return SecretEntryArg{
		Desc:       o.Desc,
		Prompt:     o.Prompt,
		Err:        o.Err,
		Cancel:     o.Cancel,
		Ok:         o.Ok,
		Reason:     o.Reason,
		ShowTyping: o.ShowTyping,
	}
}

type SecretEntryRes struct {
	Text        string `codec:"text" json:"text"`
	Canceled    bool   `codec:"canceled" json:"canceled"`
	StoreSecret bool   `codec:"storeSecret" json:"storeSecret"`
}

func (o SecretEntryRes) DeepCopy() SecretEntryRes {
	return SecretEntryRes{
		Text:        o.Text,
		Canceled:    o.Canceled,
		StoreSecret: o.StoreSecret,
	}
}

type GetPassphraseArg struct {
	SessionID int             `codec:"sessionID" json:"sessionID"`
	Pinentry  GUIEntryArg     `codec:"pinentry" json:"pinentry"`
	Terminal  *SecretEntryArg `codec:"terminal,omitempty" json:"terminal,omitempty"`
}

type SecretUiInterface interface {
	GetPassphrase(context.Context, GetPassphraseArg) (GetPassphraseRes, error)
}

func SecretUiProtocol(i SecretUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.secretUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getPassphrase": {
				MakeArg: func() interface{} {
					var ret [1]GetPassphraseArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetPassphraseArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetPassphraseArg)(nil), args)
						return
					}
					ret, err = i.GetPassphrase(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type SecretUiClient struct {
	Cli rpc.GenericClient
}

func (c SecretUiClient) GetPassphrase(ctx context.Context, __arg GetPassphraseArg) (res GetPassphraseRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.secretUi.getPassphrase", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}
