package stellarsvc

import (
	"context"
	"errors"
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
func (w *WalletState) accountStateBuild(accountID stellar1.AccountID) *AccountState {
	w.Lock()
	defer w.Unlock()

	a, ok := w.accounts[accountID]
	if ok {
		return a
	}

	a = newAccountState(accountID, w.Remoter)
	w.accounts[accountID] = a

	return a
}

// RefreshAll refreshes all the accounts.
func (w *WalletState) RefreshAll(ctx context.Context) error {
	bundle, _, err := remote.Fetch(ctx, w.G())
	if err != nil {
		return err
	}

	var lastErr error
	for _, account := range bundle.Accounts {
		a := w.accountStateBuild(account.AccountID)
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

	return nil
}

// Refresh gets all the data from the server for an account.
func (w *WalletState) Refresh(ctx context.Context, accountID stellar1.AccountID) error {
	a, ok := w.accountState(accountID)
	if !ok {
		return ErrAccountNotFound
	}
	return a.Refresh(ctx)
}

// AccountSeqno is an override of remoter's AccountSeqno that uses
// the stored value.
func (w *WalletState) AccountSeqno(ctx context.Context, accountID stellar1.AccountID) (uint64, error) {
	a, ok := w.accountState(accountID)
	if !ok {
		return w.Remoter.AccountSeqno(ctx, accountID)
	}
	return a.AccountSeqno(ctx)
}

// AccountState holds the current data for a stellar account.
type AccountState struct {
	// these are only set when AccountState created, they never change
	accountID stellar1.AccountID
	remoter   remote.Remoter

	sync.RWMutex // protects everything that follows
	seqno        uint64
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
		a.seqno = seqno
		a.Unlock()
	}

	return err
}

func (a *AccountState) AccountSeqno(ctx context.Context) (uint64, error) {
	a.RLock()
	defer a.RUnlock()
	return a.seqno, nil
}
