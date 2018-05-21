// this file is for the implementation of all the frontend-requested service
// endpoints for wallets.
package stellarsvc

import (
	"context"
	"fmt"
	"sort"

	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
)

func (s *Server) GetWalletAccountsLocal(ctx context.Context, sessionID int) (accts []stellar1.WalletAccountLocal, err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "GetWalletAccountsLocal", func() error { return err })()
	err = s.assertLoggedIn(ctx)
	if err != nil {
		return nil, err
	}

	bundle, _, err := remote.Fetch(ctx, s.G())
	if err != nil {
		return nil, err
	}

	for _, account := range bundle.Accounts {
		acct := stellar1.WalletAccountLocal{
			AccountID: account.AccountID,
			IsDefault: account.IsPrimary,
			Name:      account.Name,
		}

		balances, err := s.remoter.Balances(ctx, acct.AccountID)
		if err != nil {
			s.G().Log.CDebugf(ctx, "remote.Balances failed for %q: %s", acct.AccountID, err)
			return nil, err
		}
		acct.BalanceDescription = balanceList(balances).nativeBalanceDescription()

		accts = append(accts, acct)
	}

	// Put the primary account first, sort by name everything else
	sort.SliceStable(accts, func(i, j int) bool {
		if accts[i].IsDefault {
			return true
		}
		if accts[j].IsDefault {
			return false
		}
		return accts[i].Name < accts[j].Name
	})

	return accts, nil
}

type balanceList []stellar1.Balance

func (a balanceList) nativeBalanceDescription() string {
	for _, b := range a {
		if b.Asset.IsNativeXLM() {
			return fmt.Sprintf("%s XLM", b.Amount)
		}
	}
	return "0 XLM"
}
