package client

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/context"
)

type walletNotificationDisplay struct {
	*baseNotificationDisplay
	cli stellar1.LocalClient
}

func newWalletNotificationDisplay(g *libkb.GlobalContext) *walletNotificationDisplay {
	cli, err := GetWalletClient(g)
	if err != nil {
		panic(err.Error())
	}
	return &walletNotificationDisplay{
		baseNotificationDisplay: newBaseNotificationDisplay(g),
		cli: cli,
	}
}

func (d *walletNotificationDisplay) displayPaymentDetails(ctx context.Context, accountID stellar1.AccountID, paymentID stellar1.PaymentID) error {
	details, err := d.cli.GetPaymentDetailsLocal(ctx, stellar1.GetPaymentDetailsLocalArg{
		AccountID: &accountID,
		Id:        paymentID,
	})
	if err != nil {
		return err
	}
	d.printJSON(details)
	return nil
}

func (d *walletNotificationDisplay) PaymentNotification(ctx context.Context, arg stellar1.PaymentNotificationArg) error {
	return d.displayPaymentDetails(ctx, arg.AccountID, arg.PaymentID)
}

func (d *walletNotificationDisplay) PaymentStatusNotification(ctx context.Context, arg stellar1.PaymentStatusNotificationArg) error {
	return d.displayPaymentDetails(ctx, arg.AccountID, arg.PaymentID)
}

func (d *walletNotificationDisplay) RequestStatusNotification(ctx context.Context, reqID stellar1.KeybaseRequestID) error {
	details, err := d.cli.GetRequestDetailsLocal(ctx, stellar1.GetRequestDetailsLocalArg{
		ReqID: reqID,
	})
	if err != nil {
		return err
	}
	d.printJSON(details)
	return nil
}

func (d *walletNotificationDisplay) AccountDetailsUpdate(ctx context.Context, arg stellar1.AccountDetailsUpdateArg) error {
	return nil
}

func (d *walletNotificationDisplay) PendingPaymentsUpdate(ctx context.Context, arg stellar1.PendingPaymentsUpdateArg) error {
	return nil
}

func (d *walletNotificationDisplay) RecentPaymentsUpdate(ctx context.Context, arg stellar1.RecentPaymentsUpdateArg) error {
	return nil
}
