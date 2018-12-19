package stellar

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/golang/groupcache/singleflight"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
)

// ErrAccountNotFound is returned when the account is not in
// WalletState's accounts map.
var ErrAccountNotFound = errors.New("account not found for user")

// WalletState holds all the current data for all the accounts
// for the user.  It is also a remote.Remoter and should be used
// in place of it so network calls can be avoided.
type WalletState struct {
	libkb.Contextified
	remote.Remoter
	accounts     map[stellar1.AccountID]*AccountState
	rates        map[string]rateEntry
	refreshGroup *singleflight.Group
	refreshReqs  chan stellar1.AccountID
	refreshCount int
	rateGroup    *singleflight.Group
	shutdownOnce sync.Once
	sync.Mutex
}

// NewWalletState creates a wallet state with a remoter that will be
// used for any network calls.
func NewWalletState(g *libkb.GlobalContext, r remote.Remoter) *WalletState {
	ws := &WalletState{
		Contextified: libkb.NewContextified(g),
		Remoter:      r,
		accounts:     make(map[stellar1.AccountID]*AccountState),
		rates:        make(map[string]rateEntry),
		refreshGroup: &singleflight.Group{},
		refreshReqs:  make(chan stellar1.AccountID, 100),
		rateGroup:    &singleflight.Group{},
	}

	g.PushShutdownHook(ws.Shutdown)

	go ws.backgroundRefresh()

	return ws
}

func (w *WalletState) Shutdown() error {
	w.shutdownOnce.Do(func() {
		mctx := libkb.NewMetaContextBackground(w.G())
		mctx.CDebugf("WalletState shutting down")
		close(w.refreshReqs)
		w.Reset(mctx)
		mctx.CDebugf("WalletState shut down complete")
	})
	return nil
}

// accountState returns the AccountState object for an accountID.
// If it doesn't exist in `accounts`, it will return nil, false.
func (w *WalletState) accountState(accountID stellar1.AccountID) (*AccountState, bool) {
	w.Lock()
	defer w.Unlock()

	a, ok := w.accounts[accountID]
	return a, ok
}

// accountStateBuild returns the AccountState object for an accountID.
// If it doesn't exist in `accounts`, it will make an empty one and
// add it to `accounts` before returning it.
func (w *WalletState) accountStateBuild(accountID stellar1.AccountID) (account *AccountState, built bool) {
	w.Lock()
	defer w.Unlock()

	a, ok := w.accounts[accountID]
	if ok {
		return a, false
	}

	a = newAccountState(accountID, w.Remoter, w.refreshReqs)
	w.accounts[accountID] = a

	return a, true
}

// accountStateRefresh returns the AccountState object for an accountID.
// If it doesn't exist in `accounts`, it will make an empty one, add
// it to `accounts`, and refresh the data in it before returning.
func (w *WalletState) accountStateRefresh(ctx context.Context, accountID stellar1.AccountID, reason string) (*AccountState, error) {
	w.Lock()
	defer w.Unlock()

	a, ok := w.accounts[accountID]
	if ok {
		return a, nil
	}

	reason = "accountStateRefresh: " + reason
	a = newAccountState(accountID, w.Remoter, w.refreshReqs)
	mctx := libkb.NewMetaContext(ctx, w.G())
	if err := a.Refresh(mctx, w.G().NotifyRouter, reason); err != nil {
		mctx.CDebugf("error refreshing account %s: %s", accountID, err)
		return nil, err
	}
	w.accounts[accountID] = a

	return a, nil
}

// Primed returns true if the WalletState has been refreshed.
func (w *WalletState) Primed() bool {
	w.Lock()
	defer w.Unlock()
	return w.refreshCount > 0
}

// RefreshAll refreshes all the accounts.
func (w *WalletState) RefreshAll(mctx libkb.MetaContext, reason string) error {
	_, err := w.refreshGroup.Do("RefreshAll", func() (interface{}, error) {
		doErr := w.refreshAll(mctx, reason)
		return nil, doErr
	})
	return err
}

func (w *WalletState) refreshAll(mctx libkb.MetaContext, reason string) (err error) {
	defer mctx.CTraceTimed(fmt.Sprintf("WalletState.RefreshAll [%s]", reason), func() error { return err })()
	bundle, _, _, err := remote.FetchSecretlessBundle(mctx)
	if err != nil {
		return err
	}

	var lastErr error
	for _, account := range bundle.Accounts {
		a, _ := w.accountStateBuild(account.AccountID)
		a.updateEntry(account)
		if err := a.Refresh(mctx, w.G().NotifyRouter, reason); err != nil {
			mctx.CDebugf("error refreshing account %s: %s", account.AccountID, err)
			lastErr = err
		}
	}
	if lastErr != nil {
		mctx.CDebugf("RefreshAll last error: %s", lastErr)
		return lastErr
	}

	w.Lock()
	w.refreshCount++
	w.Unlock()

	return nil
}

