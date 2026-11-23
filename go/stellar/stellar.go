package stellar

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/bundle"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/stellarnet"
)

type CreateWalletGatedResult struct {
	HasWallet          bool // whether the user has a wallet on the server
	AcceptedDisclaimer bool // whether the user has accepted the disclaimer
}

// CreateWalletGated asks the server about the user's wallet. The client no
// longer creates wallets, so this never does.
func CreateWalletGated(mctx libkb.MetaContext) (res CreateWalletGatedResult, err error) {
	defer mctx.Trace("Stellar.CreateWalletGated", &err)()
	scr, err := remote.ShouldCreate(mctx.Ctx(), mctx.G())
	if err != nil {
		return res, err
	}
	return CreateWalletGatedResult{
		HasWallet:          scr.HasWallet,
		AcceptedDisclaimer: scr.AcceptedDisclaimer,
	}, nil
}

func HasAcceptedDisclaimer(ctx context.Context, g *libkb.GlobalContext) (bool, error) {
	return remote.GetAcceptedDisclaimer(ctx, g)
}

// ExportSecretKey returns the secret key of an account in the user's bundle.
func ExportSecretKey(mctx libkb.MetaContext, accountID stellar1.AccountID) (res stellar1.SecretKey, err error) {
	prevBundle, err := remote.FetchAccountBundle(mctx, accountID)
	if err != nil {
		return res, err
	}
	for _, account := range prevBundle.Accounts {
		if account.AccountID.Eq(accountID) {
			signers := prevBundle.AccountBundles[account.AccountID].Signers
			if len(signers) == 0 {
				return res, fmt.Errorf("no secret keys found for account")
			}
			if len(signers) != 1 {
				return res, fmt.Errorf("expected 1 secret key but found %v", len(signers))
			}
			return signers[0], nil
		}
	}
	_, _, _, parseSecErr := libkb.ParseStellarSecretKey(accountID.String())
	if parseSecErr == nil {
		// Just in case a secret key worked its way in here
		return res, fmt.Errorf("account not found: unexpected secret key")
	}
	return res, fmt.Errorf("account not found: %v", accountID)
}

// AllWalletAccounts lists the accounts in the user's bundle, with one balance
// read from the server per account.
func AllWalletAccounts(mctx libkb.MetaContext) ([]stellar1.WalletAccountLocal, error) {
	wallet, err := remote.FetchSecretlessBundle(mctx)
	if err != nil {
		return nil, err
	}

	var accts []stellar1.WalletAccountLocal
	for _, entry := range wallet.Accounts {
		if entry.AccountID.IsNil() {
			mctx.Debug("bundle entry has empty account id: %+v", entry)
			continue
		}
		balances, err := remote.Balances(mctx.Ctx(), mctx.G(), entry.AccountID)
		if err != nil {
			return nil, err
		}
		acct, err := walletAccountLocal(mctx, entry, balances)
		if err != nil {
			return nil, err
		}
		accts = append(accts, acct)
	}

	// Put the primary account first, then sort by name, then by account ID
	sort.SliceStable(accts, func(i, j int) bool {
		if accts[i].IsDefault {
			return true
		}
		if accts[j].IsDefault {
			return false
		}
		if accts[i].Name == accts[j].Name {
			return accts[i].AccountID < accts[j].AccountID
		}
		return accts[i].Name < accts[j].Name
	})

	return accts, nil
}

func walletAccountLocal(mctx libkb.MetaContext, entry stellar1.BundleEntry, balances []stellar1.Balance) (stellar1.WalletAccountLocal, error) {
	var empty stellar1.WalletAccountLocal
	balance, err := balanceList(balances).balanceDescription(mctx)
	if err != nil {
		return empty, err
	}

	activeDeviceType, err := mctx.G().ActiveDevice.DeviceType(mctx)
	if err != nil {
		return empty, err
	}
	isMobile := activeDeviceType == keybase1.DeviceTypeV2_MOBILE

	// Mobile-only accounts can only export their secret from a mobile device
	// that is at least 7 days old (existing device-access rule).
	readOnly := false
	if entry.Mode == stellar1.AccountMode_MOBILE {
		if !isMobile {
			readOnly = true
		} else {
			ctime, err := mctx.G().ActiveDevice.Ctime(mctx)
			if err != nil {
				return empty, err
			}
			deviceProvisionedAt := time.Unix(int64(ctime)/1000, 0)
			deviceAge := mctx.G().Clock().Since(deviceProvisionedAt)
			readOnly = deviceAge <= 7*24*time.Hour
		}
	}

	return stellar1.WalletAccountLocal{
		AccountID:          entry.AccountID,
		IsDefault:          entry.IsPrimary,
		Name:               entry.Name,
		BalanceDescription: balance,
		AccountMode:        entry.Mode,
		DeviceReadOnly:     readOnly,
	}, nil
}

// DeleteAccount removes a non-primary account from the user's bundle.
func DeleteAccount(m libkb.MetaContext, accountID stellar1.AccountID) error {
	if accountID.IsNil() {
		return errors.New("passed empty AccountID")
	}
	prevBundle, err := remote.FetchAccountBundle(m, accountID)
	if err != nil {
		return err
	}

	nextBundle := bundle.AdvanceBundle(*prevBundle)
	var found bool
	for i, acc := range nextBundle.Accounts {
		if acc.AccountID.Eq(accountID) {
			if acc.IsPrimary {
				return fmt.Errorf("cannot delete primary account %v", accountID)
			}

			nextBundle.Accounts = append(nextBundle.Accounts[:i], nextBundle.Accounts[i+1:]...)
			delete(nextBundle.AccountBundles, accountID)
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("account not found: %v", accountID)
	}
	return remote.Post(m, nextBundle)
}

type balanceList []stellar1.Balance

// Example: "56.0227002 XLM + more"
func (a balanceList) balanceDescription(mctx libkb.MetaContext) (res string, err error) {
	var more bool
	for _, b := range a {
		if b.Asset.IsNativeXLM() {
			amount, err := FormatAmount(mctx, b.Amount, false, stellarnet.Round)
			if err != nil {
				return "", err
			}
			// Do not simplify XLM amounts, all zeroes are important because
			// that's the exact number of digits that Stellar protocol
			// supports.
			res = fmt.Sprintf("%s XLM", amount)
		} else {
			more = true
		}
	}
	if res == "" {
		res = "0 XLM"
	}
	if more {
		res += " + more"
	}
	return res, nil
}
