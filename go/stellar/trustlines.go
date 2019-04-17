package stellar

import (
	"fmt"
	"math"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/stellarnet"
)

func AddTrustlineLocal(mctx libkb.MetaContext, arg stellar1.AddTrustlineLocalArg) (err error) {
	defer mctx.TraceTimed(
		fmt.Sprintf("Stellar.AddTrustlineLocal(%s,%s)", arg.AccountID, arg.Trustline.AssetCode),
		func() error { return err })()

	walletState := getGlobal(mctx.G()).walletState

	currentBalances, err := walletState.Balances(mctx.Ctx(), arg.AccountID)
	if err != nil {
		return err
	}

	for _, bal := range currentBalances {
		if bal.Asset.Issuer == arg.Trustline.Issuer.String() && bal.Asset.Code == arg.Trustline.AssetCode.String() {
			return fmt.Errorf("Account %s already has trustline %s %s", arg.AccountID.String(),
				arg.Trustline.AssetCode, arg.Trustline.Issuer)
		}
	}

	senderEntry, senderAccountBundle, err := LookupSender(mctx, arg.AccountID)
	if err != nil {
		return err
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
		assetIssuerAddr, math.MaxInt64, sp, tb, baseFee)
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

	currentBalances, err := walletState.Balances(mctx.Ctx(), arg.AccountID)
	if err != nil {
		return err
	}

	var found bool
	for _, bal := range currentBalances {
		if bal.Asset.Issuer == arg.Trustline.Issuer.String() && bal.Asset.Code == arg.Trustline.AssetCode.String() {
			found = true
			break
		}
	}

	if !found {
		return fmt.Errorf("Account %s does not have trustline %s %s", arg.AccountID.String(),
			arg.Trustline.AssetCode, arg.Trustline.Issuer)
	}

	senderEntry, senderAccountBundle, err := LookupSender(mctx, arg.AccountID)
	if err != nil {
		return err
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