// Refresh gets all the data from the server for an account.
func (w *WalletState) Refresh(mctx libkb.MetaContext, accountID stellar1.AccountID, reason string) error {
	a, ok := w.accountState(accountID)
	if !ok {
		return ErrAccountNotFound
	}
	return a.Refresh(mctx, w.G().NotifyRouter, reason)
}

// ForceSeqnoRefresh refreshes the seqno for an account.
func (w *WalletState) ForceSeqnoRefresh(mctx libkb.MetaContext, accountID stellar1.AccountID) error {
	a, ok := w.accountState(accountID)
	if !ok {
		return ErrAccountNotFound
	}
	return a.ForceSeqnoRefresh(mctx)
}

// backgroundRefresh gets any refresh requests and will refresh
// the account state if sufficient time has passed since the
// last refresh.
func (w *WalletState) backgroundRefresh() {
	for accountID := range w.refreshReqs {
		a, ok := w.accountState(accountID)
		if !ok {
			continue
		}
		a.RLock()
		rt := a.rtime
		a.RUnlock()

		mctx := libkb.NewMetaContextBackground(w.G())
		if time.Since(rt) < 1*time.Second {
			mctx.CDebugf("WalletState.backgroundRefresh skipping for %s due to recent refresh", accountID)
			continue
		}

		if err := a.Refresh(mctx, w.G().NotifyRouter, "background"); err != nil {
			mctx.CDebugf("WalletState.backgroundRefresh error for %s: %s", accountID, err)
		}
	}
}

// AccountSeqno is an override of remoter's AccountSeqno that uses
// the stored value.
func (w *WalletState) AccountSeqno(ctx context.Context, accountID stellar1.AccountID) (uint64, error) {
	a, err := w.accountStateRefresh(ctx, accountID, "AccountSeqno")
	if err != nil {
		return 0, err
	}

	return a.AccountSeqno(ctx)
}

// AccountSeqnoAndBump gets the current seqno for an account and increments
// the stored value.
func (w *WalletState) AccountSeqnoAndBump(ctx context.Context, accountID stellar1.AccountID) (uint64, error) {
	a, err := w.accountStateRefresh(ctx, accountID, "AccountSeqnoAndBump")
	if err != nil {
		return 0, err
	}
	return a.AccountSeqnoAndBump(ctx)
}

// Balances is an override of remoter's Balances that uses stored data.
func (w *WalletState) Balances(ctx context.Context, accountID stellar1.AccountID) ([]stellar1.Balance, error) {
	a, ok := w.accountState(accountID)
	if !ok {
		// Balances is used frequently to get balances for other users,
		// so if accountID isn't in WalletState, just use the remote
		// to get the balances.
		w.G().Log.CDebugf(ctx, "WalletState:Balances using remoter for %s", accountID)
		return w.Remoter.Balances(ctx, accountID)
	}

	w.G().Log.CDebugf(ctx, "WalletState:Balances using account state for %s", accountID)
	return a.Balances(ctx)
}

// Details is an override of remoter's Details that uses stored data.
func (w *WalletState) Details(ctx context.Context, accountID stellar1.AccountID) (stellar1.AccountDetails, error) {
	a, err := w.accountStateRefresh(ctx, accountID, "Details")
	if err != nil {
		return stellar1.AccountDetails{}, err
	}
	return a.Details(ctx)
}

// PendingPayments is an override of remoter's PendingPayments that uses stored data.
func (w *WalletState) PendingPayments(ctx context.Context, accountID stellar1.AccountID, limit int) ([]stellar1.PaymentSummary, error) {
	a, err := w.accountStateRefresh(ctx, accountID, "PendingPayments")
	if err != nil {
		return nil, err
	}
	payments, err := a.PendingPayments(ctx, limit)
	if err == nil {
		w.G().Log.CDebugf(ctx, "WalletState pending payments for %s: %d", accountID, len(payments))
	} else {
		w.G().Log.CDebugf(ctx, "WalletState pending payments error for %s: %s", accountID, err)

	}
	return payments, err
}

