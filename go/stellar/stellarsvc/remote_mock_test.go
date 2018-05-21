package stellarsvc

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/stellarnet"
	stellaramount "github.com/stellar/go/amount"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/xdr"

	"github.com/stretchr/testify/require"
)

type txlogger struct {
	transactions []stellar1.PaymentSummary
	sync.Mutex
	T testing.TB
}

func newTxLogger(t testing.TB) *txlogger { return &txlogger{T: t} }

func (t *txlogger) Add(tx stellar1.PaymentSummary) {
	t.Lock()
	defer t.Unlock()
	t.transactions = append([]stellar1.PaymentSummary{tx}, t.transactions...)
}

func (t *txlogger) AddClaim(kbTxID stellar1.KeybaseTransactionID, c stellar1.ClaimSummary) {
	t.Lock()
	defer t.Unlock()
	for i := range t.transactions {
		p := &t.transactions[i]
		typ, err := p.Typ()
		require.NoError(t.T, err)
		if typ != stellar1.PaymentSummaryType_RELAY {
			continue
		}
		if !p.Relay().KbTxID.Eq(kbTxID) {
			continue
		}
		p.Relay__.Claim = &c
		return
	}
	require.Fail(t.T, "should find relay to attach claim to", "%v", kbTxID)
}

// Filter by accountID
// But: Unclaimed relays not from the caller are effectively associated with the caller's primary account.
func (t *txlogger) Filter(ctx context.Context, tc *TestContext, accountID stellar1.AccountID, limit int) []stellar1.PaymentSummary {
	t.Lock()
	defer t.Unlock()

	// load the caller to get their primary account
	callerAccountID := stellar1.AccountID("")
	meUID := tc.G.ActiveDevice.UID()
	require.False(t.T, meUID.IsNil())
	loadMeArg := libkb.NewLoadUserArgWithContext(ctx, tc.G).
		WithUID(meUID).
		WithSelf(true).
		WithNetContext(ctx)
	user, err := libkb.LoadUser(loadMeArg)
	require.NoError(t.T, err)
	myAccountID := user.StellarWalletAddress()
	if myAccountID != nil {
		callerAccountID = *myAccountID
	}
	caller := user.ToUserVersion()

	var res []stellar1.PaymentSummary
	for _, tx := range t.transactions {
		if limit > 0 && len(res) == limit {
			break
		}

		typ, err := tx.Typ()
		require.NoError(t.T, err)
		switch typ {
		case stellar1.PaymentSummaryType_STELLAR:
			p := tx.Stellar()
			for _, acc := range []stellar1.AccountID{p.From, p.To} {
				if acc.Eq(accountID) {
					res = append(res, tx)
					continue
				}
			}
		case stellar1.PaymentSummaryType_DIRECT:
			p := tx.Direct()
			for _, acc := range []stellar1.AccountID{p.FromStellar, p.ToStellar} {
				if acc.Eq(accountID) {
					res = append(res, tx)
					continue
				}
			}
		case stellar1.PaymentSummaryType_RELAY:
			p := tx.Relay()

			// Caller must be a member of the impteam.
			if !t.isCallerInImplicitTeam(tc, p.TeamID) {
				t.T.Logf("filtered out relay (team membership): %v", p.KbTxID)
				continue
			}

			filterByAccount := func(r *stellar1.PaymentSummaryRelay, accountID stellar1.AccountID) bool {
				if accountID.IsNil() {
					return true
				}
				if r.FromStellar.Eq(accountID) {
					return true
				}
				var successfullyClaimed bool
				if r.Claim != nil {
					if r.Claim.ToStellar.Eq(accountID) {
						return true
					}
					if r.Claim.TxStatus == stellar1.TransactionStatus_SUCCESS {
						successfullyClaimed = true
					}
				}
				// Unclaimed relays not from the caller are effectively associated with the caller's primary account.
				if !successfullyClaimed && !r.From.Eq(caller) && !callerAccountID.IsNil() && accountID.Eq(callerAccountID) {
					return true
				}
				return false
			}

			if !filterByAccount(&p, accountID) {
				t.T.Logf("filtered out relay (account filter): %v queryAccountID:%v callerAccountID:%v",
					p.KbTxID, accountID, callerAccountID)
				continue
			}
			res = append(res, tx)
		default:
			require.Fail(t.T, "unrecognized variant", "%v", typ)
		}
	}
	return res
}

