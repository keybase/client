package stellar

import (
	"context"
	"errors"
	"fmt"
	"strconv"
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

// ErrRefreshQueueFull is returned when the refresh queue
// is clogged up.
var ErrRefreshQueueFull = errors.New("refresh queue is full")

// WalletState holds all the current data for all the accounts
// for the user.  It is also a remote.Remoter and should be used
// in place of it so network calls can be avoided.
type WalletState struct {
	libkb.Contextified
	remote.Remoter
	accounts       map[stellar1.AccountID]*AccountState
	rates          map[string]rateEntry
	refreshGroup   *singleflight.Group
	refreshReqs    chan stellar1.AccountID
	refreshCount   int
	backgroundDone chan struct{}
	rateGroup      *singleflight.Group
	shutdownOnce   sync.Once
	sync.Mutex
	seqnoMu       sync.Mutex
	seqnoLockHeld bool
	options       *Options
	bkgCancelFn   context.CancelFunc
}

var _ remote.Remoter = (*WalletState)(nil)

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
		options:      NewOptions(),
	}

	g.PushShutdownHook(ws.Shutdown)

	ctx, cancelFn := context.WithCancel(context.TODO())
	ws.bkgCancelFn = cancelFn
	go ws.backgroundRefresh(ctx)

	return ws
}

// Shutdown terminates any background operations and cleans up.
func (w *WalletState) Shutdown() error {
	w.shutdownOnce.Do(func() {
		mctx := libkb.NewMetaContextBackground(w.G())
		mctx.Debug("WalletState shutting down")
		w.Lock()
		w.resetWithLock(mctx)
		close(w.refreshReqs)
		w.bkgCancelFn()
		mctx.Debug("waiting for background refresh requests to finish")
		select {
		case <-w.backgroundDone:
		case <-time.After(5 * time.Second):
			mctx.Debug("timed out waiting for background refresh requests to finish")
		}
		w.Unlock()
		mctx.Debug("WalletState shut down complete")
	})
	return nil
}

// SeqnoLock acquires a lock on seqno operations.  NewSeqnoProvider calls it.
// After all operations with a seqno provider are done (i.e. fully submitted
// to stellard), then the lock should be released with SeqnoUnlock.
func (w *WalletState) SeqnoLock() {
	w.seqnoMu.Lock()
	w.Lock()
	w.seqnoLockHeld = true
	w.Unlock()
}

// SeqnoUnlock releases the lock on seqno operations.
func (w *WalletState) SeqnoUnlock() {
	w.Lock()
	w.seqnoMu.Unlock()
	w.seqnoLockHeld = false
	w.Unlock()
}

// BaseFee returns stellard's current suggestion for the base operation fee.
func (w *WalletState) BaseFee(mctx libkb.MetaContext) uint64 {
	return w.options.BaseFee(mctx, w)
}

// AccountName returns the name for an account.
func (w *WalletState) AccountName(accountID stellar1.AccountID) (string, error) {
	a, ok := w.accountState(accountID)
	if !ok {
		return "", ErrAccountNotFound
	}

	a.RLock()
	defer a.RUnlock()

	return a.name, nil
}

// IsPrimary returns true if an account is the primary account for the user.
func (w *WalletState) IsPrimary(accountID stellar1.AccountID) (bool, error) {
	a, ok := w.accountState(accountID)
	if !ok {
		return false, ErrAccountNotFound
	}

	a.RLock()
	defer a.RUnlock()

	return a.isPrimary, nil
}

// AccountMode returns the mode of the account (USER or MOBILE).
// MOBILE accounts can only get access to the secret key from a mobile device.
func (w *WalletState) AccountMode(accountID stellar1.AccountID) (stellar1.AccountMode, error) {
	a, ok := w.accountState(accountID)
	if !ok {
		return stellar1.AccountMode_NONE, ErrAccountNotFound
	}

	a.RLock()
	defer a.RUnlock()

	return a.accountMode, nil
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
		mctx.Debug("error refreshing account %s: %s", accountID, err)
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

// UpdateAccountEntries gets the bundle from the server and updates the individual
// account entries with the server's bundle information.
func (w *WalletState) UpdateAccountEntries(mctx libkb.MetaContext, reason string) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("WalletState.UpdateAccountEntries [%s]", reason), func() error { return err })()

	bundle, err := remote.FetchSecretlessBundle(mctx)
	if err != nil {
		return err
	}

	return w.UpdateAccountEntriesWithBundle(mctx, reason, bundle)
}