// RecentPayments is an override of remoter's RecentPayments that uses stored data.
func (w *WalletState) RecentPayments(ctx context.Context, accountID stellar1.AccountID, cursor *stellar1.PageCursor, limit int, skipPending bool) (stellar1.PaymentsPage, error) {
	useAccountState := true
	if limit != 0 && limit != 50 {
		useAccountState = false
	} else if cursor != nil {
		useAccountState = false
	} else if !skipPending {
		useAccountState = false
	}

	if !useAccountState {
		w.G().Log.CDebugf(ctx, "WalletState:RecentPayments using remote due to parameters")
		return w.Remoter.RecentPayments(ctx, accountID, cursor, limit, skipPending)
	}

	a, err := w.accountStateRefresh(ctx, accountID, "RecentPayments")
	if err != nil {
		return stellar1.PaymentsPage{}, err
	}

	return a.RecentPayments(ctx)
}

// SubmitRelayClaim is an override of remoter's SubmitRelayClaim.
func (w *WalletState) SubmitRelayClaim(ctx context.Context, post stellar1.RelayClaimPost) (stellar1.RelayClaimResult, error) {
	result, err := w.Remoter.SubmitRelayClaim(ctx, post)
	if err == nil {
		mctx := libkb.NewMetaContext(ctx, w.G())
		w.RefreshAll(mctx, "SubmitRelayClaim")
	}
	return result, err

}

// MarkAsRead is an override of remoter's MarkAsRead.
func (w *WalletState) MarkAsRead(ctx context.Context, accountID stellar1.AccountID, mostRecentID stellar1.TransactionID) error {
	err := w.Remoter.MarkAsRead(ctx, accountID, mostRecentID)
	mctx := libkb.NewMetaContext(ctx, w.G())
	w.Refresh(mctx, accountID, "MarkAsRead")
	return err
}

type rateEntry struct {
	currency string
	rate     stellar1.OutsideExchangeRate
	ctime    time.Time
}

// ExchangeRate is an overrider of remoter's ExchangeRate.
func (w *WalletState) ExchangeRate(ctx context.Context, currency string) (stellar1.OutsideExchangeRate, error) {
	w.Lock()
	existing, ok := w.rates[currency]
	w.Unlock()
	age := time.Since(existing.ctime)
	if ok && age < 1*time.Minute {
		w.G().Log.CDebugf(ctx, "using cached value for ExchangeRate(%s) => %+v (%s old)", currency, existing.rate, age)
		return existing.rate, nil
	}
	if ok {
		w.G().Log.CDebugf(ctx, "skipping cache for ExchangeRate(%s) because too old (%s)", currency, age)
	}
	w.G().Log.CDebugf(ctx, "ExchangeRate(%s) using remote", currency)

	rateRes, err := w.rateGroup.Do(currency, func() (interface{}, error) {
		return w.Remoter.ExchangeRate(ctx, currency)
	})
	rate, ok := rateRes.(stellar1.OutsideExchangeRate)
	if !ok {
		return stellar1.OutsideExchangeRate{}, errors.New("invalid cast")
	}

	if err == nil {
		w.Lock()
		w.rates[currency] = rateEntry{
			currency: currency,
			rate:     rate,
			ctime:    time.Now(),
		}
		w.Unlock()
		w.G().Log.CDebugf(ctx, "ExchangeRate(%s) => %+v, setting cache", currency, rate)
	}

	return rate, err
}

// DumpToLog outputs a summary of WalletState to the debug log.
func (w *WalletState) DumpToLog(mctx libkb.MetaContext) {
	mctx.CDebugf(w.String())
}

// String returns a string representation of WalletState suitable for debug
// logging.
func (w *WalletState) String() string {
	w.Lock()
	defer w.Unlock()
	var pieces []string
	for _, acctState := range w.accounts {
		pieces = append(pieces, acctState.String())
	}

	return fmt.Sprintf("WalletState (# accts: %d): %s", len(w.accounts), strings.Join(pieces, ", "))
}

// Reset clears all the data in the WalletState.
func (w *WalletState) Reset(mctx libkb.MetaContext) {
	w.Lock()
	defer w.Unlock()

	for _, a := range w.accounts {
		a.Reset(mctx)
	}

	w.accounts = make(map[stellar1.AccountID]*AccountState)
}

// AccountState holds the current data for a stellar account.
type AccountState struct {
	// these are only set when AccountState created, they never change
	accountID    stellar1.AccountID
	remoter      remote.Remoter
	refreshGroup *singleflight.Group
	refreshReqs  chan stellar1.AccountID

	sync.RWMutex // protects everything that follows
	seqno        uint64
	isPrimary    bool
	name         string
	balances     []stellar1.Balance
	details      *stellar1.AccountDetails
	pending      []stellar1.PaymentSummary
	recent       *stellar1.PaymentsPage
	rtime        time.Time // time of last refresh
}

