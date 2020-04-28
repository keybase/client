// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_phone.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type PhoneNumbersChangedArg struct {
	List        []UserPhoneNumber `codec:"list" json:"list"`
	Category    string            `codec:"category" json:"category"`
	PhoneNumber PhoneNumber       `codec:"phoneNumber" json:"phoneNumber"`
}

type NotifyPhoneNumberInterface interface {
	PhoneNumbersChanged(context.Context, PhoneNumbersChangedArg) error
}

func NotifyPhoneNumberProtocol(i NotifyPhoneNumberInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyPhoneNumber",
		Methods: map[string]rpc.ServeHandlerDescription{
			"phoneNumbersChanged": {
				MakeArg: func() interface{} {
					var ret [1]PhoneNumbersChangedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PhoneNumbersChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PhoneNumbersChangedArg)(nil), args)
						return
					}
					err = i.PhoneNumbersChanged(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type NotifyPhoneNumberClient struct {
	Cli rpc.GenericClient
}

func (c NotifyPhoneNumberClient) PhoneNumbersChanged(ctx context.Context, __arg PhoneNumbersChangedArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyPhoneNumber.phoneNumbersChanged", []interface{}{__arg}, 0*time.Millisecond)
	return
}
