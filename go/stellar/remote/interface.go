package remote

import (
	"context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
)

type Remoter interface {
	AccountSeqno(ctx context.Context, accountID stellar1.AccountID) (uint64, error)
	Balances(ctx context.Context, accountID stellar1.AccountID) ([]stellar1.Balance, error)
	SubmitTransaction(ctx context.Context, payload libkb.JSONPayload) (stellar1.PaymentResult, error)
	RecentPayments(ctx context.Context, accountID stellar1.AccountID, limit int) (res []stellar1.PaymentSummary, err error)
}
