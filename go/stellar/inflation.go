package stellar

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/stellarnet"
)

// https://pool.lumenaut.net/
const lumenautPoolAccountID = stellar1.AccountID("GCCD6AJOYZCUAQLX32ZJF2MKFFAUJ53PVCFQI3RHWKL3V47QYE2BNAUT")

func SetInflationDestinationLocal(mctx libkb.MetaContext, arg stellar1.SetInflationDestinationLocalArg) (err error) {
	defer mctx.CTraceTimed("Stellar.SetInflationDestinationLocal", func() error { return err })()

	walletState := getGlobal(mctx.G()).walletState

	// look up sender account
	senderEntry, senderAccountBundle, err := LookupSender(mctx.Ctx(), mctx.G(), arg.AccountID)
	if err != nil {
		return err
	}
	senderSeed := senderAccountBundle.Signers[0]
	senderSeed2, err := stellarnet.NewSeedStr(senderSeed.SecureNoLogString())
	if err != nil {
		return err
	}

	sp := NewSeqnoProvider(mctx, walletState)
	tb, err := getTimeboundsForSending(mctx, walletState)
	if err != nil {
		return err
	}

	inflationType, err := arg.Destination.Typ()
	if err != nil {
		return err
	}

	var destinationAddrStr stellarnet.AddressStr
	switch inflationType {
	case stellar1.InflationDestinationType_SELF:
		destinationAddrStr = stellarnet.AddressStr(senderEntry.AccountID)
	case stellar1.InflationDestinationType_LUMENAUT:
		destinationAddrStr = stellarnet.AddressStr(lumenautPoolAccountID.String())
	case stellar1.InflationDestinationType_ACCOUNTID:
		destinationAddrStr, err = stellarnet.NewAddressStr(arg.Destination.Accountid().String())
		if err != nil {
			return err
		}
	}

	_ = tb // TODO: Timebounds
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
	destination, err := walletState.GetInflationDestination(mctx.Ctx(), accountID)
	if err != nil {
		return res, err
	}

	if destination == nil {
		// Inflation destination is not set on the account
		res.Destination = nil
		res.Comment = ""
		return res, nil
	}

	res.Destination = destination
	if destination.Eq(accountID) {
		res.Comment = "self"
	} else if destination.Eq(lumenautPoolAccountID) {
		res.Comment = "https://pool.lumenaut.net/"
	}
	return res, nil
}
