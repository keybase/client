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
	sync.Mutex
}

// NewWalletState creates a wallet state with a remoter that will be
// used for any network calls.
func NewWalletState(g *libkb.GlobalContext, r remote.Remoter) *WalletState {
	return &WalletState{
		Contextified: libkb.NewContextified(g),
		Remoter:      r,
		accounts:     make(map[stellar1.AccountID]*AccountState),
		rates:        make(map[string]rateEntry),
		refreshGroup: &singleflight.Group{},
	}
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

	a = newAccountState(accountID, w.Remoter)
	w.accounts[accountID] = a

	return a, true
}

// accountStateRefresh returns the AccountState object for an accountID.
// If it doesn't exist in `accounts`, it will make an empty one, add
// it to `accounts`, and refresh the data in it before returning.
func (w *WalletState) accountStateRefresh(ctx context.Context, accountID stellar1.AccountID) (*AccountState, error) {
	w.Lock()
	defer w.Unlock()

	a, ok := w.accounts[accountID]
	if ok {
		return a, nil
	}

	a = newAccountState(accountID, w.Remoter)
	if err := a.Refresh(ctx, w.G(), w.G().NotifyRouter); err != nil {
		w.G().Log.CDebugf(ctx, "error refreshing account %s: %s", accountID, err)
		return nil, err
	}
	w.accounts[accountID] = a

	return a, nil
}

// RefreshAll refreshes all the accounts.
func (w *WalletState) RefreshAll(ctx context.Context) error {
	_, err := w.refreshGroup.Do("RefreshAll", func() (interface{}, error) {
		doErr := w.refreshAll(ctx)
		return nil, doErr
	})
	return err
}

func (w *WalletState) refreshAll(ctx context.Context) error {
	bundle, _, _, err := remote.FetchSecretlessBundle(ctx, w.G())
	if err != nil {
		return err
	}

	var lastErr error
	for _, account := range bundle.Accounts {
		a, _ := w.accountStateBuild(account.AccountID)
		w.G().Log.CDebugf(ctx, "Refresh %s", account.AccountID)
		if err := a.Refresh(ctx, w.G(), w.G().NotifyRouter); err != nil {
			w.G().Log.CDebugf(ctx, "error refreshing account %s: %s", account.AccountID, err)
			lastErr = err
		}
	}
	if lastErr != nil {
		w.G().Log.CDebugf(ctx, "RefreshAll last error: %s", lastErr)
		return lastErr
	}

	w.G().Log.CDebugf(ctx, "RefreshAll success")
	w.DumpToLog(ctx)

	return nil
}

// Refresh gets all the data from the server for an account.
func (w *WalletState) Refresh(ctx context.Context, accountID stellar1.AccountID) error {
	defer w.DumpToLog(ctx)
	w.G().Log.CDebugf(ctx, "WalletState.Refresh: %s", accountID)
	a, ok := w.accountState(accountID)
	if !ok {
		return ErrAccountNotFound
	}
	return a.Refresh(ctx, w.G(), w.G().NotifyRouter)
}

// AccountSeqno is an override of remoter's AccountSeqno that uses
// the stored value.
func (w *WalletState) AccountSeqno(ctx context.Context, accountID stellar1.AccountID) (uint64, error) {
	a, err := w.accountStateRefresh(ctx, accountID)
	if err != nil {
		return 0, err
	}

	return a.AccountSeqno(ctx)
}

// AccountSeqnoAndBump gets the current seqno for an account and increments
// the stored value.
func (w *WalletState) AccountSeqnoAndBump(ctx context.Context, accountID stellar1.AccountID) (uint64, error) {
	a, err := w.accountStateRefresh(ctx, accountID)
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
	a, err := w.accountStateRefresh(ctx, accountID)
	if err != nil {
		return stellar1.AccountDetails{}, err
	}
	return a.Details(ctx)
}

// PendingPayments is an override of remoter's PendingPayments that uses stored data.
func (w *WalletState) PendingPayments(ctx context.Context, accountID stellar1.AccountID, limit int) ([]stellar1.PaymentSummary, error) {
	a, err := w.accountStateRefresh(ctx, accountID)
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

	a, err := w.accountStateRefresh(ctx, accountID)
	if err != nil {
		return stellar1.PaymentsPage{}, err
	}

	return a.RecentPayments(ctx)
}

// SubmitPayment is an override of remoter's SubmitPayment.
func (w *WalletState) SubmitPayment(ctx context.Context, post stellar1.PaymentDirectPost) (stellar1.PaymentResult, error) {
	result, err := w.Remoter.SubmitPayment(ctx, post)
	if err == nil {
		w.RefreshAll(ctx)
	}
	return result, err
}

// SubmitRelayPayment is an override of remoter's SubmitRelayPayment.
func (w *WalletState) SubmitRelayPayment(ctx context.Context, post stellar1.PaymentRelayPost) (stellar1.PaymentResult, error) {
	result, err := w.Remoter.SubmitRelayPayment(ctx, post)
	if err == nil {
		w.RefreshAll(ctx)
	}
	return result, err
}