// UpdateAccountEntriesWithBundle updates the individual account entries with the
// bundle information.
func (w *WalletState) UpdateAccountEntriesWithBundle(mctx libkb.MetaContext, reason string, bundle *stellar1.Bundle) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("WalletState.UpdateAccountEntriesWithBundle [%s]", reason), func() error { return err })()

	if bundle == nil {
		return errors.New("nil bundle")
	}

	active := make(map[stellar1.AccountID]bool)
	for _, account := range bundle.Accounts {
		a, _ := w.accountStateBuild(account.AccountID)
		a.updateEntry(account)
		active[account.AccountID] = true
	}

	// clean out any unusued accounts
	w.Lock()
	for accountID := range w.accounts {
		if active[accountID] {
			continue
		}
		delete(w.accounts, accountID)
	}
	w.Unlock()

	return nil
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
	defer mctx.TraceTimed(fmt.Sprintf("WalletState.RefreshAll [%s]", reason), func() error { return err })()
	bundle, err := remote.FetchSecretlessBundle(mctx)
	if err != nil {
		return err
	}

	var lastErr error
	for _, account := range bundle.Accounts {
		a, _ := w.accountStateBuild(account.AccountID)
		a.updateEntry(account)
		if err := a.Refresh(mctx, w.G().NotifyRouter, reason); err != nil {
			mctx.Debug("error refreshing account %s: %s", account.AccountID, err)
			lastErr = err
		}
	}
	if lastErr != nil {
		mctx.Debug("RefreshAll last error: %s", lastErr)
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

// RefreshAsync makes a request to refresh an account in the background.
// It clears the refresh time to ensure that a refresh happens/
func (w *WalletState) RefreshAsync(mctx libkb.MetaContext, accountID stellar1.AccountID, reason string) error {
	a, ok := w.accountState(accountID)
	if !ok {
		return ErrAccountNotFound
	}

	// if someone calls this, they need a refresh to happen, so make
	// sure that the next refresh for this accountID isn't skipped.
	a.Lock()
	a.rtime = time.Time{}
	a.Unlock()

	select {
	case w.refreshReqs <- accountID:
	case <-time.After(200 * time.Millisecond):
		// don't wait for full channel
		mctx.Debug("refreshReqs channel clogged trying to enqueue %s for %q", accountID, reason)
		return ErrRefreshQueueFull
	}

	return nil
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
func (w *WalletState) backgroundRefresh(ctx context.Context) {
	w.backgroundDone = make(chan struct{})
	for accountID := range w.refreshReqs {
		a, ok := w.accountState(accountID)
		if !ok {
			continue
		}
		a.RLock()
		rt := a.rtime
		a.RUnlock()

		mctx := libkb.NewMetaContext(ctx, w.G()).WithLogTag("WABR")
		if time.Since(rt) < 120*time.Second {
			mctx.Debug("WalletState.backgroundRefresh skipping for %s due to recent refresh", accountID)
			continue
		}

		if err := a.Refresh(mctx, w.G().NotifyRouter, "background"); err != nil {
			mctx.Debug("WalletState.backgroundRefresh error for %s: %s", accountID, err)
		}
	}
	close(w.backgroundDone)
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
	w.Lock()
	hasSeqnoLock := w.seqnoLockHeld
	w.Unlock()
	if !hasSeqnoLock {
		return 0, errors.New("you must hold SeqnoLock() before AccountSeqnoAndBump")
	}
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
	details, err := a.Details(ctx)
	if err == nil && details.AccountID != accountID {
		w.G().Log.CDebugf(ctx, "WalletState:Details account id mismatch.  returning %+v for account id %q", details, accountID)
	}
	return details, err
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
func (w *WalletState) RecentPayments(ctx context.Context, arg remote.RecentPaymentsArg) (stellar1.PaymentsPage, error) {
	useAccountState := true
	switch {
	case arg.Limit != 0 && arg.Limit != 50:
		useAccountState = false
	case arg.Cursor != nil:
		useAccountState = false
	case !arg.SkipPending:
		useAccountState = false
	}

	if !useAccountState {
		w.G().Log.CDebugf(ctx, "WalletState:RecentPayments using remote due to parameters")
		return w.Remoter.RecentPayments(ctx, arg)
	}

	a, err := w.accountStateRefresh(ctx, arg.AccountID, "RecentPayments")
	if err != nil {
		return stellar1.PaymentsPage{}, err
	}

	return a.RecentPayments(ctx)
}

// AddPendingTx adds information about a tx that was submitted to the network.
// This allows WalletState to keep track of anything pending when managing
// the account seqno.
func (w *WalletState) AddPendingTx(ctx context.Context, accountID stellar1.AccountID, txID stellar1.TransactionID, seqno uint64) error {
	a, ok := w.accountState(accountID)
	if !ok {
		return fmt.Errorf("AddPendingTx: account id %q not in wallet state", accountID)
	}

	w.G().Log.CDebugf(ctx, "WalletState: account %s adding pending tx %s/%d", accountID, txID, seqno)

	return a.AddPendingTx(ctx, txID, seqno)
}

// RemovePendingTx removes a pending tx from WalletState.  It doesn't matter
// if it succeeded or failed, just that it is done.
func (w *WalletState) RemovePendingTx(ctx context.Context, accountID stellar1.AccountID, txID stellar1.TransactionID) error {
	a, ok := w.accountState(accountID)
	if !ok {
		return fmt.Errorf("RemovePendingTx: account id %q not in wallet state", accountID)
	}

	w.G().Log.CDebugf(ctx, "WalletState: account %s removing pending tx %s", accountID, txID)

	return a.RemovePendingTx(ctx, txID)
}

// SubmitPayment is an override of remoter's SubmitPayment.
func (w *WalletState) SubmitPayment(ctx context.Context, post stellar1.PaymentDirectPost) (stellar1.PaymentResult, error) {
	w.Lock()
	hasSeqnoLock := w.seqnoLockHeld
	w.Unlock()
	if !hasSeqnoLock {
		return stellar1.PaymentResult{}, errors.New("you must hold SeqnoLock() before SubmitPayment")
	}
	return w.Remoter.SubmitPayment(ctx, post)
}

// SubmitRelayPayment is an override of remoter's SubmitRelayPayment.
func (w *WalletState) SubmitRelayPayment(ctx context.Context, post stellar1.PaymentRelayPost) (stellar1.PaymentResult, error) {
	w.Lock()
	hasSeqnoLock := w.seqnoLockHeld
	w.Unlock()
	if !hasSeqnoLock {
		return stellar1.PaymentResult{}, errors.New("you must hold SeqnoLock() before SubmitRelayPayment")
	}
	return w.Remoter.SubmitRelayPayment(ctx, post)
}

// SubmitRelayClaim is an override of remoter's SubmitRelayClaim.
func (w *WalletState) SubmitRelayClaim(ctx context.Context, post stellar1.RelayClaimPost) (stellar1.RelayClaimResult, error) {
	w.Lock()
	hasSeqnoLock := w.seqnoLockHeld
	w.Unlock()
	if !hasSeqnoLock {
		return stellar1.RelayClaimResult{}, errors.New("you must hold SeqnoLock() before SubmitRelayClaim")
	}
	result, err := w.Remoter.SubmitRelayClaim(ctx, post)
	if err == nil {
		mctx := libkb.NewMetaContext(ctx, w.G())
		if rerr := w.RefreshAll(mctx, "SubmitRelayClaim"); rerr != nil {
			mctx.Debug("RefreshAll after SubmitRelayClaim error: %s", rerr)
		}
	}
	return result, err

}

// MarkAsRead is an override of remoter's MarkAsRead.
func (w *WalletState) MarkAsRead(ctx context.Context, accountID stellar1.AccountID, mostRecentID stellar1.TransactionID) error {
	err := w.Remoter.MarkAsRead(ctx, accountID, mostRecentID)
	if err == nil {
		mctx := libkb.NewMetaContext(ctx, w.G())
		if rerr := w.RefreshAsync(mctx, accountID, "MarkAsRead"); rerr != nil {
			mctx.Debug("Refresh after MarkAsRead error: %s", err)
		}
	}
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
	mctx.Debug(w.String())
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
	w.resetWithLock(mctx)
}

// resetWithLock can only be called after w.Lock().
func (w *WalletState) resetWithLock(mctx libkb.MetaContext) {
	for _, a := range w.accounts {
		a.Reset(mctx)
	}

	w.accounts = make(map[stellar1.AccountID]*AccountState)
}

type txPending struct {
	seqno uint64
	ctime time.Time
}

type inuseSeqno struct {
	ctime time.Time
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
	accountMode  stellar1.AccountMode
	balances     []stellar1.Balance
	details      *stellar1.AccountDetails
	pending      []stellar1.PaymentSummary
	recent       *stellar1.PaymentsPage
	rtime        time.Time // time of last refresh
	done         bool
	pendingTxs   map[stellar1.TransactionID]txPending
	inuseSeqnos  map[uint64]inuseSeqno
}

func newAccountState(accountID stellar1.AccountID, r remote.Remoter, reqsCh chan stellar1.AccountID) *AccountState {
	return &AccountState{
		accountID:    accountID,
		remoter:      r,
		refreshGroup: &singleflight.Group{},
		refreshReqs:  reqsCh,
		pendingTxs:   make(map[stellar1.TransactionID]txPending),
		inuseSeqnos:  make(map[uint64]inuseSeqno),
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
	defer mctx.TraceTimed(fmt.Sprintf("WalletState.Refresh(%s) [%s]", a.accountID, reason), func() error { return err })()

	dpp, err := a.remoter.DetailsPlusPayments(mctx.Ctx(), a.accountID)
	if err != nil {
		mctx.Debug("refresh DetailsPlusPayments error: %s", err)
		return err
	}

	var seqno uint64
	if dpp.Details.Seqno != "" {
		seqno, err = strconv.ParseUint(dpp.Details.Seqno, 10, 64)
		if err != nil {
			return err
		}
	}

	a.Lock()
	if seqno > a.seqno {
		a.seqno = seqno
	}

	a.balances = dpp.Details.Balances

	notifyDetails := detailsChanged(a.details, &dpp.Details)
	a.details = &dpp.Details

	notifyPending := pendingChanged(a.pending, dpp.PendingPayments)
	a.pending = dpp.PendingPayments

	notifyRecent := recentChanged(a.recent, &dpp.RecentPayments)
	a.recent = &dpp.RecentPayments

	// get these while locked
	isPrimary := a.isPrimary
	name := a.name
	accountMode := a.accountMode

	a.rtime = time.Now()

	a.Unlock()

	if notifyDetails && router != nil {
		accountLocal, err := AccountDetailsToWalletAccountLocal(mctx, a.accountID, dpp.Details, isPrimary, name, accountMode)
		if err == nil {
			router.HandleWalletAccountDetailsUpdate(mctx.Ctx(), a.accountID, accountLocal)
		} else {
			mctx.Debug("AccountDetailsToWalletAccountLocal error: %s", err)
		}
	}
	if notifyDetails {
		err = getGlobal(mctx.G()).UpdateUnreadCount(mctx.Ctx(), a.accountID, dpp.Details.UnreadPayments)
		if err != nil {
			mctx.Debug("UpdateUnreadCount error: %s", err)
		}
	}

	if notifyPending && router != nil {
		local, err := RemotePendingToLocal(mctx, a.remoter, a.accountID, dpp.PendingPayments)
		if err == nil {
			router.HandleWalletPendingPaymentsUpdate(mctx.Ctx(), a.accountID, local)
		} else {
			mctx.Debug("RemotePendingToLocal error: %s", err)
		}
	}

	if notifyRecent && router != nil {
		localPage, err := RemoteRecentPaymentsToPage(mctx, a.remoter, a.accountID, dpp.RecentPayments)
		if err == nil {
			router.HandleWalletRecentPaymentsUpdate(mctx.Ctx(), a.accountID, localPage)
		} else {
			mctx.Debug("RemoteRecentPaymentsToPage error: %s", err)
		}
	}

	return nil
}

// ForceSeqnoRefresh refreshes the seqno for an account.
func (a *AccountState) ForceSeqnoRefresh(mctx libkb.MetaContext) error {
	seqno, err := a.remoter.AccountSeqno(mctx.Ctx(), a.accountID)
	if err != nil {
		return err
	}

	a.Lock()
	defer a.Unlock()

	if seqno == a.seqno {
		mctx.Debug("ForceSeqnoRefresh did not update AccountState for %s (existing: %d, remote: %d)", a.accountID, a.seqno, seqno)
		return nil
	}

	if seqno > a.seqno {
		// if network is greater than cached, then update
		mctx.Debug("ForceSeqnoRefresh updated seqno for %s: %d => %d", a.accountID, a.seqno, seqno)
		a.seqno = seqno
		return nil
	}

	// delete any stale pending tx (in case missed notification somehow)
	for k, v := range a.pendingTxs {
		age := time.Since(v.ctime)
		if age > 30*time.Second {
			mctx.Debug("ForceSeqnoRefresh removing pending tx %s due to old age (%s)", k, age)
			delete(a.pendingTxs, k)
		}
	}

	// delete any stale inuse seqnos (in case missed notification somehow)
	for k, v := range a.inuseSeqnos {
		if seqno > k {
			mctx.Debug("ForceSeqnoRefresh removing inuse seqno %d due to network seqno > to it (%s)", k, seqno)
			delete(a.inuseSeqnos, k)
		}
		age := time.Since(v.ctime)
		if age > 30*time.Second {
			mctx.Debug("ForceSeqnoRefresh removing inuse seqno %d due to old age (%s)", k, age)
			delete(a.inuseSeqnos, k)
		}
	}

	if len(a.pendingTxs) == 0 && len(a.inuseSeqnos) == 0 {
		// if no pending tx or inuse seqnos, then network should be correct
		mctx.Debug("ForceSeqnoRefresh corrected seqno for %s: %d => %d", a.accountID, a.seqno, seqno)
		a.seqno = seqno
		return nil
	}

	mctx.Debug("ForceSeqnoRefresh did not update AccountState for %s due to pending tx/seqnos (existing: %d, remote: %d, pending txs: %d, inuse seqnos: %d)", a.accountID, a.seqno, seqno, len(a.pendingTxs), len(a.inuseSeqnos))

	return nil
}

// SeqnoDebug outputs some information about the seqno state.
func (a *AccountState) SeqnoDebug(mctx libkb.MetaContext) {
	mctx.Debug("SEQNO debug for %s: pending txs %d, inuse seqnos: %d", a.accountID, len(a.pendingTxs), len(a.inuseSeqnos))
	mctx.Debug("SEQNO debug for %s: inuse seqnos: %+v", a.accountID, a.inuseSeqnos)
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

	// need to keep track that we are going to use this seqno
	// in a tx.  This record keeping avoids a race where
	// multiple seqno providers rushing to use seqnos before
	// AddPendingTx is called.
	//
	// The "in use" seqno is result+1 since the transaction builders
	// add 1 to result when they make the transaction.
	a.inuseSeqnos[a.seqno] = inuseSeqno{ctime: time.Now()}

	return result, nil
}

// AddPendingTx adds information about a tx that was submitted to the network.
// This allows AccountState to keep track of anything pending when managing
// the account seqno.
func (a *AccountState) AddPendingTx(ctx context.Context, txID stellar1.TransactionID, seqno uint64) error {
	a.Lock()
	defer a.Unlock()

	// remove the inuse seqno since the pendingTx will track it now
	delete(a.inuseSeqnos, seqno)

	a.pendingTxs[txID] = txPending{seqno: seqno, ctime: time.Now()}

	return nil
}

// RemovePendingTx removes a pending tx from WalletState.  It doesn't matter
// if it succeeded or failed, just that it is done.
func (a *AccountState) RemovePendingTx(ctx context.Context, txID stellar1.TransactionID) error {
	a.Lock()
	defer a.Unlock()

	delete(a.pendingTxs, txID)

	return nil
}

// Balances returns the balances that have already been fetched for
// this account.
func (a *AccountState) Balances(ctx context.Context) ([]stellar1.Balance, error) {
	a.RLock()
	defer a.RUnlock()
	a.enqueueRefreshReq()
	return a.balances, nil
}

// Details returns the account details that have already been fetched for this account.
func (a *AccountState) Details(ctx context.Context) (stellar1.AccountDetails, error) {
	a.RLock()
	defer a.RUnlock()
	a.enqueueRefreshReq()
	if a.details == nil {
		return stellar1.AccountDetails{AccountID: a.accountID}, nil
	}
	return *a.details, nil
}

// PendingPayments returns the pending payments that have already been fetched for
// this account.
func (a *AccountState) PendingPayments(ctx context.Context, limit int) ([]stellar1.PaymentSummary, error) {
	a.RLock()
	defer a.RUnlock()
	a.enqueueRefreshReq()
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
	a.enqueueRefreshReq()
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
	a.done = true
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

func (a *AccountState) updateEntry(entry stellar1.BundleEntry) {
	a.Lock()
	defer a.Unlock()

	a.isPrimary = entry.IsPrimary
	a.name = entry.Name
	a.accountMode = entry.Mode
}

// enqueueRefreshReq adds an account ID to the refresh request queue.
// It doesn't attempt to add if a.done.  Should be called
// after RLock() or Lock()
func (a *AccountState) enqueueRefreshReq() {
	if a.done {
		return
	}
	select {
	case a.refreshReqs <- a.accountID:
	case <-time.After(5 * time.Second):
		// channel full or nil after shutdown, just ignore
	}
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
	if b.ReadTransactionID != nil && (a.ReadTransactionID == nil || *a.ReadTransactionID != *b.ReadTransactionID) {
		return true
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
