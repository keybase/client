// Auto-generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/stellar1/notify.avdl

package stellar1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type PaymentNotificationArg struct {
	AccountID AccountID `codec:"accountID" json:"accountID"`
	PaymentID PaymentID `codec:"paymentID" json:"paymentID"`
}

type PaymentStatusNotificationArg struct {
	AccountID AccountID `codec:"accountID" json:"accountID"`
	PaymentID PaymentID `codec:"paymentID" json:"paymentID"`
}

type RequestStatusNotificationArg struct {
	ReqID KeybaseRequestID `codec:"reqID" json:"reqID"`
}

type AccountDetailsUpdateArg struct {
	AccountID AccountID          `codec:"accountID" json:"accountID"`
	Account   WalletAccountLocal `codec:"account" json:"account"`
}

type AccountsUpdateArg struct {
	Accounts []WalletAccountLocal `codec:"accounts" json:"accounts"`
}

type PendingPaymentsUpdateArg struct {
	AccountID AccountID             `codec:"accountID" json:"accountID"`
	Pending   []PaymentOrErrorLocal `codec:"pending" json:"pending"`
}

type RecentPaymentsUpdateArg struct {
	AccountID AccountID         `codec:"accountID" json:"accountID"`
	FirstPage PaymentsPageLocal `codec:"firstPage" json:"firstPage"`
}

type NotifyInterface interface {
	PaymentNotification(context.Context, PaymentNotificationArg) error
	PaymentStatusNotification(context.Context, PaymentStatusNotificationArg) error
	RequestStatusNotification(context.Context, KeybaseRequestID) error
	AccountDetailsUpdate(context.Context, AccountDetailsUpdateArg) error
	AccountsUpdate(context.Context, []WalletAccountLocal) error
	PendingPaymentsUpdate(context.Context, PendingPaymentsUpdateArg) error
	RecentPaymentsUpdate(context.Context, RecentPaymentsUpdateArg) error
}

func NotifyProtocol(i NotifyInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "stellar.1.notify",
		Methods: map[string]rpc.ServeHandlerDescription{
			"paymentNotification": {
				MakeArg: func() interface{} {
					var ret [1]PaymentNotificationArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PaymentNotificationArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PaymentNotificationArg)(nil), args)
						return
					}
					err = i.PaymentNotification(ctx, typedArgs[0])
					return
				},
			},
			"paymentStatusNotification": {
				MakeArg: func() interface{} {
					var ret [1]PaymentStatusNotificationArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PaymentStatusNotificationArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PaymentStatusNotificationArg)(nil), args)
						return
					}
					err = i.PaymentStatusNotification(ctx, typedArgs[0])
					return
				},
			},
			"requestStatusNotification": {
				MakeArg: func() interface{} {
					var ret [1]RequestStatusNotificationArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RequestStatusNotificationArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RequestStatusNotificationArg)(nil), args)
						return
					}
					err = i.RequestStatusNotification(ctx, typedArgs[0].ReqID)
					return
				},
			},
			"accountDetailsUpdate": {
				MakeArg: func() interface{} {
					var ret [1]AccountDetailsUpdateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AccountDetailsUpdateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AccountDetailsUpdateArg)(nil), args)
						return
					}
					err = i.AccountDetailsUpdate(ctx, typedArgs[0])
					return
				},
			},
			"accountsUpdate": {
				MakeArg: func() interface{} {
					var ret [1]AccountsUpdateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AccountsUpdateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AccountsUpdateArg)(nil), args)
						return
					}
					err = i.AccountsUpdate(ctx, typedArgs[0].Accounts)
					return
				},
			},
			"pendingPaymentsUpdate": {
				MakeArg: func() interface{} {
					var ret [1]PendingPaymentsUpdateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PendingPaymentsUpdateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PendingPaymentsUpdateArg)(nil), args)
						return
					}
					err = i.PendingPaymentsUpdate(ctx, typedArgs[0])
					return
				},
			},
			"recentPaymentsUpdate": {
				MakeArg: func() interface{} {
					var ret [1]RecentPaymentsUpdateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RecentPaymentsUpdateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RecentPaymentsUpdateArg)(nil), args)
						return
					}
					err = i.RecentPaymentsUpdate(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type NotifyClient struct {
	Cli rpc.GenericClient
}

func (c NotifyClient) PaymentNotification(ctx context.Context, __arg PaymentNotificationArg) (err error) {
	err = c.Cli.Notify(ctx, "stellar.1.notify.paymentNotification", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyClient) PaymentStatusNotification(ctx context.Context, __arg PaymentStatusNotificationArg) (err error) {
	err = c.Cli.Notify(ctx, "stellar.1.notify.paymentStatusNotification", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyClient) RequestStatusNotification(ctx context.Context, reqID KeybaseRequestID) (err error) {
	__arg := RequestStatusNotificationArg{ReqID: reqID}
	err = c.Cli.Notify(ctx, "stellar.1.notify.requestStatusNotification", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyClient) AccountDetailsUpdate(ctx context.Context, __arg AccountDetailsUpdateArg) (err error) {
	err = c.Cli.Notify(ctx, "stellar.1.notify.accountDetailsUpdate", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyClient) AccountsUpdate(ctx context.Context, accounts []WalletAccountLocal) (err error) {
	__arg := AccountsUpdateArg{Accounts: accounts}
	err = c.Cli.Notify(ctx, "stellar.1.notify.accountsUpdate", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyClient) PendingPaymentsUpdate(ctx context.Context, __arg PendingPaymentsUpdateArg) (err error) {
	err = c.Cli.Notify(ctx, "stellar.1.notify.pendingPaymentsUpdate", []interface{}{__arg}, 0*time.Millisecond)
	return
}

func (c NotifyClient) RecentPaymentsUpdate(ctx context.Context, __arg RecentPaymentsUpdateArg) (err error) {
	err = c.Cli.Notify(ctx, "stellar.1.notify.recentPaymentsUpdate", []interface{}{__arg}, 0*time.Millisecond)
	return
}
