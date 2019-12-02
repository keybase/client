package stellarsvc

import (
	"context"
	"encoding/base64"
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
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/xdr"

	"github.com/stretchr/testify/require"
)

type txlogger struct {
	transactions []stellar1.PaymentDetails
	sync.Mutex
	T testing.TB
}

func newTxLogger(t testing.TB) *txlogger { return &txlogger{T: t} }

func (t *txlogger) Add(tx stellar1.PaymentDetails) {
	t.Lock()
	defer t.Unlock()
	t.transactions = append([]stellar1.PaymentDetails{tx}, t.transactions...)
}

func (t *txlogger) AddClaim(kbTxID stellar1.KeybaseTransactionID, c stellar1.ClaimSummary) {
	t.Lock()
	defer t.Unlock()
	for i := range t.transactions {
		p := &t.transactions[i]
		typ, err := p.Summary.Typ()
		require.NoError(t.T, err)
		if typ != stellar1.PaymentSummaryType_RELAY {
			continue
		}
		if !p.Summary.Relay().KbTxID.Eq(kbTxID) {
			continue
		}
		p.Summary.Relay__.Claim = &c
		return
	}
	require.Fail(t.T, "should find relay to attach claim to", "%v", kbTxID)
}

// Filter by accountID
// But: Unclaimed relays not from the caller are effectively associated with the caller's primary account.
func (t *txlogger) Filter(ctx context.Context, tc *TestContext, accountID stellar1.AccountID, limit int, skipPending bool) []stellar1.PaymentSummary {
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
	myAccountID := user.StellarAccountID()
	if myAccountID != nil {
		callerAccountID = *myAccountID
	}
	caller := user.ToUserVersion()

	var res []stellar1.PaymentSummary
collection:
	for _, tx := range t.transactions {
		if limit > 0 && len(res) == limit {
			break
		}

		typ, err := tx.Summary.Typ()
		require.NoError(t.T, err)
		switch typ {
		case stellar1.PaymentSummaryType_STELLAR:
			p := tx.Summary.Stellar()
			for _, acc := range []stellar1.AccountID{p.From, p.To} {
				if acc.Eq(accountID) {
					res = append(res, tx.Summary)
					continue collection
				}
			}
		case stellar1.PaymentSummaryType_DIRECT:
			p := tx.Summary.Direct()
			for _, acc := range []stellar1.AccountID{p.FromStellar, p.ToStellar} {
				if acc.Eq(accountID) {
					res = append(res, tx.Summary)
					continue collection
				}
			}
		case stellar1.PaymentSummaryType_RELAY:
			p := tx.Summary.Relay()

			// Caller must be a member of the impteam.
			if !t.isCallerInImplicitTeam(tc, p.TeamID) {
				t.T.Logf("filtered out relay (team membership): %v", p.KbTxID)
				continue collection
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
				continue collection
			}

			if skipPending {
				pending := true
				if p.TxStatus != stellar1.TransactionStatus_SUCCESS && p.TxStatus != stellar1.TransactionStatus_PENDING {
					pending = false
				}
				if p.Claim != nil && p.Claim.TxStatus == stellar1.TransactionStatus_SUCCESS {
					pending = false
				}
				if pending {
					continue collection
				}
			}

			res = append(res, tx.Summary)
		default:
			require.Fail(t.T, "unrecognized variant", "%v", typ)
		}
	}
	return res
}

// Pending by accountID
func (t *txlogger) Pending(ctx context.Context, tc *TestContext, accountID stellar1.AccountID, limit int) []stellar1.PaymentSummary {
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
	myAccountID := user.StellarAccountID()
	if myAccountID != nil {
		callerAccountID = *myAccountID
	}
	caller := user.ToUserVersion()

	var res []stellar1.PaymentSummary
	for _, tx := range t.transactions {
		if limit > 0 && len(res) == limit {
			break
		}

		typ, err := tx.Summary.Typ()
		require.NoError(t.T, err)
		switch typ {
		case stellar1.PaymentSummaryType_STELLAR:
			continue
		case stellar1.PaymentSummaryType_DIRECT:
			continue
		case stellar1.PaymentSummaryType_RELAY:
			p := tx.Summary.Relay()

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

			if p.TxStatus != stellar1.TransactionStatus_SUCCESS && p.TxStatus != stellar1.TransactionStatus_PENDING {
				continue
			}
			if p.Claim != nil && p.Claim.TxStatus == stellar1.TransactionStatus_SUCCESS {
				continue
			}

			res = append(res, tx.Summary)
		default:
			require.Fail(t.T, "unrecognized variant", "%v", typ)
		}
	}
	return res
}

