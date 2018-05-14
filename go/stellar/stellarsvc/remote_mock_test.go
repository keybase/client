package stellarsvc

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/stellarnet"
	"github.com/stellar/go/amount"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/xdr"

	"github.com/stretchr/testify/require"
)

type txlogger struct {
	transactions []stellar1.PaymentSummary
	sync.Mutex
	T testing.TB
}

func (t *txlogger) Add(tx stellar1.PaymentSummary) {
	t.Lock()
	defer t.Unlock()
	t.transactions = append([]stellar1.PaymentSummary{tx}, t.transactions...)
}

func (t *txlogger) Filter(accountID stellar1.AccountID, limit int) []stellar1.PaymentSummary {
	t.Lock()
	defer t.Unlock()

	var res []stellar1.PaymentSummary
	for _, tx := range t.transactions {
		if limit > 0 && len(res) == limit {
			break
		}

		var addrs []stellar1.AccountID

		typ, err := tx.Typ()
		require.NoError(t.T, err)
		switch typ {
		case stellar1.PaymentSummaryType_STELLAR:
			p := tx.Stellar()
			addrs = append(addrs, []stellar1.AccountID{p.From, p.To}...)
		case stellar1.PaymentSummaryType_DIRECT:
			p := tx.Direct()
			addrs = append(addrs, []stellar1.AccountID{p.FromStellar, p.ToStellar}...)
		case stellar1.PaymentSummaryType_RELAY:
			p := tx.Relay()
			addrs = append(addrs, []stellar1.AccountID{p.FromStellar, p.RelayAccount}...)
			if p.Claim != nil {
				addrs = append(addrs, p.Claim.ToStellar)
			}
		default:
			require.Fail(t.T, "unrecognized variant", "%v", typ)
		}

		var found bool
		for _, acc := range addrs {
			if acc.Eq(accountID) {
				found = true
			}
		}
		if found {
			res = append(res, tx)
		}
	}

	return res
}

func (t *txlogger) Find(txID string) *stellar1.PaymentSummary {
	for _, tx := range t.transactions {

		typ, err := tx.Typ()
		require.NoError(t.T, err)
		switch typ {
		case stellar1.PaymentSummaryType_STELLAR:
			if tx.Stellar().TxID.String() == txID {
				return &tx
			}
		case stellar1.PaymentSummaryType_DIRECT:
			p := tx.Direct()
			if p.TxID.String() == txID || p.KbTxID.String() == txID {
				return &tx
			}
		case stellar1.PaymentSummaryType_RELAY:
			if tx.Relay().TxID.String() == txID || tx.Relay().KbTxID.String() == txID {
				return &tx
			}
		default:
			require.Fail(t.T, "unrecognized variant", "%v", typ)
		}
	}
	return nil
}

var txLog *txlogger

func init() {
	txLog = &txlogger{}
}

type FakeAccount struct {
	accountID stellar1.AccountID
	secretKey stellar1.SecretKey
	balance   stellar1.Balance
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
	t        testing.TB
	seqno    uint64
	accounts map[stellar1.AccountID]*FakeAccount
}

func NewRemoteMock(t testing.TB, g *libkb.GlobalContext) *RemoteMock {
	return &RemoteMock{
		Contextified: libkb.NewContextified(g),
		t:            t,
		seqno:        uint64(time.Now().UnixNano()),
		accounts:     make(map[stellar1.AccountID]*FakeAccount),
	}
}

func (r *RemoteMock) addTransaction(summary stellar1.PaymentSummary) {
	defer r.G().CTraceTimed(context.Background(), "RemoteMock.addTransaction", func() error { return nil })()
	txLog.Add(summary)
}

func (r *RemoteMock) AccountSeqno(ctx context.Context, accountID stellar1.AccountID) (res uint64, err error) {
	defer r.G().CTraceTimed(ctx, "RemoteMock.AccountSeqno", func() error { return err })()
	r.Lock()
	defer r.Unlock()
	res = r.seqno
	r.seqno++
	return res, nil
}

func (r *RemoteMock) Balances(ctx context.Context, accountID stellar1.AccountID) (res []stellar1.Balance, err error) {
	defer r.G().CTraceTimed(ctx, "RemoteMock.Balances", func() error { return err })()
	a, ok := r.accounts[accountID]
	if !ok {
		return nil, libkb.NotFoundError{}
	}
	return []stellar1.Balance{a.balance}, nil
}

func (r *RemoteMock) SubmitPayment(ctx context.Context, post stellar1.PaymentDirectPost) (res stellar1.PaymentResult, err error) {
	defer r.G().CTraceTimed(ctx, "RemoteMock.SubmitPayment", func() error { return err })()
	txd, err := txDetails(post.SignedTransaction)
	if err != nil {
		return stellar1.PaymentResult{}, err
	}
	kbTxID := randomKeybaseTransactionID(r.t)

	a, ok := r.accounts[txd.from]
	if !ok {
		return stellar1.PaymentResult{}, libkb.NotFoundError{Msg: fmt.Sprintf("source account not found: '%v'", txd.from)}
	}

	if !txd.asset.IsNativeXLM() {
		return stellar1.PaymentResult{}, errors.New("can only handle native")
	}

	a.SubtractBalance(txd.amount)
	a.AdjustBalance(-(int64(txd.tx.Fee)))

	b, ok := r.accounts[txd.to]
	if ok {
		// we know about destination as well
		b.AddBalance(txd.amount)
	}

	result := stellar1.PaymentResult{
		StellarID: txd.txID,
		KeybaseID: kbTxID,
	}

	from, err := r.G().GetMeUV(ctx)
	if err != nil {
		return stellar1.PaymentResult{}, fmt.Errorf("could not get self UV: %v", err)
	}
	summary := stellar1.NewPaymentSummaryWithDirect(stellar1.PaymentSummaryDirect{
		KbTxID:          kbTxID,
		TxID:            txd.txID,
		TxStatus:        stellar1.TransactionStatus_SUCCESS,
		FromStellar:     txd.from,
		From:            from,
		FromDeviceID:    post.FromDeviceID,
		ToStellar:       txd.to,
		To:              post.To,
		Amount:          txd.amount,
		Asset:           txd.asset,
		DisplayAmount:   &post.DisplayAmount,
		DisplayCurrency: &post.DisplayCurrency,
		NoteB64:         post.NoteB64,
		Ctime:           stellar1.ToTimeMs(time.Now()),
		Rtime:           stellar1.ToTimeMs(time.Now()),
	})
	r.addTransaction(summary)

	return result, nil
}

