package stellar

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/stellarnet"
)

// https://pool.lumenaut.net/
const lumenautPoolAccountID = stellar1.AccountID("GCCD6AJOYZCUAQLX32ZJF2MKFFAUJ53PVCFQI3RHWKL3V47QYE2BNAUT")

var predefinedInflationDestinations = [...]stellar1.PredefinedInflationDestination{
	stellar1.PredefinedInflationDestination{
		Tag:         stellar1.InflationDestinationTag("lumenaut"),
		Name:        "Lumenaut",
		Recommended: true,
		AccountID:   stellar1.AccountID("GCCD6AJOYZCUAQLX32ZJF2MKFFAUJ53PVCFQI3RHWKL3V47QYE2BNAUT"),
		Url:         "https://pool.lumenaut.net/",
	},
	stellar1.PredefinedInflationDestination{
		Tag:       stellar1.InflationDestinationTag("sdf"),
		Name:      "Stellar Developer Foundation",
		AccountID: stellar1.AccountID("GDWNY2POLGK65VVKIH5KQSH7VWLKRTQ5M6ADLJAYC2UEHEBEARCZJWWI"),
		Url:       "https://www.stellar.org",
	},
}

func GetPredefinedInflationDestinations(mctx libkb.MetaContext) (ret []stellar1.PredefinedInflationDestination, err error) {
	return predefinedInflationDestinations[:], nil
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
		for _, known := range predefinedInflationDestinations {
			if dest.Eq(known.AccountID) {
				obj := known // make a copy
				res.KnownDestination = &obj
				break
			}
		}
	}

	return res, nil
}
