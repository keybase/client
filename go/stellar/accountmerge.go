package stellar

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/stellarcommon"
	"github.com/keybase/stellarnet"
)

func AccountMerge(mctx libkb.MetaContext, walletState *WalletState, arg stellar1.AccountMergeCLILocalArg) (res stellarnet.SignResult, err error) {
	baseFee := walletState.BaseFee(mctx)
	sp, unlock := NewClaimSeqnoProvider(mctx, walletState)
	defer unlock()
	tb, err := getTimeboundsForSending(mctx, walletState)
	if err != nil {
		return res, err
	}

	if arg.FromSecretKey == nil {
		bundleEntry, accountBundle, err := LookupSender(mctx, arg.FromAccountID)
		if err != nil {
			return res, fmt.Errorf("account merge error looking up <from>: %v", err)
		}
		if len(accountBundle.Signers) == 0 {
			return res, fmt.Errorf("secret key not found for %s", arg.FromAccountID)
		}
		if len(accountBundle.Signers) > 1 {
			return res, fmt.Errorf("do not know how to handle multiple secret keys found for %s", arg.FromAccountID)
		}
		arg.FromSecretKey = &accountBundle.Signers[0]
		arg.FromAccountID = bundleEntry.AccountID
		mctx.Debug("account merge <from> lookup complete: %s", arg.FromAccountID)
	}
	fromSeed := stellarnet.SeedStr(arg.FromSecretKey.SecureNoLogString())
	mctx.Debug("account merge <from> seed lookup complete")

	recipient, err := LookupRecipient(mctx, stellarcommon.RecipientInput(arg.To), true /* isCLI */)
	if err != nil {
		return res, fmt.Errorf("account merge error looking up <to>: %v", err)
	}
	toAddr := recipient.AccountID
	if toAddr == nil {
		return res, fmt.Errorf("cannot merge into a non-existing account")
	}
	mctx.Debug("account merge <to> lookup complete: %s", toAddr)

	signedTx, err := stellarnet.AccountMergeTransaction(fromSeed, *toAddr, sp, tb, baseFee)
	if err != nil {
		return res, err
	}
	return signedTx, nil
}
