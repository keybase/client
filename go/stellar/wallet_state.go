package stellar

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"

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
	accounts map[stellar1.AccountID]*AccountState
	sync.Mutex
}

// NewWalletState creates a wallet state with a remoter that will be
// used for any network calls.
func NewWalletState(g *libkb.GlobalContext, r remote.Remoter) *WalletState {
	return &WalletState{
		Contextified: libkb.NewContextified(g),
		Remoter:      r,
		accounts:     make(map[stellar1.AccountID]*AccountState),
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
	if err := a.Refresh(ctx); err != nil {
		w.G().Log.CDebugf(ctx, "error refreshing account %s: %s", accountID, err)
		return nil, err
	}
	w.accounts[accountID] = a

	return a, nil
}

// RefreshAll refreshes all the accounts.
func (w *WalletState) RefreshAll(ctx context.Context) error {
	bundle, _, _, err := remote.FetchSecretlessBundle(ctx, w.G())
	if err != nil {
		return err
	}

	var lastErr error
	for _, account := range bundle.Accounts {
		a, _ := w.accountStateBuild(account.AccountID)
		w.G().Log.CDebugf(ctx, "Refresh %s", account.AccountID)
		if err := a.Refresh(ctx); err != nil {
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
	return a.Refresh(ctx)
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

// SubmitPayment is an override of remoter's SubmitPayment.
func (w *WalletState) SubmitPayment(ctx context.Context, post stellar1.PaymentDirectPost) (stellar1.PaymentResult, error) {
	result, err := w.Remoter.SubmitPayment(ctx, post)
	if err == nil {
		go w.RefreshAll(context.Background())
	}
	return result, err
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
	accountID stellar1.AccountID
	remoter   remote.Remoter

	sync.RWMutex // protects everything that follows
	seqno        uint64
	balances     []stellar1.Balance
}

func newAccountState(accountID stellar1.AccountID, r remote.Remoter) *AccountState {
	return &AccountState{
		accountID: accountID,
		remoter:   r,
	}
}

// Refresh updates all the data for this account from the server.
func (a *AccountState) Refresh(ctx context.Context) error {
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

// String returns a small string representation of AccountState suitable for
// debug logging.
func (a *AccountState) String() string {
	a.RLock()
	defer a.RUnlock()
	return fmt.Sprintf("%s (seqno: %d)", a.accountID, a.seqno)
}
