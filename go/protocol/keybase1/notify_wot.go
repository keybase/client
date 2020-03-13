// Auto-generated to Go types and interfaces using avdl-compiler v1.4.8 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_wot.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type WotChangedMsg struct {
	VoucherUID *UID `codec:"voucherUID,omitempty" json:"voucherUid,omitempty"`
	VoucheeUID *UID `codec:"voucheeUID,omitempty" json:"voucheeUid,omitempty"`
}

func (o WotChangedMsg) DeepCopy() WotChangedMsg {
	return WotChangedMsg{
		VoucherUID: (func(x *UID) *UID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.VoucherUID),
		VoucheeUID: (func(x *UID) *UID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.VoucheeUID),
	}
}

type WotChangedArg struct {
	Category string `codec:"category" json:"category"`
	Voucher  *UID   `codec:"voucher,omitempty" json:"voucher,omitempty"`
	Vouchee  *UID   `codec:"vouchee,omitempty" json:"vouchee,omitempty"`
}

type NotifyWotInterface interface {
	WotChanged(context.Context, WotChangedArg) error
}

func NotifyWotProtocol(i NotifyWotInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyWot",
		Methods: map[string]rpc.ServeHandlerDescription{
			"wotChanged": {
				MakeArg: func() interface{} {
					var ret [1]WotChangedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]WotChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[1]WotChangedArg)(nil), args)
						return
					}
					err = i.WotChanged(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type NotifyWotClient struct {
	Cli rpc.GenericClient
}

func (c NotifyWotClient) WotChanged(ctx context.Context, __arg WotChangedArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyWot.wotChanged", []interface{}{__arg}, 0*time.Millisecond)
	return
}