func (r *RemoteMock) SubmitRelayPayment(ctx context.Context, post stellar1.PaymentRelayPost) (res stellar1.PaymentResult, err error) {
	defer r.G().CTraceTimed(ctx, "RemoteMock.SubmitRelayPayment", func() error { return err })()
	require.FailNow(r.t, "RemoteMock.SubmitRelayPayment not implemented")
	return res, fmt.Errorf("RemoteMock.SubmitRelayPayment not implemented")
}

func (r *RemoteMock) RecentPayments(ctx context.Context, accountID stellar1.AccountID, limit int) (res []stellar1.PaymentSummary, err error) {
	defer r.G().CTraceTimed(ctx, "RemoteMock.RecentPayments", func() error { return err })()
	return txLog.Filter(accountID, limit), nil
}

func (r *RemoteMock) PaymentDetail(ctx context.Context, txID string) (res stellar1.PaymentSummary, err error) {
	defer r.G().CTraceTimed(ctx, "RemoteMock.PaymentDetail", func() error { return err })()
	p := txLog.Find(txID)
	if p == nil {
		return res, fmt.Errorf("RemoteMock: tx not found: '%v'", txID)
	}
	return *p, nil
}

func (r *RemoteMock) AddAccount(t *testing.T) stellar1.AccountID {
	defer r.G().CTraceTimed(context.Background(), "RemoteMock.AddAccount", func() error { return nil })()
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

func (r *RemoteMock) ImportAccountsForUser(t *testing.T, g *libkb.GlobalContext) {
	defer r.G().CTraceTimed(context.Background(), "RemoteMock.ImportAccountsForUser", func() error { return nil })()
	dump, _, err := remote.Fetch(context.Background(), g)
	require.NoError(t, err)
	for _, account := range dump.Accounts {
		if _, found := r.accounts[account.AccountID]; found {
			continue
		}
		a := &FakeAccount{
			accountID: stellar1.AccountID(account.AccountID),
			secretKey: stellar1.SecretKey(account.Signers[0]),
			balance: stellar1.Balance{
				Asset:  stellar1.Asset{Type: "native"},
				Amount: "0",
			},
		}
		r.accounts[a.accountID] = a
	}
}

func (r *RemoteMock) SecretKey(t *testing.T, accountID stellar1.AccountID) stellar1.SecretKey {
	defer r.G().CTraceTimed(context.Background(), "RemoteMock.SecretKey", func() error { return nil })()
	a, ok := r.accounts[accountID]
	if !ok {
		t.Fatalf("SecretKey: account id %s not in remote mock", accountID)
	}
	return a.secretKey
}

type txDetailsT struct {
	tx     xdr.Transaction
	txID   stellar1.TransactionID
	from   stellar1.AccountID
	to     stellar1.AccountID
	amount string
	asset  stellar1.Asset
}

func txDetails(txEnvelopeB64 string) (res txDetailsT, err error) {
	var tx xdr.TransactionEnvelope
	err = xdr.SafeUnmarshalBase64(txEnvelopeB64, &tx)
	if err != nil {
		return res, fmt.Errorf("decoding tx: %v", err)
	}
	res.tx = tx.Tx
	txID, err := stellarnet.HashTx(tx.Tx)
	if err != nil {
		return res, fmt.Errorf("error hashing tx: %v", err)
	}
	res.txID = stellar1.TransactionID(txID)
	res.from = stellar1.AccountID(tx.Tx.SourceAccount.Address())
	if len(tx.Tx.Operations) != 1 {
		return res, fmt.Errorf("unexpected number of operations in tx %v != 1", len(tx.Tx.Operations))
	}
	if tx.Tx.Operations[0].SourceAccount != nil {
		// operation overrides tx source field
		res.from = stellar1.AccountID(tx.Tx.Operations[0].SourceAccount.Address())
	}
	op := tx.Tx.Operations[0].Body
	if op, ok := op.GetPaymentOp(); ok {
		res.amount, res.asset, err = balanceXdrToProto(op.Amount, op.Asset)
		res.to = stellar1.AccountID(op.Destination.Address())
		return res, err
	}
	if op, ok := op.GetCreateAccountOp(); ok {
		res.amount = amount.String(op.StartingBalance)
		res.asset = stellar1.AssetNative()
		res.to = stellar1.AccountID(op.Destination.Address())
		return res, nil
	}
	return res, fmt.Errorf("unexpected op type: %v", op.Type)
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

func randomKeybaseTransactionID(t testing.TB) stellar1.KeybaseTransactionID {
	b, err := libkb.RandBytesWithSuffix(stellar1.KeybaseTransactionIDLen, stellar1.KeybaseTransactionIDSuffix)
	require.NoError(t, err)
	res, err := stellar1.KeybaseTransactionIDFromString(hex.EncodeToString(b))
	require.NoError(t, err)
	return res
}
