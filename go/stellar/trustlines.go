package stellar

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/stellarnet"
)

const trustlineMaxLimit = "922337203685.4775807"

func AddTrustlineLocal(mctx libkb.MetaContext, arg stellar1.AddTrustlineLocalArg) (err error) {
	defer mctx.TraceTimed(
		fmt.Sprintf("Stellar.AddTrustlineLocal(%s,%s)", arg.AccountID, arg.Trustline.AssetCode),
		func() error { return err })()

	var limitAmount string
	if arg.Limit != "" {
		// Parse to ensure the format and the number is correct.
		intLimit, err := stellarnet.ParseStellarAmount(arg.Limit)
		if err != nil {
			return err
		}

		if intLimit <= 0 {
			return fmt.Errorf("trustline limit has to be higher than 0 in AddTrustlineLocal, got %s", arg.Limit)
		}

		limitAmount = arg.Limit
	} else {
		limitAmount = trustlineMaxLimit
	}

	walletState := getGlobal(mctx.G()).walletState

	senderEntry, senderAccountBundle, err := LookupSender(mctx, arg.AccountID)
	if err != nil {
		return err
	}

	currentBalances, err := walletState.Balances(mctx.Ctx(), senderEntry.AccountID)
	if err != nil {
		return err
	}

	for _, bal := range currentBalances {
		if bal.Asset.Issuer == arg.Trustline.Issuer.String() && bal.Asset.Code == arg.Trustline.AssetCode.String() {
			return fmt.Errorf("Account %s already has trustline %s %s", arg.AccountID.String(),
				arg.Trustline.AssetCode, arg.Trustline.Issuer)
		}
	}

	senderSeed := senderAccountBundle.Signers[0]
	senderSeed2, err := stellarnet.NewSeedStr(senderSeed.SecureNoLogString())
	if err != nil {
		return err
	}

	sp, unlock := NewSeqnoProvider(mctx, walletState)
	defer unlock()

	tb, err := getTimeboundsForSending(mctx, walletState)
	if err != nil {
		return err
	}

	assetIssuerAddr, err := stellarnet.NewAddressStr(arg.Trustline.Issuer.String())
	if err != nil {
		return fmt.Errorf("Malformed asset issuer ID: %s", err)
	}

	baseFee := walletState.BaseFee(mctx)
	sig, err := stellarnet.CreateTrustlineTransaction(senderSeed2, arg.Trustline.AssetCode.String(),
		assetIssuerAddr, limitAmount, sp, tb, baseFee)
	if err != nil {
		return err
	}
	err = walletState.ChangeTrustline(mctx.Ctx(), sig.Signed)
	if err != nil {
		return err
	}
	err = walletState.Refresh(mctx, senderEntry.AccountID, "add trustline")
	if err != nil {
		mctx.Debug("AddTrustlineLocal ws.Refresh error: %s", err)
	}
	return nil
}

func DeleteTrustlineLocal(mctx libkb.MetaContext, arg stellar1.DeleteTrustlineLocalArg) (err error) {
	defer mctx.TraceTimed(
		fmt.Sprintf("Stellar.DeleteTrustlineLocal(%s,%s)", arg.AccountID, arg.Trustline.AssetCode),
		func() error { return err })()

	walletState := getGlobal(mctx.G()).walletState

	senderEntry, senderAccountBundle, err := LookupSender(mctx, arg.AccountID)
	if err != nil {
		return err
	}

	currentBalances, err := walletState.Balances(mctx.Ctx(), senderEntry.AccountID)
	if err != nil {
		return err
	}

	var found bool
	for _, bal := range currentBalances {
		if bal.Asset.Issuer == arg.Trustline.Issuer.String() && bal.Asset.Code == arg.Trustline.AssetCode.String() {
			currentAmount, err := stellarnet.ParseStellarAmount(bal.Amount)
			if err != nil {
				return err
			}
			if currentAmount != 0 {
				return fmt.Errorf("Cannot delete a trustline with a balance.")
			}
			found = true
			break
		}
	}

	if !found {
		return fmt.Errorf("Account %s does not have trustline %s %s", arg.AccountID.String(),
			arg.Trustline.AssetCode, arg.Trustline.Issuer)
	}

	senderSeed := senderAccountBundle.Signers[0]
	senderSeed2, err := stellarnet.NewSeedStr(senderSeed.SecureNoLogString())
	if err != nil {
		return err
	}

	sp, unlock := NewSeqnoProvider(mctx, walletState)
	defer unlock()

	tb, err := getTimeboundsForSending(mctx, walletState)
	if err != nil {
		return err
	}

	assetIssuerAddr, err := stellarnet.NewAddressStr(arg.Trustline.Issuer.String())
	if err != nil {
		return fmt.Errorf("Malformed asset issuer ID: %s", err)
	}

	baseFee := walletState.BaseFee(mctx)
	sig, err := stellarnet.DeleteTrustlineTransaction(senderSeed2, arg.Trustline.AssetCode.String(),
		assetIssuerAddr, sp, tb, baseFee)
	if err != nil {
		return err
	}
	err = walletState.ChangeTrustline(mctx.Ctx(), sig.Signed)
	if err != nil {
		return err
	}
	err = walletState.Refresh(mctx, senderEntry.AccountID, "delete trustline")
	if err != nil {
		mctx.Debug("DeleteTrustlineLocal ws.Refresh error: %s", err)
	}
	return nil
}

