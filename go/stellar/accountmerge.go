package stellar

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/stellarcommon"
	"github.com/keybase/stellarnet"
)

func AccountMerge(mctx libkb.MetaContext, walletState *WalletState, arg stellar1.AccountMergeCLILocalArg) (res stellarnet.SignResult, from stellar1.AccountID, err error) {
	baseFee := walletState.BaseFee(mctx)
	sp, unlock := NewClaimSeqnoProvider(mctx, walletState)
	defer unlock()
	tb, err := getTimeboundsForSending(mctx, walletState)
	if err != nil {
		return res, from, err
	}

	bundleEntry, accountBundle, err := LookupSender(mctx, arg.From)
	if err != nil {
		return res, from, fmt.Errorf("account merge error looking up <from>: %v", err)
	}
	fromSeed := stellarnet.SeedStr(accountBundle.Signers[0].SecureNoLogString())
	mctx.Debug("account merge <from> lookup complete: %s -> %s", arg.From, bundleEntry.AccountID)

	recipient, err := LookupRecipient(mctx, stellarcommon.RecipientInput(arg.To), true /* isCLI */)
	if err != nil {
		return res, from, fmt.Errorf("account merge error looking up <to>: %v", err)
	}
	toAddr := stellarnet.AddressStr(*recipient.AccountID)
	mctx.Debug("account merge <to> lookup complete: %s -> %s", arg.To, toAddr)

	signedTx, err := stellarnet.AccountMergeTransaction(fromSeed, toAddr, sp, tb, baseFee)
	if err != nil {
		return res, from, err
	}
	return signedTx, bundleEntry.AccountID, nil
}