func newAccountState(accountID stellar1.AccountID, r remote.Remoter, reqsCh chan stellar1.AccountID) *AccountState {
	return &AccountState{
		accountID:    accountID,
		remoter:      r,
		refreshGroup: &singleflight.Group{},
		refreshReqs:  reqsCh,
	}
}

// Refresh updates all the data for this account from the server.
func (a *AccountState) Refresh(mctx libkb.MetaContext, router *libkb.NotifyRouter, reason string) error {
	_, err := a.refreshGroup.Do("Refresh", func() (interface{}, error) {
		doErr := a.refresh(mctx, router, reason)
		return nil, doErr
	})
	return err
}

func (a *AccountState) refresh(mctx libkb.MetaContext, router *libkb.NotifyRouter, reason string) (err error) {
	defer mctx.CTraceTimed(fmt.Sprintf("WalletState.Refresh(%s) [%s]", a.accountID, reason), func() error { return err })()

	seqno, err := a.remoter.AccountSeqno(mctx.Ctx(), a.accountID)
	if err == nil {
		a.Lock()
		if seqno > a.seqno {
			a.seqno = seqno
		}
		a.Unlock()
	}

	balances, err := a.remoter.Balances(mctx.Ctx(), a.accountID)
	if err == nil {
		a.Lock()
		a.balances = balances
		a.Unlock()
	}

	details, err := a.remoter.Details(mctx.Ctx(), a.accountID)
	if err == nil {
		a.Lock()
		notify := detailsChanged(a.details, &details)
		a.details = &details
		// get these while locked
		isPrimary := a.isPrimary
		name := a.name
		a.Unlock()

		if notify && router != nil {
			accountLocal, err := AccountDetailsToWalletAccountLocal(mctx, details, isPrimary, name)
			if err == nil {
				router.HandleWalletAccountDetailsUpdate(mctx.Ctx(), a.accountID, accountLocal)
			}
		}
		if notify {
			getGlobal(mctx.G()).UpdateUnreadCount(mctx.Ctx(), a.accountID, details.UnreadPayments)
		}
	}

	pending, err := a.remoter.PendingPayments(mctx.Ctx(), a.accountID, 25)
	if err == nil {
		a.Lock()
		notify := pendingChanged(a.pending, pending)
		a.pending = pending
		a.Unlock()

		if notify && router != nil {
			local, err := RemotePendingToLocal(mctx, a.remoter, a.accountID, pending)
			if err == nil {
				router.HandleWalletPendingPaymentsUpdate(mctx.Ctx(), a.accountID, local)
			}
		}
	}

	recent, err := a.remoter.RecentPayments(mctx.Ctx(), a.accountID, nil, 50, true)
	if err == nil {
		a.Lock()
		notify := recentChanged(a.recent, &recent)
		a.recent = &recent
		a.Unlock()

		if notify && router != nil {
			localPage, err := RemoteRecentPaymentsToPage(mctx, a.remoter, a.accountID, recent)
			if err == nil {
				router.HandleWalletRecentPaymentsUpdate(mctx.Ctx(), a.accountID, localPage)
			}
		}
	}

	a.Lock()
	a.rtime = time.Now()
	a.Unlock()

	return err
}

// ForceSeqnoRefresh refreshes the seqno for an account.
func (a *AccountState) ForceSeqnoRefresh(mctx libkb.MetaContext) error {
	seqno, err := a.remoter.AccountSeqno(mctx.Ctx(), a.accountID)
	if err == nil {
		a.Lock()
		if seqno != a.seqno {
			mctx.CDebugf("ForceSeqnoRefresh updated seqno for %s: %d => %d", a.accountID, a.seqno, seqno)
			a.seqno = seqno
		} else {
			mctx.CDebugf("ForceSeqnoRefresh did not update AccountState for %s (existing: %d, remote: %d)", a.accountID, a.seqno, seqno)
		}
		a.Unlock()
	}
	return err
}

// AccountSeqno returns the seqno that has already been fetched for
// this account.
func (a *AccountState) AccountSeqno(ctx context.Context) (uint64, error) {
	a.RLock()
	defer a.RUnlock()
	return a.seqno, nil
}

// AccountSeqnoAndBump returns the seqno that has already been fetched for
// this account.  It bumps the seqno up by one.
func (a *AccountState) AccountSeqnoAndBump(ctx context.Context) (uint64, error) {
	a.Lock()
	defer a.Unlock()
	result := a.seqno
	a.seqno++
	return result, nil
}

// Balances returns the balances that have already been fetched for
// this account.
func (a *AccountState) Balances(ctx context.Context) ([]stellar1.Balance, error) {
	a.RLock()
	defer a.RUnlock()
	a.refreshReqs <- a.accountID
	return a.balances, nil
}

