package stellarsvc

import (
	"errors"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
)

type anchorInteractor struct {
	accountID stellar1.AccountID
	asset     stellar1.Asset
}

func newAnchorInteractor(accountID stellar1.AccountID, asset stellar1.Asset) *anchorInteractor {
	return &anchorInteractor{
		accountID: accountID,
		asset:     asset,
	}
}

func (a *anchorInteractor) Deposit(mctx libkb.MetaContext) (stellar1.AssetActionResultLocal, error) {
	return stellar1.AssetActionResultLocal{}, errors.New("nyi")
}

func (a *anchorInteractor) Withdraw(mctx libkb.MetaContext) (stellar1.AssetActionResultLocal, error) {
	return stellar1.AssetActionResultLocal{}, errors.New("nyi")
}

/*
	// get the asset verified
	// check that the asset has TRANSFER_SERVER
	// make sure it doesn't have WEB_AUTH_ENDPOINT (not supported yet)
	// form the URL with transfer_server + "deposit"
	// parse the URL, make sure it is valid
	// check that the domain name is the same as the asset host name
	// make sure there are no parameters
	// make sure it is https
	// perform the GET request
	// parse the output into a message or a url to open in a browser (or an error)
	// return that info
*/
