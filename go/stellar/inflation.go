package stellar

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/stellarnet"
)

func GetPredefinedInflationDestinations(mctx libkb.MetaContext) (ret []stellar1.PredefinedInflationDestination, err error) {
	return getGlobal(mctx.G()).walletState.GetInflationDestinations(mctx.Ctx())
}

func SetInflationDestinationLocal(mctx libkb.MetaContext, arg stellar1.SetInflationDestinationLocalArg) (err error) {
	defer mctx.CTraceTimed(
		fmt.Sprintf("Stellar.SetInflationDestinationLocal(on=%s,to=%s)", arg.AccountID, arg.Destination),
		func() error { return err })()

	walletState := getGlobal(mctx.G()).walletState

	// look up sender account
	senderEntry, senderAccountBundle, err := LookupSender(mctx, arg.AccountID)
	if err != nil {
		return err
	}
	senderSeed := senderAccountBundle.Signers[0]
	senderSeed2, err := stellarnet.NewSeedStr(senderSeed.SecureNoLogString())
	if err != nil {
		return err
	}

	destinationAddrStr, err := stellarnet.NewAddressStr(arg.Destination.String())
	if err != nil {
		return err
	}

	sp := NewSeqnoProvider(mctx, walletState)
	sig, err := stellarnet.SetInflationDestinationTransaction(senderSeed2, destinationAddrStr, sp)
	if err != nil {
		return err
	}
	err = walletState.SetInflationDestination(mctx.Ctx(), sig.Signed)
	if err != nil {
		return err
	}
	walletState.Refresh(mctx, senderEntry.AccountID, "set inflation destination")
	return nil
}

func GetInflationDestination(mctx libkb.MetaContext, accountID stellar1.AccountID) (res stellar1.InflationDestinationResultLocal, err error) {
	defer mctx.CTraceTimed("Stellar.GetInflationDestination", func() error { return err })()

	walletState := getGlobal(mctx.G()).walletState
	details, err := walletState.Details(mctx.Ctx(), accountID)
	if err != nil {
		return res, err
	}

	dest := details.InflationDestination
	if dest == nil {
		// Inflation destination is not set on the account.
		res.Destination = nil
		return res, nil
	}

	res.Destination = dest
	if dest.Eq(accountID) {
		res.Self = true
	} else {
		destinations, err := GetPredefinedInflationDestinations(mctx)
		if err != nil {
			return res, err
		}
		for _, known := range destinations {
			if dest.Eq(known.AccountID) {
				res.KnownDestination = &known
				break
			}
		}
	}

	return res, nil
}