// Details returns the account details that have already been fetched for this account.
func (a *AccountState) Details(ctx context.Context) (stellar1.AccountDetails, error) {
	a.RLock()
	defer a.RUnlock()
	a.refreshReqs <- a.accountID
	if a.details == nil {
		return stellar1.AccountDetails{}, nil
	}
	return *a.details, nil
}

// PendingPayments returns the pending payments that have already been fetched for
// this account.
func (a *AccountState) PendingPayments(ctx context.Context, limit int) ([]stellar1.PaymentSummary, error) {
	a.RLock()
	defer a.RUnlock()
	a.refreshReqs <- a.accountID
	if limit > 0 && limit < len(a.pending) {
		return a.pending[:limit], nil
	}
	return a.pending, nil
}

// RecentPayments returns the recent payments that have already been fetched for
// this account.
func (a *AccountState) RecentPayments(ctx context.Context) (stellar1.PaymentsPage, error) {
	a.RLock()
	defer a.RUnlock()
	a.refreshReqs <- a.accountID
	if a.recent == nil {
		return stellar1.PaymentsPage{}, nil
	}
	return *a.recent, nil
}

// Reset sets the refreshReqs channel to nil so nothing will be put on it.
func (a *AccountState) Reset(mctx libkb.MetaContext) {
	a.Lock()
	defer a.Unlock()

	a.refreshReqs = nil
}

// String returns a small string representation of AccountState suitable for
// debug logging.
func (a *AccountState) String() string {
	a.RLock()
	defer a.RUnlock()
	if a.recent != nil {
		return fmt.Sprintf("%s (seqno: %d, balances: %d, pending: %d, payments: %d)", a.accountID, a.seqno, len(a.balances), len(a.pending), len(a.recent.Payments))
	}
	return fmt.Sprintf("%s (seqno: %d, balances: %d, pending: %d, payments: nil)", a.accountID, a.seqno, len(a.balances), len(a.pending))
}

func (a *AccountState) updateEntry(entry stellar1.BundleEntryRestricted) {
	a.Lock()
	defer a.Unlock()

	a.isPrimary = entry.IsPrimary
	a.name = entry.Name
}

func detailsChanged(a, b *stellar1.AccountDetails) bool {
	if a == nil && b == nil {
		return false
	}
	if a == nil && b != nil {
		return true
	}
	if a.Seqno != b.Seqno {
		return true
	}
	if a.UnreadPayments != b.UnreadPayments {
		return true
	}
	if a.Available != b.Available {
		return true
	}
	if a.ReadTransactionID != nil && b.ReadTransactionID != nil {
		if *a.ReadTransactionID != *b.ReadTransactionID {
			return true
		}
	}
	if a.SubentryCount != b.SubentryCount {
		return true
	}
	if a.DisplayCurrency != b.DisplayCurrency {
		return true
	}
	if len(a.Balances) != len(b.Balances) {
		return true
	}
	for i := 0; i < len(a.Balances); i++ {
		if a.Balances[i] != b.Balances[i] {
			return true
		}
	}
	if len(a.Reserves) != len(b.Reserves) {
		return true
	}
	for i := 0; i < len(a.Reserves); i++ {
		if a.Reserves[i] != b.Reserves[i] {
			return true
		}
	}
	return false
}

func pendingChanged(a, b []stellar1.PaymentSummary) bool {
	if len(a) != len(b) {
		return true
	}
	if len(a) == 0 {
		return false
	}

	for i := 0; i < len(a); i++ {
		atxid, err := a[i].TransactionID()
		if err != nil {
			return true
		}
		btxid, err := b[i].TransactionID()
		if err != nil {
			return true
		}
		if atxid != btxid {
			return true
		}

		astatus, err := a[i].TransactionStatus()
		if err != nil {
			return true
		}
		bstatus, err := b[i].TransactionStatus()
		if err != nil {
			return true
		}

		if astatus != bstatus {
			return true
		}
	}

	return false
}

func recentChanged(a, b *stellar1.PaymentsPage) bool {
	if a == nil && b == nil {
		return false
	}
	if a == nil && b != nil {
		return true
	}
	if len(a.Payments) != len(b.Payments) {
		return true
	}
	if a.Cursor != nil && b.Cursor != nil {
		if *a.Cursor != *b.Cursor {
			return true
		}
	}
	if len(a.Payments) == 0 {
		return false
	}
	existing, err := a.Payments[0].TransactionID()
	if err == nil {
		next, err := b.Payments[0].TransactionID()
		if err == nil {
			if existing != next {
				return true
			}
		}
	}
	return false
}
