package stellarsvc

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/stellar/go/amount"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/xdr"
)

type FakeAccount struct {
	accountID    stellar1.AccountID
	secretKey    stellar1.SecretKey
	balance      stellar1.Balance
	transactions []stellar1.PaymentPost
}

func (a *FakeAccount) AddBalance(amt string) error {
	n, err := amount.ParseInt64(amt)
	if err != nil {
		return err
	}
	return a.AdjustBalance(n)
}

func (a *FakeAccount) SubtractBalance(amt string) error {
	n, err := amount.ParseInt64(amt)
	if err != nil {
		return err
	}
	return a.AdjustBalance(-n)
}

func (a *FakeAccount) AdjustBalance(amt int64) error {
	b, err := amount.ParseInt64(a.balance.Amount)
	if err != nil {
		return err
	}
	b += amt
	a.balance.Amount = amount.StringFromInt64(b)
	return nil
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
	payment, ok := payload["payment"]
	if !ok {
		return stellar1.PaymentResult{}, errors.New("missing 'payment' in payload")
	}
	post, ok := payment.(stellar1.PaymentPost)
	if !ok {
		return stellar1.PaymentResult{}, fmt.Errorf("invalid payment type: %T", post)
	}

	tx, amount, asset, err := txDetails(post.SignedTransaction)
	if err != nil {
		return stellar1.PaymentResult{}, err
	}

	a, ok := r.accounts[stellar1.AccountID(tx.SourceAccount.Address())]
	if !ok {
		return stellar1.PaymentResult{}, libkb.NotFoundError{Msg: "source account not found"}
	}

	a.transactions = append(a.transactions, post)

	if asset.Type != "native" {
		return stellar1.PaymentResult{}, errors.New("can only handle native")
	}

	a.SubtractBalance(amount)
	a.AdjustBalance(-(int64(tx.Fee)))

	destination, err := txOpDestination(tx)
	if err != nil {
		return stellar1.PaymentResult{}, err
	}
	b, ok := r.accounts[destination]
	if ok {
		// we know about destination as well
		b.AddBalance(amount)
		b.transactions = append(b.transactions, post)
	}

	result := stellar1.PaymentResult{
		StellarID: "",
		KeybaseID: "",
		Ledger:    1000,
	}

	return result, nil
}

func (r *RemoteMock) RecentPayments(ctx context.Context, accountID stellar1.AccountID, limit int) (res []stellar1.PaymentSummary, err error) {
	return nil, errors.New("RecentPayments hasn't been implemented in the RemoteMock yet")
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

func (r *RemoteMock) SecretKey(t *testing.T, accountID stellar1.AccountID) stellar1.SecretKey {
	a, ok := r.accounts[accountID]
	if !ok {
		t.Fatalf("SecretKey: account id %s not in remote mock", accountID)
	}
	return a.secretKey
}

func txDetails(txEnvelopeB64 string) (txInner xdr.Transaction, amt string, asset stellar1.Asset, err error) {
	var tx xdr.TransactionEnvelope
	err = xdr.SafeUnmarshalBase64(txEnvelopeB64, &tx)
	if err != nil {
		return txInner, amt, asset, fmt.Errorf("decoding tx: %v", err)
	}
	if len(tx.Tx.Operations) != 1 {
		return txInner, amt, asset, fmt.Errorf("unexpected number of operations in tx %v != 1", len(tx.Tx.Operations))
	}
	op := tx.Tx.Operations[0].Body
	if op, ok := op.GetPaymentOp(); ok {
		amt, asset, err = balanceXdrToProto(op.Amount, op.Asset)
		return tx.Tx, amt, asset, err
	}
	if op, ok := op.GetCreateAccountOp(); ok {
		amt = amount.String(op.StartingBalance)
		asset = stellar1.AssetNative()
		return tx.Tx, amt, asset, nil
	}
	return txInner, amt, asset, fmt.Errorf("unexpected op type: %v", op.Type)
}

func txOpDestination(tx xdr.Transaction) (stellar1.AccountID, error) {
	op := tx.Operations[0].Body
	if op, ok := op.GetPaymentOp(); ok {
		return stellar1.AccountID(op.Destination.Address()), nil
	}
	if op, ok := op.GetCreateAccountOp(); ok {
		return stellar1.AccountID(op.Destination.Address()), nil
	}

	return "", errors.New("invalid op")
}

// TODO: copied from stellard/server.go, extract to common package
//
func balanceXdrToProto(amountXdr xdr.Int64, assetXdr xdr.Asset) (amt string, asset stellar1.Asset, err error) {
	unpad := func(in []byte) (out string) {
		return strings.TrimRight(string(in), string([]byte{0}))
	}
	amt = amount.String(amountXdr)
	switch assetXdr.Type {
	case xdr.AssetTypeAssetTypeNative:
		return amt, stellar1.AssetNative(), nil
	case xdr.AssetTypeAssetTypeCreditAlphanum4:
		if assetXdr.AlphaNum4 == nil {
			return amt, asset, fmt.Errorf("missing alphanum4")
		}
		return amt, stellar1.Asset{
			Type:   "credit_alphanum4",
			Code:   unpad(assetXdr.AlphaNum4.AssetCode[:]),
			Issuer: assetXdr.AlphaNum4.Issuer.Address(),
		}, nil
	case xdr.AssetTypeAssetTypeCreditAlphanum12:
		if assetXdr.AlphaNum12 == nil {
			return amt, asset, fmt.Errorf("missing alphanum12")
		}
		return amt, stellar1.Asset{
			Type:   "credit_alphanum12",
			Code:   unpad(assetXdr.AlphaNum12.AssetCode[:]),
			Issuer: assetXdr.AlphaNum12.Issuer.Address(),
		}, nil
	default:
		return amt, asset, fmt.Errorf("unsupported asset type: %v", assetXdr.Type)
	}
}
