package stellarsvc

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/publicsuffix"
)

// anchorInteractor is used to interact with the sep6 transfer server for an asset.
type anchorInteractor struct {
	accountID     stellar1.AccountID
	asset         stellar1.Asset
	httpGetClient func(mctx libkb.MetaContext, url string) (code int, body []byte, err error)
}

// newAnchorInteractor creates an anchorInteractor for an account to interact
// with an asset.
func newAnchorInteractor(accountID stellar1.AccountID, asset stellar1.Asset) *anchorInteractor {
	return &anchorInteractor{
		accountID:     accountID,
		asset:         asset,
		httpGetClient: httpGet,
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

	v := url.Values{}
	v.Set("account", a.accountID.String())
	v.Set("asset_code", a.asset.Code)
	u.RawQuery = v.Encode()

	var okResponse okDepositResponse
	return a.get(mctx, u, &okResponse)
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

	v := url.Values{}
	v.Set("asset_code", a.asset.Code)
	if a.asset.WithdrawType != "" {
		// this is supposed to be optional, but a lot of anchors require it
		// if they all change to optional, we can not return this from stellard
		// and it won't get set
		v.Set("type", a.asset.WithdrawType)
	}
	u.RawQuery = v.Encode()

	var okResponse okWithdrawResponse
	return a.get(mctx, u, &okResponse)
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
	u, err := url.ParseRequestURI(a.asset.TransferServer)
	if err != nil {
		return nil, err
	}
	u.Path = path.Join(u.Path, action)

	if !a.domainMatches(u.Host) {
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

type okDepositResponse struct {
	How        string  `json:"how"`
	ETA        int     `json:"int"`
	MinAmount  float64 `json:"min_amount"`
	MaxAmount  float64 `json:"max_amount"`
	FeeFixed   float64 `json:"fee_fixed"`
	FeePercent float64 `json:"fee_percent"`
	ExtraInfo  struct {
		Message string `json:"message"`
	} `json:"extra_info"`
}

// this will never happen, but:
func (r *okDepositResponse) String() string {
	return fmt.Sprintf("Deposit request approved by anchor.  %s: %s", r.How, r.ExtraInfo.Message)
}

type okWithdrawResponse struct {
	AccountID  string  `json:"account_id"`
	MemoType   string  `json:"memo_type"` // text, id or hash
	Memo       string  `json:"memo"`
	ETA        int     `json:"int"`
	MinAmount  float64 `json:"min_amount"`
	MaxAmount  float64 `json:"max_amount"`
	FeeFixed   float64 `json:"fee_fixed"`
	FeePercent float64 `json:"fee_percent"`
}

// this will never happen, but:
func (r *okWithdrawResponse) String() string {
	return fmt.Sprintf("Withdraw request approved by anchor.  Send token to %s.  Memo: %s (%s)", r.AccountID, r.Memo, r.MemoType)
}

type forbiddenResponse struct {
	Type  string `json:"type"`
	URL   string `json:"url"`
	ID    string `json:"id"`
	Error string `json:"error"`
}

// get performs the http GET requests and parses the result.
func (a *anchorInteractor) get(mctx libkb.MetaContext, u *url.URL, okResponse fmt.Stringer) (stellar1.AssetActionResultLocal, error) {
	mctx.Debug("performing http GET to %s", u)
	code, body, err := a.httpGetClient(mctx, u.String())
	if err != nil {
		mctx.Debug("GET failed: %s", err)
		return stellar1.AssetActionResultLocal{}, err
	}
	switch code {
	case http.StatusOK:
		if err := json.Unmarshal(body, okResponse); err != nil {
			mctx.Debug("json unmarshal of 200 response failed: %s", err)
			return stellar1.AssetActionResultLocal{}, err
		}
		msg := okResponse.String()
		return stellar1.AssetActionResultLocal{MessageFromAnchor: &msg}, nil
	case http.StatusForbidden:
		var resp forbiddenResponse
		if err := json.Unmarshal(body, &resp); err != nil {
			mctx.Debug("json unmarshal of 403 response failed: %s", err)
			return stellar1.AssetActionResultLocal{}, err
		}
		if resp.Error != "" {
			return stellar1.AssetActionResultLocal{}, fmt.Errorf("Error from anchor: %s", resp.Error)
		}
		if resp.Type == "interactive_customer_info_needed" {
			parsed, err := url.Parse(resp.URL)
			if err != nil {
				mctx.Debug("invalid URL received from anchor: %s", resp.URL)
				return stellar1.AssetActionResultLocal{}, errors.New("invalid URL received from anchor")
			}
			if !a.domainMatches(parsed.Host) {
				mctx.Debug("response URL on a different domain than asset domain: %s vs. %s", resp.URL, a.asset.VerifiedDomain)
				return stellar1.AssetActionResultLocal{}, errors.New("anchor requesting opening a different domain")
			}
			return stellar1.AssetActionResultLocal{ExternalUrl: &resp.URL}, nil
		}
		mctx.Debug("unhandled anchor response for %s: %+v", u, resp)
		return stellar1.AssetActionResultLocal{}, errors.New("unhandled asset anchor http response")
	default:
		mctx.Debug("unhandled anchor response code for %s: %d", u, code)
		return stellar1.AssetActionResultLocal{}, errors.New("unhandled asset anchor http response code")
	}
}

// httpGet is the live version of httpGetClient that is used
// by default.
func httpGet(mctx libkb.MetaContext, url string) (int, []byte, error) {
	client := http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return 0, nil, err
	}

	res, err := client.Do(req.WithContext(mctx.Ctx()))
	if err != nil {
		return 0, nil, err
	}

	body, err := ioutil.ReadAll(res.Body)
	res.Body.Close()
	if err != nil {
		return 0, nil, err
	}

	return res.StatusCode, body, nil
}

func (a *anchorInteractor) domainMatches(url string) bool {
	urlTLD, err := publicsuffix.EffectiveTLDPlusOne(strings.ToLower(url))
	if err != nil {
		return false
	}
	assetTLD, err := publicsuffix.EffectiveTLDPlusOne(strings.ToLower(a.asset.VerifiedDomain))
	if err != nil {
		return false
	}
	return urlTLD == assetTLD
}