func ChangeTrustlineLimitLocal(mctx libkb.MetaContext, arg stellar1.ChangeTrustlineLimitLocalArg) (err error) {
	defer mctx.TraceTimed(
		fmt.Sprintf("Stellar.ChangeTrustlineLimitLocal(%s,%s,%s)", arg.AccountID, arg.Trustline.AssetCode, arg.Limit),
		func() error { return err })()

	walletState := getGlobal(mctx.G()).walletState

	intLimit, err := stellarnet.ParseStellarAmount(arg.Limit)
	if err != nil {
		return fmt.Errorf("while parsing `limit` number: %s", err.Error())
	}

	if intLimit <= 0 {
		return fmt.Errorf("trustline limit has to be higher than 0, got %s", arg.Limit)
	}

	senderEntry, senderAccountBundle, err := LookupSender(mctx, arg.AccountID)
	if err != nil {
		return err
	}

	currentBalances, err := walletState.Balances(mctx.Ctx(), senderEntry.AccountID)
	if err != nil {
		return err
	}

	var found bool
	for _, bal := range currentBalances {
		if bal.Asset.Issuer == arg.Trustline.Issuer.String() && bal.Asset.Code == arg.Trustline.AssetCode.String() {
			currentAmount, err := stellarnet.ParseStellarAmount(bal.Amount)
			if err != nil {
				return err
			}
			if intLimit < currentAmount {
				return fmt.Errorf("limit cannot be set to less what the current balance is: %s", bal.Amount)
			}
			found = true
			break
		}
	}

	if !found {
		return fmt.Errorf("Account %s does not have trustline %s %s", arg.AccountID.String(),
			arg.Trustline.AssetCode, arg.Trustline.Issuer)
	}

	senderSeed := senderAccountBundle.Signers[0]
	senderSeed2, err := stellarnet.NewSeedStr(senderSeed.SecureNoLogString())
	if err != nil {
		return err
	}

	sp, unlock := NewSeqnoProvider(mctx, walletState)
	defer unlock()

	tb, err := getTimeboundsForSending(mctx, walletState)
	if err != nil {
		return err
	}

	assetIssuerAddr, err := stellarnet.NewAddressStr(arg.Trustline.Issuer.String())
	if err != nil {
		return fmt.Errorf("Malformed asset issuer ID: %s", err)
	}

	baseFee := walletState.BaseFee(mctx)
	sig, err := stellarnet.CreateTrustlineTransaction(senderSeed2, arg.Trustline.AssetCode.String(),
		assetIssuerAddr, arg.Limit, sp, tb, baseFee)
	if err != nil {
		return err
	}
	err = walletState.ChangeTrustline(mctx.Ctx(), sig.Signed)
	if err != nil {
		return err
	}
	err = walletState.Refresh(mctx, senderEntry.AccountID, "delete trustline")
	if err != nil {
		mctx.Debug("DeleteTrustlineLocal ws.Refresh error: %s", err)
	}
	return nil
}
