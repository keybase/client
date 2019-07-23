package client

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/context"
)

const (
	notifTypeWallet     = "wallet"
	sourcePayment       = "payment"
	sourcePaymentStatus = "payment_status"
	sourceRequest       = "request"
)

type walletNotification struct {
	// wallet
	Type string `json:"type"`
	// payment, request, etc
	Source       string      `json:"source"`
	Notification interface{} `json:"notification,omitempty"`
	Error        *string     `json:"error,omitempty"`
}

func newWalletNotification(source string) *walletNotification {
	return &walletNotification{
		Source:       source,
		Type:         notifTypeWallet,
		Notification: nil,
	}
}

type walletNotificationDisplay struct {
	*baseNotificationDisplay
	cli     stellar1.LocalClient
	deduper map[string]bool
	useV1   bool
}

func newWalletNotificationDisplay(g *libkb.GlobalContext, useV1 bool) *walletNotificationDisplay {
	cli, err := GetWalletClient(g)
	if err != nil {
		panic(err.Error())
	}
	return &walletNotificationDisplay{
		baseNotificationDisplay: newBaseNotificationDisplay(g),
		cli:                     cli,
		deduper:                 make(map[string]bool),
		useV1:                   useV1,
	}
}

func deduperCLIKey(details stellar1.PaymentCLILocal) string {
	return fmt.Sprintf("%s:%s", details.TxID, details.Status)
}

func deduperFrontendKey(details stellar1.PaymentDetailsLocal) string {
	return fmt.Sprintf("%s:%s", details.Summary.TxID, details.Summary.StatusSimplified)
}

func (d *walletNotificationDisplay) displayPaymentDetails(ctx context.Context, source string,
	accountID stellar1.AccountID, paymentID stellar1.PaymentID) error {
	notif := newWalletNotification(source)

	if d.useV1 {
		details, err := d.cli.GetPaymentDetailsLocal(ctx, stellar1.GetPaymentDetailsLocalArg{
			AccountID: accountID,
			Id:        paymentID,
		})
		if err != nil {
			errStr := err.Error()
			notif.Error = &errStr
			d.printJSON(notif)
			return nil
		}
		if _, dupeMsg := d.deduper[deduperFrontendKey(details)]; dupeMsg {
			return nil
		}
		d.deduper[deduperFrontendKey(details)] = true
		notif.Notification = details
	} else {
		details, err := d.cli.PaymentDetailCLILocal(ctx, paymentID.String())
		if err != nil {
			errStr := err.Error()
			notif.Error = &errStr
			d.printJSON(notif)
			return nil
		}
		if _, dupeMsg := d.deduper[deduperCLIKey(details)]; dupeMsg {
			return nil
		}
		d.deduper[deduperCLIKey(details)] = true
		notif.Notification = details
	}

	d.printJSON(notif)
	return nil
}

func (d *walletNotificationDisplay) PaymentNotification(ctx context.Context, arg stellar1.PaymentNotificationArg) error {
	return d.displayPaymentDetails(ctx, sourcePayment, arg.AccountID, arg.PaymentID)
}

func (d *walletNotificationDisplay) PaymentStatusNotification(ctx context.Context, arg stellar1.PaymentStatusNotificationArg) error {
	return d.displayPaymentDetails(ctx, sourcePaymentStatus, arg.AccountID, arg.PaymentID)
}

func (d *walletNotificationDisplay) RequestStatusNotification(ctx context.Context, reqID stellar1.KeybaseRequestID) error {
	notif := newWalletNotification(sourceRequest)
	if details, err := d.cli.GetRequestDetailsLocal(ctx, stellar1.GetRequestDetailsLocalArg{
		ReqID: reqID,
	}); err != nil {
		errStr := err.Error()
		notif.Error = &errStr
	} else {
		notif.Notification = details
	}
	d.printJSON(notif)
	return nil
}

func (d *walletNotificationDisplay) AccountDetailsUpdate(ctx context.Context, arg stellar1.AccountDetailsUpdateArg) error {
	return nil
}

func (d *walletNotificationDisplay) AccountsUpdate(ctx context.Context, accounts []stellar1.WalletAccountLocal) error {
	return nil
}

func (d *walletNotificationDisplay) PendingPaymentsUpdate(ctx context.Context, arg stellar1.PendingPaymentsUpdateArg) error {
	return nil
}

func (d *walletNotificationDisplay) RecentPaymentsUpdate(ctx context.Context, arg stellar1.RecentPaymentsUpdateArg) error {
	return nil
}
