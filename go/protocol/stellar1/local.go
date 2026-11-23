// Code generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler). DO NOT EDIT.
//   Input file: avdl/stellar1/local.avdl

package stellar1

import (
	"context"
	"fmt"
	"time"

	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type BalanceDelta int

const (
	BalanceDelta_NONE     BalanceDelta = 0
	BalanceDelta_INCREASE BalanceDelta = 1
	BalanceDelta_DECREASE BalanceDelta = 2
)

func (o BalanceDelta) DeepCopy() BalanceDelta { return o }

var BalanceDeltaMap = map[string]BalanceDelta{
	"NONE":     0,
	"INCREASE": 1,
	"DECREASE": 2,
}

var BalanceDeltaRevMap = map[BalanceDelta]string{
	0: "NONE",
	1: "INCREASE",
	2: "DECREASE",
}

func (o BalanceDelta) String() string {
	if v, ok := BalanceDeltaRevMap[o]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(o))
}

type PaymentStatus int

const (
	PaymentStatus_NONE      PaymentStatus = 0
	PaymentStatus_PENDING   PaymentStatus = 1
	PaymentStatus_CLAIMABLE PaymentStatus = 2
	PaymentStatus_COMPLETED PaymentStatus = 3
	PaymentStatus_ERROR     PaymentStatus = 4
	PaymentStatus_UNKNOWN   PaymentStatus = 5
)

func (o PaymentStatus) DeepCopy() PaymentStatus { return o }

var PaymentStatusMap = map[string]PaymentStatus{
	"NONE":      0,
	"PENDING":   1,
	"CLAIMABLE": 2,
	"COMPLETED": 3,
	"ERROR":     4,
	"UNKNOWN":   5,
}

var PaymentStatusRevMap = map[PaymentStatus]string{
	0: "NONE",
	1: "PENDING",
	2: "CLAIMABLE",
	3: "COMPLETED",
	4: "ERROR",
	5: "UNKNOWN",
}

func (o PaymentStatus) String() string {
	if v, ok := PaymentStatusRevMap[o]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(o))
}

type CurrencyLocal struct {
	Description string              `codec:"description" json:"description"`
	Code        OutsideCurrencyCode `codec:"code" json:"code"`
	Symbol      string              `codec:"symbol" json:"symbol"`
	Name        string              `codec:"name" json:"name"`
}

func (o CurrencyLocal) DeepCopy() CurrencyLocal {
	return CurrencyLocal{
		Description: o.Description,
		Code:        o.Code.DeepCopy(),
		Symbol:      o.Symbol,
		Name:        o.Name,
	}
}

type WalletAccountLocal struct {
	AccountID           AccountID     `codec:"accountID" json:"accountID"`
	IsDefault           bool          `codec:"isDefault" json:"isDefault"`
	Name                string        `codec:"name" json:"name"`
	BalanceDescription  string        `codec:"balanceDescription" json:"balanceDescription"`
	Seqno               string        `codec:"seqno" json:"seqno"`
	CurrencyLocal       CurrencyLocal `codec:"currencyLocal" json:"currencyLocal"`
	AccountMode         AccountMode   `codec:"accountMode" json:"accountMode"`
	AccountModeEditable bool          `codec:"accountModeEditable" json:"accountModeEditable"`
	DeviceReadOnly      bool          `codec:"deviceReadOnly" json:"deviceReadOnly"`
	IsFunded            bool          `codec:"isFunded" json:"isFunded"`
	CanSubmitTx         bool          `codec:"canSubmitTx" json:"canSubmitTx"`
	CanAddTrustline     bool          `codec:"canAddTrustline" json:"canAddTrustline"`
}

func (o WalletAccountLocal) DeepCopy() WalletAccountLocal {
	return WalletAccountLocal{
		AccountID:           o.AccountID.DeepCopy(),
		IsDefault:           o.IsDefault,
		Name:                o.Name,
		BalanceDescription:  o.BalanceDescription,
		Seqno:               o.Seqno,
		CurrencyLocal:       o.CurrencyLocal.DeepCopy(),
		AccountMode:         o.AccountMode.DeepCopy(),
		AccountModeEditable: o.AccountModeEditable,
		DeviceReadOnly:      o.DeviceReadOnly,
		IsFunded:            o.IsFunded,
		CanSubmitTx:         o.CanSubmitTx,
		CanAddTrustline:     o.CanAddTrustline,
	}
}

type GetWalletAccountsLocalArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type DeleteWalletAccountLocalArg struct {
	SessionID        int       `codec:"sessionID" json:"sessionID"`
	AccountID        AccountID `codec:"accountID" json:"accountID"`
	UserAcknowledged string    `codec:"userAcknowledged" json:"userAcknowledged"`
}

type HasAcceptedDisclaimerLocalArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type GetWalletAccountSecretKeyLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	AccountID AccountID `codec:"accountID" json:"accountID"`
}

type ExportSecretKeyLocalArg struct {
	AccountID AccountID `codec:"accountID" json:"accountID"`
}

type LocalInterface interface {
	GetWalletAccountsLocal(context.Context, int) ([]WalletAccountLocal, error)
	DeleteWalletAccountLocal(context.Context, DeleteWalletAccountLocalArg) error
	HasAcceptedDisclaimerLocal(context.Context, int) (bool, error)
	GetWalletAccountSecretKeyLocal(context.Context, GetWalletAccountSecretKeyLocalArg) (SecretKey, error)
	ExportSecretKeyLocal(context.Context, AccountID) (SecretKey, error)
}

func LocalProtocol(i LocalInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "stellar.1.local",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getWalletAccountsLocal": {
				MakeArg: func() any {
					var ret [1]GetWalletAccountsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					typedArgs, ok := args.(*[1]GetWalletAccountsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetWalletAccountsLocalArg)(nil), args)
						return
					}
					ret, err = i.GetWalletAccountsLocal(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"deleteWalletAccountLocal": {
				MakeArg: func() any {
					var ret [1]DeleteWalletAccountLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					typedArgs, ok := args.(*[1]DeleteWalletAccountLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DeleteWalletAccountLocalArg)(nil), args)
						return
					}
					err = i.DeleteWalletAccountLocal(ctx, typedArgs[0])
					return
				},
			},
			"hasAcceptedDisclaimerLocal": {
				MakeArg: func() any {
					var ret [1]HasAcceptedDisclaimerLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					typedArgs, ok := args.(*[1]HasAcceptedDisclaimerLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]HasAcceptedDisclaimerLocalArg)(nil), args)
						return
					}
					ret, err = i.HasAcceptedDisclaimerLocal(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"getWalletAccountSecretKeyLocal": {
				MakeArg: func() any {
					var ret [1]GetWalletAccountSecretKeyLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					typedArgs, ok := args.(*[1]GetWalletAccountSecretKeyLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetWalletAccountSecretKeyLocalArg)(nil), args)
						return
					}
					ret, err = i.GetWalletAccountSecretKeyLocal(ctx, typedArgs[0])
					return
				},
			},
			"exportSecretKeyLocal": {
				MakeArg: func() any {
					var ret [1]ExportSecretKeyLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args any) (ret any, err error) {
					typedArgs, ok := args.(*[1]ExportSecretKeyLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ExportSecretKeyLocalArg)(nil), args)
						return
					}
					ret, err = i.ExportSecretKeyLocal(ctx, typedArgs[0].AccountID)
					return
				},
			},
		},
	}
}

type LocalClient struct {
	Cli rpc.GenericClient
}

func (c LocalClient) GetWalletAccountsLocal(ctx context.Context, sessionID int) (res []WalletAccountLocal, err error) {
	__arg := GetWalletAccountsLocalArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "stellar.1.local.getWalletAccountsLocal", []any{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) DeleteWalletAccountLocal(ctx context.Context, __arg DeleteWalletAccountLocalArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.deleteWalletAccountLocal", []any{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) HasAcceptedDisclaimerLocal(ctx context.Context, sessionID int) (res bool, err error) {
	__arg := HasAcceptedDisclaimerLocalArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "stellar.1.local.hasAcceptedDisclaimerLocal", []any{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetWalletAccountSecretKeyLocal(ctx context.Context, __arg GetWalletAccountSecretKeyLocalArg) (res SecretKey, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.getWalletAccountSecretKeyLocal", []any{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) ExportSecretKeyLocal(ctx context.Context, accountID AccountID) (res SecretKey, err error) {
	__arg := ExportSecretKeyLocalArg{AccountID: accountID}
	err = c.Cli.Call(ctx, "stellar.1.local.exportSecretKeyLocal", []any{__arg}, &res, 0*time.Millisecond)
	return
}