// Check whether the caller is in the implicit team.
// By loading the team.
func (t *txlogger) isCallerInImplicitTeam(tc *TestContext, teamID keybase1.TeamID) bool {
	team, _, err := tc.G.GetTeamLoader().Load(context.Background(), keybase1.LoadTeamArg{
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

func (t *txlogger) Find(txID string) *stellar1.PaymentDetails {
	t.Lock()
	defer t.Unlock()
	for _, tx := range t.transactions {
		typ, err := tx.Summary.Typ()
		require.NoError(t.T, err)
		switch typ {
		case stellar1.PaymentSummaryType_STELLAR:
			if tx.Summary.Stellar().TxID.String() == txID {
				return &tx
			}
		case stellar1.PaymentSummaryType_DIRECT:
			p := tx.Summary.Direct()
			if p.TxID.String() == txID || p.KbTxID.String() == txID {
				return &tx
			}
		case stellar1.PaymentSummaryType_RELAY:
			if tx.Summary.Relay().TxID.String() == txID || tx.Summary.Relay().KbTxID.String() == txID {
				return &tx
			}
		default:
			require.Fail(t.T, "unrecognized variant", "%v", typ)
		}
	}
	return nil
}

func (t *txlogger) FindFirstUnclaimedFor(uv keybase1.UserVersion) (*stellar1.PaymentDetails, error) {
	t.Lock()
	defer t.Unlock()
	for _, tx := range t.transactions {
		typ, err := tx.Summary.Typ()
		if err != nil {
			return nil, err
		}
		if typ != stellar1.PaymentSummaryType_RELAY {
			continue
		}
		relay := tx.Summary.Relay()
		if relay.Claim != nil {
			continue
		}
		if relay.To.Eq(uv) {
			return &tx, nil
		}
	}
	return nil, nil
}

type FakeAccount struct {
	T             testing.TB
	accountID     stellar1.AccountID
	secretKey     stellar1.SecretKey // can be missing for relay accounts
	balance       stellar1.Balance   // XLM
	otherBalances []stellar1.Balance // other assets
	subentries    int
	inflationDest stellar1.AccountID
}

func (a *FakeAccount) AddBalance(amt string) {
	n, err := stellarnet.ParseStellarAmount(amt)
	require.NoError(a.T, err)
	a.AdjustBalance(n)
}

func (a *FakeAccount) SubtractBalance(amt string) {
	n, err := stellarnet.ParseStellarAmount(amt)
	require.NoError(a.T, err)
	a.AdjustBalance(-n)
}

func (a *FakeAccount) ZeroBalance() int64 {
	res, err := stellarnet.ParseStellarAmount(a.balance.Amount)
	require.NoError(a.T, err)
	a.balance.Amount = "0"
	return res
}

func (a *FakeAccount) AdjustBalance(amt int64) {
	b, err := stellarnet.ParseStellarAmount(a.balance.Amount)
	require.NoError(a.T, err)
	b += amt
	a.balance.Amount = stellarnet.StringFromStellarAmount(b)
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
	b, err := stellarnet.ParseStellarAmount(a.balance.Amount)
	require.NoError(a.T, err)
	minimumReserve, err := stellarnet.ParseStellarAmount("1.0")
	require.NoError(a.T, err)
	switch {
	case b == 0:
		return false
	case b < 0:
		require.Fail(a.T, "account has negative balance", "%v", a.accountID)
	case b < minimumReserve:
		require.Fail(a.T, "account has less than the minimum balance", "%v < %v %v",
			stellarnet.StringFromStellarAmount(b), stellarnet.StringFromStellarAmount(minimumReserve), a.accountID)
	default:
		return true
	}

	return b != 0
}

func (a *FakeAccount) availableBalance() string {
	b, err := stellarnet.AvailableBalance(a.balance.Amount, a.subentries)
	if err != nil {
		a.T.Fatalf("AvailableBalance error: %s", err)
	}
	return b
}

func (a *FakeAccount) AdjustAssetBalance(amount int64, asset stellar1.Asset) {
	for i, v := range a.otherBalances {
		if v.Asset.SameAsset(asset) {
			b, err := stellarnet.ParseStellarAmount(v.Amount)
			require.NoError(a.T, err)
			b += amount
			v.Amount = stellarnet.StringFromStellarAmount(b)
			a.otherBalances[i] = v
			return
		}
	}

	balance := stellar1.Balance{
		Amount:       stellarnet.StringFromStellarAmount(amount),
		Asset:        asset,
		IsAuthorized: true,
	}
	a.otherBalances = append(a.otherBalances, balance)
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

func (r *RemoteClientMock) SubmitMultiPayment(ctx context.Context, post stellar1.PaymentMultiPost) (stellar1.SubmitMultiRes, error) {
	return r.Backend.SubmitMultiPayment(ctx, r.Tc, post)
}

func (r *RemoteClientMock) SubmitRelayClaim(ctx context.Context, post stellar1.RelayClaimPost) (stellar1.RelayClaimResult, error) {
	return r.Backend.SubmitRelayClaim(ctx, r.Tc, post)
}

func (r *RemoteClientMock) AcquireAutoClaimLock(ctx context.Context) (string, error) {
	return r.Backend.AcquireAutoClaimLock(ctx, r.Tc)
}

func (r *RemoteClientMock) ReleaseAutoClaimLock(ctx context.Context, token string) error {
	return r.Backend.ReleaseAutoClaimLock(ctx, r.Tc, token)
}

func (r *RemoteClientMock) NextAutoClaim(ctx context.Context) (*stellar1.AutoClaim, error) {
	return r.Backend.NextAutoClaim(ctx, r.Tc)
}

func (r *RemoteClientMock) RecentPayments(ctx context.Context, arg remote.RecentPaymentsArg) (stellar1.PaymentsPage, error) {
	return r.Backend.RecentPayments(ctx, r.Tc, arg.AccountID, arg.Cursor, arg.Limit, arg.SkipPending)
}

func (r *RemoteClientMock) PendingPayments(ctx context.Context, accountID stellar1.AccountID, limit int) ([]stellar1.PaymentSummary, error) {
	return r.Backend.PendingPayments(ctx, r.Tc, accountID, limit)
}

func (r *RemoteClientMock) PaymentDetails(ctx context.Context, accountID stellar1.AccountID, txID string) (res stellar1.PaymentDetails, err error) {
	return r.Backend.PaymentDetails(ctx, r.Tc, accountID, txID)
}

func (r *RemoteClientMock) PaymentDetailsGeneric(ctx context.Context, txID string) (res stellar1.PaymentDetails, err error) {
	return r.Backend.PaymentDetailsGeneric(ctx, r.Tc, txID)
}

func (r *RemoteClientMock) Details(ctx context.Context, accountID stellar1.AccountID) (stellar1.AccountDetails, error) {
	return r.Backend.Details(ctx, r.Tc, accountID)
}

func (r *RemoteClientMock) GetAccountDisplayCurrency(ctx context.Context, accountID stellar1.AccountID) (string, error) {
	return r.Backend.GetAccountDisplayCurrency(ctx, r.Tc, accountID)
}

func (r *RemoteClientMock) ExchangeRate(ctx context.Context, currency string) (stellar1.OutsideExchangeRate, error) {
	return r.Backend.ExchangeRate(ctx, r.Tc, currency)
}

func (r *RemoteClientMock) SubmitRequest(ctx context.Context, post stellar1.RequestPost) (stellar1.KeybaseRequestID, error) {
	return r.Backend.SubmitRequest(ctx, r.Tc, post)
}

func (r *RemoteClientMock) RequestDetails(ctx context.Context, requestID stellar1.KeybaseRequestID) (stellar1.RequestDetails, error) {
	return r.Backend.RequestDetails(ctx, r.Tc, requestID)
}

func (r *RemoteClientMock) CancelRequest(ctx context.Context, requestID stellar1.KeybaseRequestID) error {
	return r.Backend.CancelRequest(ctx, r.Tc, requestID)
}

func (r *RemoteClientMock) MarkAsRead(ctx context.Context, acctID stellar1.AccountID, mostRecentID stellar1.TransactionID) error {
	return r.Backend.MarkAsRead(ctx, r.Tc, acctID, mostRecentID)
}

func (r *RemoteClientMock) SetAccountMobileOnly(ctx context.Context, acctID stellar1.AccountID) error {
	return r.Backend.SetAccountMobileOnly(ctx, r.Tc, acctID)
}

func (r *RemoteClientMock) MakeAccountAllDevices(ctx context.Context, acctID stellar1.AccountID) error {
	return r.Backend.MakeAccountAllDevices(ctx, r.Tc, acctID)
}

func (r *RemoteClientMock) IsAccountMobileOnly(ctx context.Context, acctID stellar1.AccountID) (bool, error) {
	return r.Backend.IsAccountMobileOnly(ctx, r.Tc, acctID)
}

func (r *RemoteClientMock) ServerTimeboundsRecommendation(ctx context.Context) (stellar1.TimeboundsRecommendation, error) {
	return r.Backend.ServerTimeboundsRecommendation(ctx, r.Tc)
}

func (r *RemoteClientMock) SetInflationDestination(ctx context.Context, signedTx string) error {
	return r.Backend.SetInflationDestination(ctx, r.Tc, signedTx)
}

func (r *RemoteClientMock) GetInflationDestinations(ctx context.Context) (ret []stellar1.PredefinedInflationDestination, err error) {
	return r.Backend.GetInflationDestinations(ctx, r.Tc)
}

func (r *RemoteClientMock) NetworkOptions(ctx context.Context) (stellar1.NetworkOptions, error) {
	return stellar1.NetworkOptions{BaseFee: 100}, nil
}

func (r *RemoteClientMock) DetailsPlusPayments(ctx context.Context, accountID stellar1.AccountID) (stellar1.DetailsPlusPayments, error) {
	details, err := r.Backend.Details(ctx, r.Tc, accountID)
	if err != nil {
		return stellar1.DetailsPlusPayments{}, err
	}

	recent, err := r.Backend.RecentPayments(ctx, r.Tc, accountID, nil, 50, true)
	if err != nil {
		return stellar1.DetailsPlusPayments{}, err
	}

	pending, err := r.Backend.PendingPayments(ctx, r.Tc, accountID, 25)
	if err != nil {
		return stellar1.DetailsPlusPayments{}, err
	}

	return stellar1.DetailsPlusPayments{
		Details:         details,
		RecentPayments:  recent,
		PendingPayments: pending,
	}, nil
}

func (r *RemoteClientMock) AllDetailsPlusPayments(mctx libkb.MetaContext) ([]stellar1.DetailsPlusPayments, error) {
	r.Tc.T.Log("AllDetailsPlusPayments for %s", r.Tc.Fu.GetUID())
	ids := r.Backend.AllAccountIDs(r.Tc.Fu.GetUID())
	var all []stellar1.DetailsPlusPayments
	for _, id := range ids {
		dpp, err := r.DetailsPlusPayments(mctx.Ctx(), id)
		if err == nil {
			r.Tc.T.Log("AllDetailsPlusPayments dpp for %s/%s: %+v", r.Tc.Fu.GetUID(), id, dpp)
			all = append(all, dpp)
		}
	}
	return all, nil
}

func (r *RemoteClientMock) ChangeTrustline(ctx context.Context, signedTx string) error {
	return r.Backend.ChangeTrustline(ctx, r.Tc, signedTx)
}

func (r *RemoteClientMock) FindPaymentPath(_ libkb.MetaContext, _ stellar1.PaymentPathQuery) (stellar1.PaymentPath, error) {
	return stellar1.PaymentPath{}, errors.New("not mocked")
}

func (r *RemoteClientMock) SubmitPathPayment(_ libkb.MetaContext, _ stellar1.PathPaymentPost) (stellar1.PaymentResult, error) {
	return stellar1.PaymentResult{}, errors.New("not mocked")
}

func (r *RemoteClientMock) FuzzyAssetSearch(_ libkb.MetaContext, _ stellar1.FuzzyAssetSearchArg) ([]stellar1.Asset, error) {
	return nil, errors.New("not mocked")
}

func (r *RemoteClientMock) ListPopularAssets(_ libkb.MetaContext, _ stellar1.ListPopularAssetsArg) (stellar1.AssetListResult, error) {
	return stellar1.AssetListResult{}, errors.New("not mocked")
}

func (r *RemoteClientMock) PostAnyTransaction(_ libkb.MetaContext, _ string) error {
	return errors.New("post any transaction is not mocked")
}

var _ remote.Remoter = (*RemoteClientMock)(nil)

const (
	defaultExchangeRate   = "0.318328"
	alternateExchangeRate = "0.212133"
)

// BackendMock is a mock of stellard.
// Stores the data and services RemoteClientMock's calls.
// Threadsafe.
type BackendMock struct {
	sync.Mutex
	T        testing.TB
	seqnos   map[stellar1.AccountID]uint64
	accounts map[stellar1.AccountID]*FakeAccount
	requests map[stellar1.KeybaseRequestID]*stellar1.RequestDetails
	txLog    *txlogger
	exchRate string
	currency string

	autoclaimEnabled map[keybase1.UID]bool
	autoclaimLocks   map[keybase1.UID]bool

	userAccounts map[keybase1.UID][]stellar1.AccountID
}

func NewBackendMock(t testing.TB) *BackendMock {
	return &BackendMock{
		T:        t,
		seqnos:   make(map[stellar1.AccountID]uint64),
		accounts: make(map[stellar1.AccountID]*FakeAccount),
		requests: make(map[stellar1.KeybaseRequestID]*stellar1.RequestDetails),
		txLog:    newTxLogger(t),
		exchRate: defaultExchangeRate,
		currency: "USD",

		autoclaimEnabled: make(map[keybase1.UID]bool),
		autoclaimLocks:   make(map[keybase1.UID]bool),

		userAccounts: make(map[keybase1.UID][]stellar1.AccountID),
	}
}

func (r *BackendMock) trace(err *error, name string, format string, args ...interface{}) func() {
	r.T.Logf("+ %s %s", name, fmt.Sprintf(format, args...))
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

func (r *BackendMock) addPayment(accountID stellar1.AccountID, payment stellar1.PaymentDetails) {
	defer r.trace(nil, "BackendMock.addPayment", "")()
	r.txLog.Add(payment)

	r.seqnos[accountID]++
}

func (r *BackendMock) addClaim(accountID stellar1.AccountID, kbTxID stellar1.KeybaseTransactionID, summary stellar1.ClaimSummary) {
	defer r.trace(nil, "BackendMock.addClaim", "")()
	r.txLog.AddClaim(kbTxID, summary)

	r.seqnos[accountID]++
}

func (r *BackendMock) AccountSeqno(ctx context.Context, accountID stellar1.AccountID) (res uint64, err error) {
	defer r.trace(&err, "BackendMock.AccountSeqno", "%v", accountID)()
	r.Lock()
	defer r.Unlock()
	_, ok := r.seqnos[accountID]
	if !ok {
		r.seqnos[accountID] = uint64(time.Now().UnixNano())
	}

	return r.seqnos[accountID], nil
}

func (r *BackendMock) Balances(ctx context.Context, accountID stellar1.AccountID) (res []stellar1.Balance, err error) {
	defer r.trace(&err, "BackendMock.Balances", "%v", accountID)()
	r.Lock()
	defer r.Unlock()
	a, ok := r.accounts[accountID]
	if !ok {
		// If an account does not exist on the network, return empty balance list.
		return nil, nil
	}
	res = append(res, a.balance)
	res = append(res, a.otherBalances...)
	return res, nil
}

func (r *BackendMock) SubmitPayment(ctx context.Context, tc *TestContext, post stellar1.PaymentDirectPost) (res stellar1.PaymentResult, err error) {
	defer tc.G.CTraceTimed(ctx, "BackendMock.SubmitPayment", func() error { return err })()
	r.Lock()
	defer r.Unlock()
	kbTxID := randomKeybaseTransactionID(r.T)

	if post.QuickReturn {
		msg := "SubmitPayment with QuickReturn not implemented on BackendMock"
		r.T.Fatalf(msg)
		return res, errors.New(msg)
	}

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

	require.NotNil(tc.T, extract.TimeBounds, "We are expecting TimeBounds in all txs")
	if extract.TimeBounds != nil {
		require.NotZero(tc.T, extract.TimeBounds.MaxTime, "We are expecting non-zero TimeBounds.MaxTime in all txs")
		require.True(tc.T, time.Now().Before(time.Unix(int64(extract.TimeBounds.MaxTime), 0)))
		// We always send MinTime=0 but this assertion should still hold.
		require.True(tc.T, time.Now().After(time.Unix(int64(extract.TimeBounds.MinTime), 0)))
	}

	caller, err := tc.G.GetMeUV(ctx)
	if err != nil {
		return stellar1.PaymentResult{}, fmt.Errorf("could not get self UV: %v", err)
	}

	toIsFunded := false
	b, toExists := r.accounts[extract.To]

	if !toIsFunded {
		if extract.AmountXdr < 10000000 {
			return stellar1.PaymentResult{}, errors.New("op minimum reserve get outta here")
		}
	}
	if !toExists {
		b = r.addAccountByID(caller.Uid, extract.To, false)
	}
	a.SubtractBalance(extract.Amount)
	a.AdjustBalance(-(int64(unpackedTx.Tx.Fee)))
	b.AddBalance(extract.Amount)

	summary := stellar1.NewPaymentSummaryWithDirect(stellar1.PaymentSummaryDirect{
		KbTxID:              kbTxID,
		TxID:                stellar1.TransactionID(txIDPrecalc),
		TxStatus:            stellar1.TransactionStatus_SUCCESS,
		FromStellar:         extract.From,
		From:                caller,
		FromDeviceID:        post.FromDeviceID,
		FromDisplayAmount:   "123.23",
		FromDisplayCurrency: "USD",
		ToDisplayAmount:     "18.50",
		ToDisplayCurrency:   "JPY",
		ToStellar:           extract.To,
		To:                  post.To,
		Amount:              extract.Amount,
		Asset:               extract.Asset,
		DisplayAmount:       &post.DisplayAmount,
		DisplayCurrency:     &post.DisplayCurrency,
		NoteB64:             post.NoteB64,
		Ctime:               stellar1.ToTimeMs(time.Now()),
		Rtime:               stellar1.ToTimeMs(time.Now()),
	})

	memo, memoType := extractMemo(unpackedTx.Tx)

	r.addPayment(extract.From, stellar1.PaymentDetails{
		Summary:       summary,
		Memo:          memo,
		MemoType:      memoType,
		ExternalTxURL: fmt.Sprintf("https://stellar.expert/explorer/public/tx/%s", txIDPrecalc),
	})

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

	if post.QuickReturn {
		msg := "SubmitRelayPayment with QuickReturn not implemented on BackendMock"
		r.T.Fatalf(msg)
		return res, errors.New(msg)
	}

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
		return res, fmt.Errorf("must send at least %v", stellarnet.StringFromStellarXdrAmount(relayPaymentMinimumBalance))
	}

	caller, err := tc.G.GetMeUV(ctx)
	if err != nil {
		return stellar1.PaymentResult{}, fmt.Errorf("could not get self UV: %v", err)
	}

	a, ok := r.accounts[extract.From]
	if !ok {
		return stellar1.PaymentResult{}, libkb.NotFoundError{Msg: fmt.Sprintf("source account not found: '%v'", extract.From)}
	}
	b := r.addAccountByID(caller.Uid, extract.To, false)
	a.SubtractBalance(extract.Amount)
	a.AdjustBalance(-(int64(unpackedTx.Tx.Fee)))
	b.AddBalance(extract.Amount)

	summary := stellar1.NewPaymentSummaryWithRelay(stellar1.PaymentSummaryRelay{
		KbTxID:          kbTxID,
		TxID:            stellar1.TransactionID(txIDPrecalc),
		TxStatus:        stellar1.TransactionStatus_SUCCESS,
		FromStellar:     extract.From,
		From:            caller,
		FromDeviceID:    post.FromDeviceID,
		To:              post.To,
		ToAssertion:     post.ToAssertion,
		RelayAccount:    extract.To,
		Amount:          extract.Amount,
		DisplayAmount:   &post.DisplayAmount,
		DisplayCurrency: &post.DisplayCurrency,
		Ctime:           stellar1.ToTimeMs(time.Now()),
		Rtime:           stellar1.ToTimeMs(time.Now()),
		BoxB64:          post.BoxB64,
		TeamID:          post.TeamID,
	})
	r.addPayment(extract.From, stellar1.PaymentDetails{Summary: summary})

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
	if amt, _ := stellarnet.ParseStellarAmount(a.balance.Amount); amt == 0 {
		return res, fmt.Errorf("claim source account has zero balance: %v", a.accountID)
	}
	a.AdjustBalance(-(int64(unpackedTx.Tx.Fee)))
	b.AdjustBalance(a.ZeroBalance())

	caller, err := tc.G.GetMeUV(ctx)
	if err != nil {
		return stellar1.RelayClaimResult{}, fmt.Errorf("could not get self UV: %v", err)
	}
	r.addClaim(extract.From, post.KeybaseID, stellar1.ClaimSummary{
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

func (r *BackendMock) EnableAutoclaimMock(tc *TestContext) {
	r.autoclaimEnabled[tc.Fu.GetUID()] = true
	r.autoclaimLocks[tc.Fu.GetUID()] = false
}

func (r *BackendMock) AcquireAutoClaimLock(ctx context.Context, tc *TestContext) (string, error) {
	uid := tc.Fu.GetUID()
	if !r.autoclaimEnabled[uid] {
		return "", fmt.Errorf("Autoclaims are not enabled for %q", tc.Fu.Username)
	}
	require.False(tc.T, r.autoclaimLocks[uid], "Lock already acquired")
	r.autoclaimLocks[uid] = true
	return "autoclaim_test_token", nil
}

func (r *BackendMock) ReleaseAutoClaimLock(ctx context.Context, tc *TestContext, token string) error {
	uid := tc.Fu.GetUID()
	require.True(tc.T, r.autoclaimEnabled[uid], "autoclaims have to be enabled for uid")
	require.True(tc.T, r.autoclaimLocks[uid], "Lock has to be called first before Release")
	r.autoclaimLocks[uid] = false
	return nil
}

func (r *BackendMock) NextAutoClaim(ctx context.Context, tc *TestContext) (*stellar1.AutoClaim, error) {
	caller, err := tc.G.GetMeUV(ctx)
	if err != nil {
		return nil, fmt.Errorf("could not get self UV: %v", err)
	}
	uid := caller.Uid
	require.True(tc.T, r.autoclaimEnabled[uid], "autoclaims have to be enabled for uid")
	require.True(tc.T, r.autoclaimLocks[uid], "Lock has to be called first before NextAutoClaim")

	payment, err := r.txLog.FindFirstUnclaimedFor(caller)
	require.NoError(tc.T, err)
	if payment != nil {
		return &stellar1.AutoClaim{
			KbTxID: payment.Summary.Relay().KbTxID,
		}, nil
	}
	return nil, nil
}

func (r *BackendMock) SubmitMultiPayment(ctx context.Context, tc *TestContext, post stellar1.PaymentMultiPost) (stellar1.SubmitMultiRes, error) {
	r.Lock()
	defer r.Unlock()

	// doing as little as possible here (i.e. just returning the
	// transaction id and not storing any of these operations in the mock)

	_, txID, err := unpackTx(post.SignedTransaction)
	if err != nil {
		return stellar1.SubmitMultiRes{}, err
	}

	return stellar1.SubmitMultiRes{
		TxID: stellar1.TransactionID(txID),
	}, nil
}

func (r *BackendMock) RecentPayments(ctx context.Context, tc *TestContext, accountID stellar1.AccountID, cursor *stellar1.PageCursor, limit int, skipPending bool) (res stellar1.PaymentsPage, err error) {
	defer tc.G.CTraceTimed(ctx, "BackendMock.RecentPayments", func() error { return err })()
	r.Lock()
	defer r.Unlock()
	if cursor != nil {
		return res, errors.New("cursor not mocked")
	}
	res.Payments = r.txLog.Filter(ctx, tc, accountID, limit, skipPending)
	return res, nil
}

func (r *BackendMock) PendingPayments(ctx context.Context, tc *TestContext, accountID stellar1.AccountID, limit int) (res []stellar1.PaymentSummary, err error) {
	defer tc.G.CTraceTimed(ctx, "BackendMock.PendingPayments", func() error { return err })()
	r.Lock()
	defer r.Unlock()
	res = r.txLog.Pending(ctx, tc, accountID, limit)
	return res, nil
}

func (r *BackendMock) PaymentDetails(ctx context.Context, tc *TestContext, accountID stellar1.AccountID, txID string) (res stellar1.PaymentDetails, err error) {
	defer tc.G.CTraceTimed(ctx, "BackendMock.PaymentDetails", func() error { return err })()
	if accountID.IsNil() {
		return res, errors.New("PaymentDetails requires AccountID")
	}
	r.Lock()
	defer r.Unlock()
	p := r.txLog.Find(txID)
	if p == nil {
		return res, fmt.Errorf("BackendMock: tx not found: '%v'", txID)
	}
	return *p, nil
}

func (r *BackendMock) PaymentDetailsGeneric(ctx context.Context, tc *TestContext, txID string) (res stellar1.PaymentDetails, err error) {
	defer tc.G.CTraceTimed(ctx, "BackendMock.PaymentDetailsGeneric", func() error { return err })()
	r.Lock()
	defer r.Unlock()
	p := r.txLog.Find(txID)
	if p == nil {
		return res, fmt.Errorf("BackendMock: tx not found: '%v'", txID)
	}
	return *p, nil
}

type accountCurrencyResult struct {
	libkb.AppStatusEmbed
	CurrencyDisplayPreference string `json:"currency_display_preference"`
}

func (r *BackendMock) Details(ctx context.Context, tc *TestContext, accountID stellar1.AccountID) (res stellar1.AccountDetails, err error) {
	defer tc.G.CTraceTimed(ctx, "RemoteMock.Details", func() error { return err })()
	r.Lock()
	defer r.Unlock()

	_, err = stellarnet.NewAddressStr(string(accountID))
	if err != nil {
		return res, err
	}

	// Fetch the currency display preference for this account first,
	// users are allowed to have currency preferences even for accounts
	// that do not exist on the network yet.
	var displayCurrency string
	mctx := libkb.NewMetaContext(ctx, tc.G)
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/accountcurrency",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"account_id": libkb.S{Val: string(accountID)},
		},
	}
	var apiRes accountCurrencyResult
	err = tc.G.API.GetDecode(mctx, apiArg, &apiRes)
	if err == nil {
		displayCurrency = apiRes.CurrencyDisplayPreference
	}

	a, ok := r.accounts[accountID]
	if !ok {
		// If an account does not exist on the network, return something reasonable.
		return stellar1.AccountDetails{
			AccountID:       accountID,
			Seqno:           "0",
			Balances:        nil,
			SubentryCount:   0,
			Available:       "0",
			DisplayCurrency: displayCurrency,
		}, nil
	}
	var balances []stellar1.Balance
	// this is different than how BackendMock.Balances works:
	if a.balance.Amount != "" {
		balances = []stellar1.Balance{a.balance}
	}
	balances = append(balances, a.otherBalances...)

	var inflationDest *stellar1.AccountID
	if a.inflationDest != "" {
		inflationDest = &a.inflationDest
	}

	return stellar1.AccountDetails{
		AccountID:            accountID,
		Seqno:                strconv.FormatUint(r.seqnos[accountID], 10),
		Balances:             balances,
		SubentryCount:        a.subentries,
		Available:            a.availableBalance(),
		DisplayCurrency:      displayCurrency,
		InflationDestination: inflationDest,
	}, nil
}

func (r *BackendMock) AddAccount(uid keybase1.UID) stellar1.AccountID {
	defer r.trace(nil, "BackendMock.AddAccount", "")()
	r.Lock()
	defer r.Unlock()
	return r.addAccountRandom(uid, true)
}

func (r *BackendMock) AddAccountEmpty(t *testing.T, uid keybase1.UID) stellar1.AccountID {
	return r.addAccountRandom(uid, false)
}

func (r *BackendMock) addAccountRandom(uid keybase1.UID, funded bool) stellar1.AccountID {
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
			Asset:        stellar1.Asset{Type: "native"},
			Amount:       amount,
			IsAuthorized: true,
		},
	}

	require.Nil(r.T, r.accounts[a.accountID], "attempt to re-add account %v", a.accountID)
	r.accounts[a.accountID] = a
	r.seqnos[a.accountID] = uint64(time.Now().UnixNano())
	r.userAccounts[uid] = append(r.userAccounts[uid], a.accountID)
	return a.accountID
}

func (r *BackendMock) addAccountByID(uid keybase1.UID, accountID stellar1.AccountID, funded bool) *FakeAccount {
	amount := "0"
	if funded {
		amount = "10000"
	}
	a := &FakeAccount{
		T:         r.T,
		accountID: accountID,
		balance: stellar1.Balance{
			Asset:        stellar1.AssetNative(),
			Amount:       amount,
			IsAuthorized: true,
		},
	}
	require.Nil(r.T, r.accounts[a.accountID], "attempt to re-add account %v", a.accountID)
	r.accounts[a.accountID] = a
	r.seqnos[a.accountID] = uint64(time.Now().UnixNano())
	r.userAccounts[uid] = append(r.userAccounts[uid], a.accountID)
	return a
}

func (r *BackendMock) ImportAccountsForUser(tc *TestContext) (res []*FakeAccount) {
	mctx := tc.MetaContext()
	defer mctx.TraceTimed("BackendMock.ImportAccountsForUser", func() error { return nil })()
	r.Lock()
	bundle, err := fetchWholeBundleForTesting(mctx)
	require.NoError(r.T, err)
	for _, account := range bundle.Accounts {
		if _, found := r.accounts[account.AccountID]; found {
			continue
		}
		acc := r.addAccountByID(tc.Fu.GetUID(), account.AccountID, false /* funded */)
		acc.secretKey = bundle.AccountBundles[account.AccountID].Signers[0]
		res = append(res, acc)
	}
	r.Unlock()

	err = tc.Srv.walletState.RefreshAll(mctx, "test")
	require.NoError(r.T, err)

	return res
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

func (r *BackendMock) GetAccountDisplayCurrency(ctx context.Context, tc *TestContext, accountID stellar1.AccountID) (string, error) {
	r.Lock()
	defer r.Unlock()
	return r.currency, nil
}

func (r *BackendMock) SetDisplayCurrency(currency string) {
	r.Lock()
	defer r.Unlock()
	r.currency = currency
}

func (r *BackendMock) ExchangeRate(ctx context.Context, tc *TestContext, currency string) (stellar1.OutsideExchangeRate, error) {
	r.Lock()
	defer r.Unlock()
	return stellar1.OutsideExchangeRate{
		Currency: stellar1.OutsideCurrencyCode(currency),
		Rate:     r.exchRate,
	}, nil
}

func (r *BackendMock) UseDefaultExchangeRate() {
	r.exchRate = defaultExchangeRate
}

func (r *BackendMock) UseAlternateExchangeRate() {
	r.exchRate = alternateExchangeRate
}

func (r *BackendMock) SetExchangeRate(rate string) {
	r.exchRate = rate
}

func (r *BackendMock) SubmitRequest(ctx context.Context, tc *TestContext, post stellar1.RequestPost) (res stellar1.KeybaseRequestID, err error) {
	b, err := libkb.RandBytesWithSuffix(stellar1.KeybaseRequestIDLen, stellar1.KeybaseRequestIDSuffix)
	if err != nil {
		return "", err
	}

	reqID, err := stellar1.KeybaseRequestIDFromString(hex.EncodeToString(b))
	if err != nil {
		return "", err
	}

	caller, err := tc.G.GetMeUV(ctx)
	if err != nil {
		return "", fmt.Errorf("could not get self UV: %v", err)
	}

	r.requests[reqID] = &stellar1.RequestDetails{
		Id:          reqID,
		FromUser:    caller,
		ToUser:      post.ToUser,
		ToAssertion: post.ToAssertion,
		Amount:      post.Amount,
		Asset:       post.Asset,
		Currency:    post.Currency,
	}
	return reqID, nil
}

func (r *BackendMock) RequestDetails(ctx context.Context, tc *TestContext, requestID stellar1.KeybaseRequestID) (res stellar1.RequestDetails, err error) {
	details, ok := r.requests[requestID]
	if !ok {
		return res, fmt.Errorf("request %v not found", requestID)
	}

	return *details, nil
}

func (r *BackendMock) CancelRequest(ctx context.Context, tc *TestContext, requestID stellar1.KeybaseRequestID) (err error) {
	readError := func() error { return fmt.Errorf("could not find request with ID %s", requestID) }

	details, ok := r.requests[requestID]
	if !ok {
		return readError()
	}

	caller, err := tc.G.GetMeUV(ctx)
	if err != nil {
		return fmt.Errorf("could not get self UV: %v", err)
	}

	if !details.FromUser.Eq(caller) {
		return readError()
	}

	details.Status = stellar1.RequestStatus_CANCELED
	return nil
}

func (r *BackendMock) MarkAsRead(ctx context.Context, tc *TestContext, acctID stellar1.AccountID, mostRecentID stellar1.TransactionID) error {
	return nil
}

func (r *BackendMock) IsAccountMobileOnly(ctx context.Context, tc *TestContext, accountID stellar1.AccountID) (bool, error) {
	return remote.IsAccountMobileOnly(ctx, tc.G, accountID)
}

func (r *BackendMock) SetAccountMobileOnly(ctx context.Context, tc *TestContext, accountID stellar1.AccountID) error {
	return remote.SetAccountMobileOnly(ctx, tc.G, accountID)
}

func (r *BackendMock) MakeAccountAllDevices(ctx context.Context, tc *TestContext, accountID stellar1.AccountID) error {
	return remote.MakeAccountAllDevices(ctx, tc.G, accountID)
}

func (r *BackendMock) ServerTimeboundsRecommendation(ctx context.Context, tc *TestContext) (stellar1.TimeboundsRecommendation, error) {
	// Call real timebounds endpoint for integration testing.
	return remote.ServerTimeboundsRecommendation(ctx, tc.G)
}

func (r *BackendMock) SetInflationDestination(ctx context.Context, tc *TestContext, signedTx string) error {
	unpackedTx, _, err := unpackTx(signedTx)
	if err != nil {
		return err
	}

	accountID := stellar1.AccountID(unpackedTx.Tx.SourceAccount.Address())
	account, ok := r.accounts[accountID]
	require.True(tc.T, ok)
	require.True(tc.T, account.availableBalance() != "0", "inflation on empty account won't work")

	require.Len(tc.T, unpackedTx.Tx.Operations, 1)
	op := unpackedTx.Tx.Operations[0]
	require.Nil(tc.T, op.SourceAccount)
	require.Equal(tc.T, xdr.OperationTypeSetOptions, op.Body.Type)
	setOpt, ok := op.Body.GetSetOptionsOp()
	require.True(tc.T, ok)
	require.NotNil(tc.T, setOpt.InflationDest)

	require.NotNil(tc.T, unpackedTx.Tx.TimeBounds, "We are expecting TimeBounds in all txs")
	if unpackedTx.Tx.TimeBounds != nil {
		require.NotZero(tc.T, unpackedTx.Tx.TimeBounds.MaxTime, "We are expecting non-zero TimeBounds.MaxTime in all txs")
		require.True(tc.T, time.Now().Before(time.Unix(int64(unpackedTx.Tx.TimeBounds.MaxTime), 0)))
		// We always send MinTime=0 but this assertion should still hold.
		require.True(tc.T, time.Now().After(time.Unix(int64(unpackedTx.Tx.TimeBounds.MinTime), 0)))
	}

	account.inflationDest = stellar1.AccountID(setOpt.InflationDest.Address())

	tc.T.Logf("BackendMock set inflation destination of %q to %q", accountID, account.inflationDest)
	return nil
}

func (r *BackendMock) GetInflationDestinations(ctx context.Context, tc *TestContext) ([]stellar1.PredefinedInflationDestination, error) {
	// Call into real server for integration testing.
	return remote.GetInflationDestinations(ctx, tc.G)
}

func (r *BackendMock) ChangeTrustline(ctx context.Context, tc *TestContext, signedTx string) error {
	unpackedTx, _, err := unpackTx(signedTx)
	if err != nil {
		return err
	}

	accountID := stellar1.AccountID(unpackedTx.Tx.SourceAccount.Address())
	account, ok := r.accounts[accountID]
	require.True(tc.T, ok)

	require.Len(tc.T, unpackedTx.Tx.Operations, 1)
	op := unpackedTx.Tx.Operations[0]
	require.Nil(tc.T, op.SourceAccount)
	require.Equal(tc.T, xdr.OperationTypeChangeTrust, op.Body.Type)
	setOpt, ok := op.Body.GetChangeTrustOp()
	require.True(tc.T, ok)

	if setOpt.Limit == 0 {
		// Removing a trustline.
		var found bool
		for i, bal := range account.otherBalances {
			if bal.Asset.String() == setOpt.Line.String() {
				copy(account.otherBalances[i:], account.otherBalances[i+1:])
				account.otherBalances = account.otherBalances[:len(account.otherBalances)-1]
				found = true
				break
			}
		}
		if !found {
			return fmt.Errorf("invalid limit=0, trustline not found in account")
		}
		tc.T.Logf("BackendMock set limit removed trustline %s for account  %s", setOpt.Line.String(), accountID)
	} else {
		limitStr := stellarnet.StringFromStellarAmount(int64(setOpt.Limit))
		var found bool
		for i, bal := range account.otherBalances {
			if bal.Asset.String() == setOpt.Line.String() {
				account.otherBalances[i].Limit = limitStr
				found = true
				break
			}
		}

		if found {
			tc.T.Logf("BackendMock set limit changed trustline %s limit to %s for account %s",
				setOpt.Line.String(), limitStr, accountID)
		} else {
			var t, c, i string
			if err := setOpt.Line.Extract(&t, &c, &i); err != nil {
				return err
			}
			account.otherBalances = append(account.otherBalances, stellar1.Balance{
				Asset: stellar1.Asset{
					Type:   t,
					Code:   c,
					Issuer: i,
				},
				Limit:        limitStr,
				Amount:       stellarnet.StringFromStellarAmount(0),
				IsAuthorized: true,
			})
			tc.T.Logf("BackendMock set limit added trustline %s with limit %s for account %s",
				setOpt.Line.String(), limitStr, accountID)
		}
	}

	return nil
}

// Friendbot sends someone XLM
func (r *BackendMock) Gift(accountID stellar1.AccountID, amount string) {
	r.Lock()
	defer r.Unlock()
	require.NotNil(r.T, r.accounts[accountID], "account for gift")
	amt, err := stellarnet.ParseStellarAmount(amount)
	require.NoError(r.T, err)
	r.accounts[accountID].AdjustBalance(amt)
}

func (r *BackendMock) CreateFakeAsset(code string) stellar1.Asset {
	full, err := keypair.Random()
	require.NoError(r.T, err)
	assetType, err := stellar1.CreateNonNativeAssetType(code)
	require.NoError(r.T, err)
	return stellar1.Asset{
		Type:   assetType,
		Code:   code,
		Issuer: full.Address(),
	}
}

func (r *BackendMock) AllAccountIDs(uid keybase1.UID) []stellar1.AccountID {
	r.Lock()
	defer r.Unlock()

	return r.userAccounts[uid]
}

func randomKeybaseTransactionID(t testing.TB) stellar1.KeybaseTransactionID {
	b, err := libkb.RandBytesWithSuffix(stellar1.KeybaseTransactionIDLen, stellar1.KeybaseTransactionIDSuffix)
	require.NoError(t, err)
	res, err := stellar1.KeybaseTransactionIDFromString(hex.EncodeToString(b))
	require.NoError(t, err)
	return res
}

func extractMemo(tx xdr.Transaction) (memo, memoType string) {
	switch tx.Memo.Type {
	case xdr.MemoTypeMemoNone:
		return "", "none"
	case xdr.MemoTypeMemoText:
		return tx.Memo.MustText(), "text"
	case xdr.MemoTypeMemoId:
		return fmt.Sprintf("%d", tx.Memo.MustId()), "id"
	case xdr.MemoTypeMemoHash:
		h := tx.Memo.MustHash()
		return base64.StdEncoding.EncodeToString(h[:]), "hash"
	case xdr.MemoTypeMemoReturn:
		h := tx.Memo.MustRetHash()
		return base64.StdEncoding.EncodeToString(h[:]), "return"
	default:
		panic(fmt.Errorf("invalid memo type: %v", tx.Memo.Type))
	}
}
