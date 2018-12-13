package stellar

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/stellarnet"
)

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

	toAddrStr, err := stellarnet.NewAddressStr(arg.DestinationID.String())
	if err != nil {
		return err
	}

	_ = tb // TODO: Timebounds
	sig, err := stellarnet.SetInflationDestinationTransaction(senderSeed2, toAddrStr, sp)
	if err != nil {
		return err
	}
	err = walletState.SetInflationDestination(mctx.Ctx(), sig.Signed)
	if err != nil {
		return err
	}
	walletState.Refresh(mctx.Ctx(), senderEntry.AccountID)
	return nil
}
