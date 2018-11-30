package stellarsvc

import "github.com/keybase/client/go/stellar/remote"

// WalletState holds all the current data for all the accounts
// for the user.  It is also a remote.Remoter and should be used
// in place of it so network calls can be avoided.
type WalletState struct{}

// NewWalletState creates a wallet state with a remoter that will be
// used for any network calls.
func NewWalletState(r remote.Remoter) *WalletState {
	return nil
}
