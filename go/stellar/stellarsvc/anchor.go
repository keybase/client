package stellarsvc

import (
	"errors"
	"net/url"
	"path"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
)

// anchorInteractor is used to interact with the sep6 transfer server for an asset.
type anchorInteractor struct {
	accountID stellar1.AccountID
	asset     stellar1.Asset
}

// newAnchorInteractor creates an anchorInteractor for an account to interact
// with an asset.
func newAnchorInteractor(accountID stellar1.AccountID, asset stellar1.Asset) *anchorInteractor {
	return &anchorInteractor{
		accountID: accountID,
		asset:     asset,
	}
}

// Deposit runs the deposit action for accountID on the transfer server for asset.
func (a *anchorInteractor) Deposit(mctx libkb.MetaContext) (stellar1.AssetActionResultLocal, error) {
	if err := a.checkAsset(mctx); err != nil {
		return stellar1.AssetActionResultLocal{}, err
	}
	u, err := a.checkURL(mctx, "deposit")
	if err != nil {
		return stellar1.AssetActionResultLocal{}, err
	}
	return a.get(mctx, u)
}

// Withdraw runs the withdraw action for accountID on the transfer server for asset.
func (a *anchorInteractor) Withdraw(mctx libkb.MetaContext) (stellar1.AssetActionResultLocal, error) {
	if err := a.checkAsset(mctx); err != nil {
		return stellar1.AssetActionResultLocal{}, err
	}
	u, err := a.checkURL(mctx, "withdraw")
	if err != nil {
		return stellar1.AssetActionResultLocal{}, err
	}
	return a.get(mctx, u)
}

// checkAsset sanity-checks the asset to make sure it is verified and looks like
// the transfer server actions are supported.
func (a *anchorInteractor) checkAsset(mctx libkb.MetaContext) error {
	if a.asset.VerifiedDomain == "" {
		return errors.New("asset is unverified")
	}
	if a.asset.TransferServer == "" {
		return errors.New("asset has no transfer server")
	}

	// we don't support transfer servers that require authentication via sep10 at this point
	if a.asset.AuthEndpoint != "" {
		return errors.New("asset anchor requires authentication, which Keybase does not support at this time")
	}
	return nil
}

// checkURL creates the URL with the transfer server value and a path
// and checks it for validity and same domain as the asset.
func (a *anchorInteractor) checkURL(mctx libkb.MetaContext, action string) (*url.URL, error) {
	full := path.Join(a.asset.TransferServer, action)
	u, err := url.ParseRequestURI(full)
	if err != nil {
		return nil, err
	}

	if strings.ToLower(u.Host) != strings.ToLower(a.asset.VerifiedDomain) {
		return nil, errors.New("transfer server hostname does not match asset hostname")
	}

	if u.Scheme != "https" {
		return nil, errors.New("transfer server URL is not https")
	}

	if u.RawQuery != "" {
		return nil, errors.New("transfer server URL has a query")
	}

	return u, nil
}

// get performs the http GET requests and parses the result.
func (a *anchorInteractor) get(mctx libkb.MetaContext, u *url.URL) (stellar1.AssetActionResultLocal, error) {
	return stellar1.AssetActionResultLocal{}, nil
}

/*
	// perform the GET request
	// parse the output into a message or a url to open in a browser (or an error)
	// return that info
*/