// Check whether the caller is in the implicit team.
// By loading the team.
func (t *txlogger) isCallerInImplicitTeam(tc *TestContext, teamID keybase1.TeamID) bool {
	team, err := tc.G.GetTeamLoader().Load(context.Background(), keybase1.LoadTeamArg{
		ID:      teamID,
		StaleOK: true,
	})
	if err != nil && err.Error() == "You are not a member of this team (error 2623)" {
		t.T.Logf("caller %v not in team %v", tc.Fu.User.ToUserVersion(), teamID)
		return false
	}
	require.NoError(t.T, err, "Could not load team. And error not recognized as non-membership, assumed to be malfunction.")
	return team.Chain.Implicit
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

type FakeAccount struct {
	T          testing.TB
	accountID  stellar1.AccountID
	secretKey  stellar1.SecretKey // can be missing for relay accounts
	balance    stellar1.Balance
	subentries int
	t          *testing.T
}

func (a *FakeAccount) AddBalance(amt string) {
	n, err := stellaramount.ParseInt64(amt)
	require.NoError(a.T, err)
	a.AdjustBalance(n)
}

func (a *FakeAccount) SubtractBalance(amt string) {
	n, err := stellaramount.ParseInt64(amt)
	require.NoError(a.T, err)
	a.AdjustBalance(-n)
}

func (a *FakeAccount) ZeroBalance() int64 {
	res, err := stellaramount.ParseInt64(a.balance.Amount)
	require.NoError(a.T, err)
	a.balance.Amount = "0"
	return res
}

func (a *FakeAccount) AdjustBalance(amt int64) {
	b, err := stellaramount.ParseInt64(a.balance.Amount)
	require.NoError(a.T, err)
	b += amt
	a.balance.Amount = stellaramount.StringFromInt64(b)
	if b < 0 {
		require.Fail(a.T, "account balance went negative", "%v %v", a.accountID, a.balance.Amount)
	}
	a.Check()
}

func (a *FakeAccount) IsFunded() bool {
	return a.Check()
}

// Check that the account balance makes sense.
// Returns whether the account is funded.
func (a *FakeAccount) Check() bool {
	b, err := stellaramount.ParseInt64(a.balance.Amount)
	require.NoError(a.T, err)
	minimumReserve := stellaramount.MustParse("1.0")
	switch {
	case b == 0:
		return false
	case b < 0:
		require.Fail(a.T, "account has negative balance", "%v", a.accountID)
	case b < int64(minimumReserve):
		require.Fail(a.T, "account has less than the minimum blaance balance", "%v < %v %v",
			stellaramount.StringFromInt64(b), stellaramount.String(minimumReserve), a.accountID)
	default:
		return true
	}
	if b == 0 {
		return false
	}
	return true
}

func (a *FakeAccount) availableBalance() (string, error) {
	b, err := stellarnet.AvailableBalance(a.balance.Amount, a.subentries)
	if err != nil {
		a.t.Fatalf("AvailableBalance error: %s", err)
	}
	return b
}

// RemoteClientMock is a Remoter that calls into a BackendMock.
// It basically proxies all calls but passes the caller's TC so the backend knows who's calling.
// Threadsafe.
type RemoteClientMock struct {
	libkb.Contextified
	Tc      *TestContext
	Backend *BackendMock
}

func NewRemoteClientMock(tc *TestContext, bem *BackendMock) *RemoteClientMock {
	return &RemoteClientMock{
		Contextified: libkb.NewContextified(tc.G),
		Tc:           tc,
		Backend:      bem,
	}
}

func (r *RemoteClientMock) AccountSeqno(ctx context.Context, accountID stellar1.AccountID) (uint64, error) {
	return r.Backend.AccountSeqno(ctx, accountID)
}

func (r *RemoteClientMock) Balances(ctx context.Context, accountID stellar1.AccountID) ([]stellar1.Balance, error) {
	return r.Backend.Balances(ctx, accountID)
}

func (r *RemoteClientMock) SubmitPayment(ctx context.Context, post stellar1.PaymentDirectPost) (stellar1.PaymentResult, error) {
	return r.Backend.SubmitPayment(ctx, r.Tc, post)
}

func (r *RemoteClientMock) SubmitRelayPayment(ctx context.Context, post stellar1.PaymentRelayPost) (stellar1.PaymentResult, error) {
	return r.Backend.SubmitRelayPayment(ctx, r.Tc, post)
}

func (r *RemoteClientMock) SubmitRelayClaim(ctx context.Context, post stellar1.RelayClaimPost) (stellar1.RelayClaimResult, error) {
	return r.Backend.SubmitRelayClaim(ctx, r.Tc, post)
}

func (r *RemoteClientMock) RecentPayments(ctx context.Context, accountID stellar1.AccountID, limit int) (res []stellar1.PaymentSummary, err error) {
	return r.Backend.RecentPayments(ctx, r.Tc, accountID, limit)
}

func (r *RemoteClientMock) PaymentDetail(ctx context.Context, txID string) (res stellar1.PaymentSummary, err error) {
	return r.Backend.PaymentDetail(ctx, r.Tc, txID)
}

var _ remote.Remoter = (*RemoteClientMock)(nil)

// BackendMock is a mock of stellard.
// Stores the data and services RemoteClientMock's calls.
// Threadsafe.
type BackendMock struct {
	sync.Mutex
	T        testing.TB
	seqnos   map[stellar1.AccountID]uint64
	accounts map[stellar1.AccountID]*FakeAccount
	txLog    *txlogger
}

func NewBackendMock(t testing.TB) *BackendMock {
	return &BackendMock{
		T:        t,
		seqnos:   make(map[stellar1.AccountID]uint64),
		accounts: make(map[stellar1.AccountID]*FakeAccount),
		txLog:    newTxLogger(t),
	}
}

func (r *BackendMock) trace(err *error, name string, format string, args ...interface{}) func() {
	r.T.Logf("+ %s%s", name, fmt.Sprintf(format, args...))
	return func() {
		errStr := "?"
		if err != nil {
			if *err == nil {
				errStr = "ok"
			} else {
				errStr = "ERROR: " + (*err).Error()
			}
		}
		r.T.Logf("- %s => %s", name, errStr)
	}
}

func (r *BackendMock) addPayment(summary stellar1.PaymentSummary) {
	defer r.trace(nil, "BackendMock.addPayment", "")()
	r.txLog.Add(summary)
}

func (r *BackendMock) addClaim(kbTxID stellar1.KeybaseTransactionID, summary stellar1.ClaimSummary) {
	defer r.trace(nil, "BackendMock.addClaim", "")()
	r.txLog.AddClaim(kbTxID, summary)
}

func (r *BackendMock) AccountSeqno(ctx context.Context, accountID stellar1.AccountID) (res uint64, err error) {
	defer r.trace(&err, "BackendMock.AccountSeqno", "%v", accountID)()
	r.Lock()
	defer r.Unlock()
	_, ok := r.seqnos[accountID]
	if !ok {
		r.seqnos[accountID] = uint64(time.Now().UnixNano())
	}
	r.seqnos[accountID]++
	return r.seqnos[accountID], nil
}

func (r *BackendMock) Balances(ctx context.Context, accountID stellar1.AccountID) (res []stellar1.Balance, err error) {
	defer r.trace(&err, "BackendMock.Balances", "%v", accountID)()
	r.Lock()
	defer r.Unlock()
	a, ok := r.accounts[accountID]
	if !ok {
		return nil, libkb.NotFoundError{}
	}
	return []stellar1.Balance{a.balance}, nil
}

func (r *BackendMock) SubmitPayment(ctx context.Context, tc *TestContext, post stellar1.PaymentDirectPost) (res stellar1.PaymentResult, err error) {
	defer tc.G.CTraceTimed(ctx, "BackendMock.SubmitPayment", func() error { return err })()
	r.Lock()
	defer r.Unlock()
	kbTxID := randomKeybaseTransactionID(r.T)

	// Unpack signed transaction and checks if Payment matches transaction.
	unpackedTx, txIDPrecalc, err := unpackTx(post.SignedTransaction)

	if err != nil {
		return res, err
	}
	extract, err := extractPaymentTx(unpackedTx.Tx)
	if err != nil {
		return res, err
	}
	if extract.AmountXdr < 0 {
		return res, fmt.Errorf("payment amount %v must be greater than zero", extract.Amount)
	}

	a, ok := r.accounts[extract.From]
	if !ok {
		return stellar1.PaymentResult{}, libkb.NotFoundError{Msg: fmt.Sprintf("source account not found: '%v'", extract.From)}
	}

	if !extract.Asset.IsNativeXLM() {
		return stellar1.PaymentResult{}, errors.New("can only handle native")
	}

	a.SubtractBalance(extract.Amount)
	a.AdjustBalance(-(int64(unpackedTx.Tx.Fee)))

	b, ok := r.accounts[extract.To]
	if !ok {
		return res, fmt.Errorf("destination not funded: %v", extract.To)
	}
	// we know about destination as well
	b.AddBalance(extract.Amount)

	caller, err := tc.G.GetMeUV(ctx)
	if err != nil {
		return stellar1.PaymentResult{}, fmt.Errorf("could not get self UV: %v", err)
	}
	r.addPayment(stellar1.NewPaymentSummaryWithDirect(stellar1.PaymentSummaryDirect{
		KbTxID:          kbTxID,
		TxID:            stellar1.TransactionID(txIDPrecalc),
		TxStatus:        stellar1.TransactionStatus_SUCCESS,
		FromStellar:     extract.From,
		From:            caller,
		FromDeviceID:    post.FromDeviceID,
		ToStellar:       extract.To,
		To:              post.To,
		Amount:          extract.Amount,
		Asset:           extract.Asset,
		DisplayAmount:   &post.DisplayAmount,
		DisplayCurrency: &post.DisplayCurrency,
		NoteB64:         post.NoteB64,
		Ctime:           stellar1.ToTimeMs(time.Now()),
		Rtime:           stellar1.ToTimeMs(time.Now()),
	}))

	return stellar1.PaymentResult{
		StellarID: stellar1.TransactionID(txIDPrecalc),
		KeybaseID: kbTxID,
	}, nil
}

func (r *BackendMock) SubmitRelayPayment(ctx context.Context, tc *TestContext, post stellar1.PaymentRelayPost) (res stellar1.PaymentResult, err error) {
	defer tc.G.CTraceTimed(ctx, "BackendMock.SubmitRelayPayment", func() error { return err })()
	r.Lock()
	defer r.Unlock()
	kbTxID := randomKeybaseTransactionID(r.T)

	unpackedTx, txIDPrecalc, err := unpackTx(post.SignedTransaction)
	if err != nil {
		return res, err
	}
	extract, err := extractPaymentTx(unpackedTx.Tx)
	if err != nil {
		return res, err
	}
	if extract.OpType != xdr.OperationTypeCreateAccount {
		return res, fmt.Errorf("relay funding transaction must be CreateAccount but got %v", extract.OpType)
	}
	if !extract.To.Eq(post.RelayAccount) {
		return res, fmt.Errorf("relay destination does not match funding tx: %v != %v", extract.To, post.RelayAccount)
	}
	if !extract.Asset.IsNativeXLM() {
		return res, fmt.Errorf("relay transaction can only transport XLM asset")
	}
	const relayPaymentMinimumBalance = xdr.Int64(20100000) // 2.01 XLM
	if extract.AmountXdr < relayPaymentMinimumBalance {
		return res, fmt.Errorf("must send at least %v", stellaramount.String(relayPaymentMinimumBalance))
	}

	a, ok := r.accounts[extract.From]
	if !ok {
		return stellar1.PaymentResult{}, libkb.NotFoundError{Msg: fmt.Sprintf("source account not found: '%v'", extract.From)}
	}
	b := r.addAccountByID(extract.To, false)
	a.SubtractBalance(extract.Amount)
	a.AdjustBalance(-(int64(unpackedTx.Tx.Fee)))
	b.AddBalance(extract.Amount)

	caller, err := tc.G.GetMeUV(ctx)
	if err != nil {
		return stellar1.PaymentResult{}, fmt.Errorf("could not get self UV: %v", err)
	}
	r.addPayment(stellar1.NewPaymentSummaryWithRelay(stellar1.PaymentSummaryRelay{
		KbTxID:          kbTxID,
		TxID:            stellar1.TransactionID(txIDPrecalc),
		TxStatus:        stellar1.TransactionStatus_SUCCESS,
		FromStellar:     extract.From,
		From:            caller,
		FromDeviceID:    post.FromDeviceID,
		To:              post.To,
		RelayAccount:    extract.To,
		Amount:          extract.Amount,
		DisplayAmount:   &post.DisplayAmount,
		DisplayCurrency: &post.DisplayCurrency,
		Ctime:           stellar1.ToTimeMs(time.Now()),
		Rtime:           stellar1.ToTimeMs(time.Now()),
		BoxB64:          post.BoxB64,
		TeamID:          post.TeamID,
	}))

	return stellar1.PaymentResult{
		StellarID: stellar1.TransactionID(txIDPrecalc),
		KeybaseID: kbTxID,
	}, nil
}

func (r *BackendMock) SubmitRelayClaim(ctx context.Context, tc *TestContext, post stellar1.RelayClaimPost) (res stellar1.RelayClaimResult, err error) {
	defer tc.G.CTraceTimed(ctx, "BackendMock.SubmitRelayClaim", func() error { return err })()
	r.Lock()
	defer r.Unlock()

	unpackedTx, txIDPrecalc, err := unpackTx(post.SignedTransaction)
	if err != nil {
		return res, err
	}
	extract, err := extractRelocateTx(unpackedTx.Tx)
	if err != nil {
		return res, err
	}

	a, ok := r.accounts[extract.From]
	if !ok {
		return res, libkb.NotFoundError{Msg: fmt.Sprintf("claim source account not found: '%v'", extract.From)}
	}
	b, ok := r.accounts[extract.To]
	if !ok {
		return res, libkb.NotFoundError{Msg: fmt.Sprintf("claim target account not found: '%v'", extract.From)}
	}
	if stellaramount.MustParse(a.balance.Amount) == 0 {
		return res, fmt.Errorf("claim source account has zero balance: %v", a.accountID)
	}
	a.AdjustBalance(-(int64(unpackedTx.Tx.Fee)))
	b.AdjustBalance(a.ZeroBalance())

	caller, err := tc.G.GetMeUV(ctx)
	if err != nil {
		return stellar1.RelayClaimResult{}, fmt.Errorf("could not get self UV: %v", err)
	}
	r.addClaim(post.KeybaseID, stellar1.ClaimSummary{
		TxID:      stellar1.TransactionID(txIDPrecalc),
		TxStatus:  stellar1.TransactionStatus_SUCCESS,
		Dir:       post.Dir,
		ToStellar: extract.To,
		To:        caller,
	})

	return stellar1.RelayClaimResult{
		ClaimStellarID: stellar1.TransactionID(txIDPrecalc),
	}, nil
}

func (r *BackendMock) RecentPayments(ctx context.Context, tc *TestContext, accountID stellar1.AccountID, limit int) (res []stellar1.PaymentSummary, err error) {
	defer tc.G.CTraceTimed(ctx, "BackendMock.RecentPayments", func() error { return err })()
	r.Lock()
	defer r.Unlock()
	return r.txLog.Filter(ctx, tc, accountID, limit), nil
}

func (r *BackendMock) PaymentDetail(ctx context.Context, tc *TestContext, txID string) (res stellar1.PaymentSummary, err error) {
	defer tc.G.CTraceTimed(ctx, "BackendMock.PaymentDetail", func() error { return err })()
	r.Lock()
	defer r.Unlock()
	p := r.txLog.Find(txID)
	if p == nil {
		return res, fmt.Errorf("BackendMock: tx not found: '%v'", txID)
	}
	return *p, nil
}

func (r *BackendMock) Details(ctx context.Context, accountID stellar1.AccountID) (res stellar1.AccountDetails, err error) {
	defer r.G().CTraceTimed(ctx, "RemoteMock.Details", func() error { return err })()
	a, ok := r.accounts[accountID]
	if !ok {
		return stellar1.AccountDetails{}, libkb.NotFoundError{}
	}
	return stellar1.AccountDetails{
		AccountID:     accountID,
		Seqno:         strconv.FormatUint(r.seqno, 64),
		Balances:      []stellar1.Balance{a.balance},
		SubentryCount: a.subentries,
		Available:     a.availableBalance(),
	}, nil
}

func (r *RemoteMock) Details(ctx context.Context, accountID stellar1.AccountID) (res stellar1.AccountDetails, err error) {
	defer r.G().CTraceTimed(ctx, "RemoteMock.Details", func() error { return err })()
	a, ok := r.accounts[accountID]
	if !ok {
		return stellar1.AccountDetails{}, libkb.NotFoundError{}
	}
	return stellar1.AccountDetails{
		AccountID:     accountID,
		Seqno:         strconv.FormatUint(r.seqno, 10),
		Balances:      []stellar1.Balance{a.balance},
		SubentryCount: a.subentries,
		Available:     a.availableBalance(),
	}, nil
}

func (r *BackendMock) AddAccount() stellar1.AccountID {
	defer r.trace(nil, "BackendMock.AddAccount", "")()
	r.Lock()
	defer r.Unlock()
	return r.addAccountRandom(true)
}

func (r *BackendMock) addAccountRandom(funded bool) stellar1.AccountID {
	full, err := keypair.Random()
	require.NoError(r.T, err)
	amount := "0"
	if funded {
		amount = "10000"
	}
	a := &FakeAccount{
		T:         r.T,
		accountID: stellar1.AccountID(full.Address()),
		secretKey: stellar1.SecretKey(full.Seed()),
		balance: stellar1.Balance{
			Asset:  stellar1.Asset{Type: "native"},
			Amount: amount,
		},
		t: t,
	}
	require.Nil(r.T, r.accounts[a.accountID], "attempt to re-add account %v", a.accountID)
	r.accounts[a.accountID] = a
	return a.accountID
}

func (r *BackendMock) addAccountByID(accountID stellar1.AccountID, funded bool) *FakeAccount {
	amount := "0"
	if funded {
		amount = "10000"
	}
	a := &FakeAccount{
		T:         r.T,
		accountID: accountID,
		balance: stellar1.Balance{
			Asset:  stellar1.Asset{Type: "native"},
			Amount: amount,
		},
	}
	require.Nil(r.T, r.accounts[a.accountID], "attempt to re-add account %v", a.accountID)
	r.accounts[a.accountID] = a
	return a
}

func (r *BackendMock) ImportAccountsForUser(tc *TestContext) {
	defer tc.G.CTraceTimed(context.Background(), "BackendMock.ImportAccountsForUser", func() error { return nil })()
	r.Lock()
	defer r.Unlock()
	bundle, _, err := remote.Fetch(context.Background(), tc.G)
	require.NoError(r.T, err)
	for _, account := range bundle.Accounts {
		if _, found := r.accounts[account.AccountID]; found {
			continue
		}
		a := &FakeAccount{
			T:         r.T,
			accountID: stellar1.AccountID(account.AccountID),
			secretKey: stellar1.SecretKey(account.Signers[0]),
			balance: stellar1.Balance{
				Asset:  stellar1.Asset{Type: "native"},
				Amount: "0",
			},
			t: t,
		}
		r.accounts[a.accountID] = a
	}
}

func (r *BackendMock) SecretKey(accountID stellar1.AccountID) stellar1.SecretKey {
	defer r.trace(nil, "BackendMock.SecretKey", "")()
	r.Lock()
	defer r.Unlock()
	a := r.accounts[accountID]
	require.NotNil(r.T, a, "SecretKey: account id not in remote mock: %v", accountID)
	require.True(r.T, len(a.secretKey) > 0, "secret key missing in mock for: %v", accountID)
	return a.secretKey
}

func (r *BackendMock) AssertBalance(accountID stellar1.AccountID, amount string) {
	r.Lock()
	defer r.Unlock()
	require.NotNil(r.T, r.accounts[accountID], "account should exist in mock to assert balance")
	require.Equal(r.T, amount, r.accounts[accountID].balance.Amount, "account balance")
}

func (r *RemoteMock) GetAccountDisplayCurrency(ctx context.Context, accountID stellar1.AccountID) (string, error) {
	return "USD", nil
}

func (r *RemoteMock) ExchangeRate(ctx context.Context, currency string) (stellar1.OutsideExchangeRate, error) {
	return stellar1.OutsideExchangeRate{
		Currency: stellar1.OutsideCurrencyCode(currency),
		Rate:     "0.318328",
	}, nil
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

// Friendbot sends someone XLM
func (r *BackendMock) Gift(accountID stellar1.AccountID, amount string) {
	r.Lock()
	defer r.Unlock()
	require.NotNil(r.T, r.accounts[accountID], "account for gift")
	r.accounts[accountID].AdjustBalance(int64(stellaramount.MustParse(amount)))
}

func randomKeybaseTransactionID(t testing.TB) stellar1.KeybaseTransactionID {
	b, err := libkb.RandBytesWithSuffix(stellar1.KeybaseTransactionIDLen, stellar1.KeybaseTransactionIDSuffix)
	require.NoError(t, err)
	res, err := stellar1.KeybaseTransactionIDFromString(hex.EncodeToString(b))
	require.NoError(t, err)
	return res
}