// SubmitRelayClaim is an override of remoter's SubmitRelayClaim.
func (w *WalletState) SubmitRelayClaim(ctx context.Context, post stellar1.RelayClaimPost) (stellar1.RelayClaimResult, error) {
	result, err := w.Remoter.SubmitRelayClaim(ctx, post)
	if err == nil {
		w.RefreshAll(ctx)
	}
	return result, err

}

// MarkAsRead is an override of remoter's MarkAsRead.
func (w *WalletState) MarkAsRead(ctx context.Context, accountID stellar1.AccountID, mostRecentID stellar1.TransactionID) error {
	err := w.Remoter.MarkAsRead(ctx, accountID, mostRecentID)
	w.Refresh(ctx, accountID)
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
	if ok && time.Since(existing.ctime) < 10*time.Second {
		return existing.rate, nil
	}
	rate, err := w.Remoter.ExchangeRate(ctx, currency)
	if err == nil {
		w.Lock()
		w.rates[currency] = rateEntry{
			currency: currency,
			rate:     rate,
			ctime:    time.Now(),
		}
		w.Unlock()
	}

	return rate, err
}

// DumpToLog outputs a summary of WalletState to the debug log.
func (w *WalletState) DumpToLog(ctx context.Context) {
	w.G().Log.CDebugf(ctx, w.String())
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
func (w *WalletState) Reset(ctx context.Context) {
	w.Lock()
	defer w.Unlock()

	w.G().Log.CDebugf(ctx, "WalletState: Reset clearing all account state")
	w.accounts = make(map[stellar1.AccountID]*AccountState)
}

// AccountState holds the current data for a stellar account.
type AccountState struct {
	// these are only set when AccountState created, they never change
	accountID    stellar1.AccountID
	remoter      remote.Remoter
	refreshGroup *singleflight.Group

	sync.RWMutex // protects everything that follows
	seqno        uint64
	balances     []stellar1.Balance
	details      *stellar1.AccountDetails
	pending      []stellar1.PaymentSummary
	recent       *stellar1.PaymentsPage
}

func newAccountState(accountID stellar1.AccountID, r remote.Remoter) *AccountState {
	return &AccountState{
		accountID:    accountID,
		remoter:      r,
		refreshGroup: &singleflight.Group{},
	}
}

// Refresh updates all the data for this account from the server.
func (a *AccountState) Refresh(ctx context.Context, g *libkb.GlobalContext, router *libkb.NotifyRouter) error {
	_, err := a.refreshGroup.Do("Refresh", func() (interface{}, error) {
		doErr := a.refresh(ctx, g, router)
		return nil, doErr
	})
	return err
}

func (a *AccountState) refresh(ctx context.Context, g *libkb.GlobalContext, router *libkb.NotifyRouter) error {
	seqno, err := a.remoter.AccountSeqno(ctx, a.accountID)
	if err == nil {
		a.Lock()
		if seqno > a.seqno {
			a.seqno = seqno
		}
		a.Unlock()
	}

	balances, err := a.remoter.Balances(ctx, a.accountID)
	if err == nil {
		a.Lock()
		a.balances = balances
		a.Unlock()
	}

	details, err := a.remoter.Details(ctx, a.accountID)
	if err == nil {
		a.Lock()
		notify := detailsChanged(a.details, &details)
		a.details = &details
		a.Unlock()

		if notify && router != nil {
			router.HandleWalletAccountDetailsUpdate(ctx, a.accountID, details)
		}
		if notify {
			getGlobal(g).UpdateUnreadCount(ctx, a.accountID, a.details.UnreadPayments)
		}
	}

	pending, err := a.remoter.PendingPayments(ctx, a.accountID, 25)
	if err == nil {
		a.Lock()
		notify := pendingChanged(a.pending, pending)
		a.pending = pending
		a.Unlock()

		if notify && router != nil {
			router.HandleWalletPendingPaymentsUpdate(ctx, a.accountID, pending)
		}
	}

	recent, err := a.remoter.RecentPayments(ctx, a.accountID, nil, 50, true)
	if err == nil {
		a.Lock()
		notify := recentChanged(a.recent, &recent)
		a.recent = &recent
		a.Unlock()

		if notify && router != nil {
			router.HandleWalletRecentPaymentsUpdate(ctx, a.accountID, recent)
		}
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
	return a.balances, nil
}

// Details returns the account details that have already been fetched for this account.
func (a *AccountState) Details(ctx context.Context) (stellar1.AccountDetails, error) {
	a.RLock()
	defer a.RUnlock()
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
	if a.recent == nil {
		return stellar1.PaymentsPage{}, nil
	}
	return *a.recent, nil
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

	existing, err := a[0].TransactionID()
	if err == nil {
		next, err := b[0].TransactionID()
		if err == nil {
			if existing != next {
				return true
			}
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
