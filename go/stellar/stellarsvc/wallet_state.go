package stellarsvc

import (
	"context"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
)

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
func (w *WalletState) accountState(accountID stellar1.AccountID) *AccountState {
	w.Lock()
	defer w.Unlock()

	a, ok := w.accounts[accountID]
	if !ok {
		a = newAccountState(accountID)
		w.accounts[accountID] = a
	}

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
		if err := w.Refresh(ctx, account.AccountID); err != nil {
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
	a := w.accountState(accountID)
	w.G().Log.CDebugf(ctx, "Refresh %s success", accountID)
	return nil
}

// AccountSeqno is an override of remoter's AccountSeqno that uses
// the stored value.
func (w *WalletState) AccountSeqno(ctx context.Context, accountID stellar1.AccountID) (uint64, error) {
	a := w.accountState(accountID)
	return a.AccountSeqno(ctx)
}

// AccountState holds the current data for a stellar account.
type AccountState struct {
	accountID stellar1.AccountID
	seqno     uint64
	sync.RWMutex
}

func newAccountState(accountID stellar1.AccountID) *AccountState {
	return &AccountState{
		accountID: accountID,
	}
}

func (a *AccountState) AccountSeqno(ctx context.Context) (uint64, error) {
	/*
		if !ok {
			w.G().Log.CDebugf(ctx, "AccountSeqno: falling back to remote for %s (unknown account)", accountID)
			return w.Remoter.AccountSeqno(ctx, accountID)
		}
	*/
	a.RLock()
	defer a.RUnlock()
	w.G().Log.CDebugf(ctx, "AccountSeqno: using stored value of %v for %s", a.seqno, accountID)
	return a.seqno, nil

}
