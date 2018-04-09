package remote

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/stellar/go/keypair"
)

type FakeAccount struct {
	accountID stellar1.AccountID
	secretKey stellar1.SecretKey
	balance   stellar1.Balance
}

type RemoteMock struct {
	sync.Mutex
	libkb.Contextified
	seqno    uint64
	accounts map[stellar1.AccountID]*FakeAccount
}

func NewRemoteMock(g *libkb.GlobalContext) *RemoteMock {
	return &RemoteMock{
		Contextified: libkb.NewContextified(g),
		seqno:        uint64(time.Now().UnixNano()),
		accounts:     make(map[stellar1.AccountID]*FakeAccount),
	}
}

func (r *RemoteMock) AccountSeqno(ctx context.Context, accountID stellar1.AccountID) (uint64, error) {
	r.Lock()
	defer r.Unlock()

	n := r.seqno
	r.seqno++

	return n, nil
}

func (r *RemoteMock) Balances(ctx context.Context, accountID stellar1.AccountID) ([]stellar1.Balance, error) {
	a, ok := r.accounts[accountID]
	if !ok {
		return nil, libkb.NotFoundError{}
	}
	return []stellar1.Balance{a.balance}, nil
}

func (r *RemoteMock) SubmitTransaction(ctx context.Context, payload libkb.JSONPayload) (stellar1.PaymentResult, error) {
	return SubmitTransaction(ctx, r.G(), payload)
}

func (r *RemoteMock) RecentPayments(ctx context.Context, accountID stellar1.AccountID, limit int) (res []stellar1.PaymentSummary, err error) {
	return RecentPayments(ctx, r.G(), accountID, limit)
}

func (r *RemoteMock) AddAccount(t *testing.T) stellar1.AccountID {
	full, err := keypair.Random()
	if err != nil {
		t.Fatal(err)
	}
	a := &FakeAccount{
		accountID: stellar1.AccountID(full.Address()),
		secretKey: stellar1.SecretKey(full.Seed()),
		balance: stellar1.Balance{
			Asset:  stellar1.Asset{Type: "native"},
			Amount: "10000",
		},
	}
	r.accounts[a.accountID] = a

	return a.accountID
}
