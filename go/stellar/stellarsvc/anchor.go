package stellarsvc

import (
	"bytes"
	"encoding/base64"
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
	"github.com/keybase/stellarnet"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	"github.com/stellar/go/xdr"
	"golang.org/x/net/publicsuffix"
)

// ErrAnchor is returned by some error paths and includes
// a code to make it easier to figure out which error
// it refers to.
type ErrAnchor struct {
	Code    int
	Message string
}

// Error returns an error message string.
func (e ErrAnchor) Error() string {
	return e.Message
}

const (
	ErrAnchorCodeBadStatus = 100
)

// anchorInteractor is used to interact with the sep6 transfer server for an asset.
type anchorInteractor struct {
	accountID      stellar1.AccountID
	secretKey      *stellar1.SecretKey
	asset          stellar1.Asset
	authToken      string
	httpGetClient  func(mctx libkb.MetaContext, url, authToken string) (code int, body []byte, err error)
	httpPostClient func(mctx libkb.MetaContext, url string, data url.Values) (code int, body []byte, err error)
}

// newAnchorInteractor creates an anchorInteractor for an account to interact
// with an asset.
func newAnchorInteractor(accountID stellar1.AccountID, secretKey *stellar1.SecretKey, asset stellar1.Asset) *anchorInteractor {
	ai := &anchorInteractor{
		accountID:      accountID,
		asset:          asset,
		httpGetClient:  httpGet,
		httpPostClient: httpPost,
	}

	if ai.asset.AuthEndpoint != "" {
		// we will need secretKey to sign authentication challenges.
		ai.secretKey = secretKey
	}

	return ai
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
	v.Set("account", a.accountID.String())
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

	if a.asset.AuthEndpoint != "" {
		// asset requires sep10 authentication token
		if err := a.getAuthToken(mctx); err != nil {
			return err
		}

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
	How        string      `json:"how"`
	ETA        int         `json:"int"`
	MinAmount  float64     `json:"min_amount"`
	MaxAmount  float64     `json:"max_amount"`
	FeeFixed   float64     `json:"fee_fixed"`
	FeePercent float64     `json:"fee_percent"`
	ExtraInfo  interface{} `json:"extra_info"`
}

// this will never happen, but:
func (r *okDepositResponse) String() string {
	return fmt.Sprintf("Deposit request approved by anchor.  %s: %v", r.How, r.ExtraInfo)
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
	code, body, err := a.httpGetClient(mctx, u.String(), a.authToken)
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
		mctx.Debug("unhandled anchor response body for %s: %s", u, string(body))
		return stellar1.AssetActionResultLocal{},
			ErrAnchor{
				Code:    ErrAnchorCodeBadStatus,
				Message: fmt.Sprintf("Unknown asset anchor HTTP response code %d", code),
			}
	}
}

// httpGet is the live version of httpGetClient that is used
// by default.
func httpGet(mctx libkb.MetaContext, url, authToken string) (int, []byte, error) {
	client := http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return 0, nil, err
	}

	if authToken != "" {
		req.Header.Add("Authorization", "Bearer "+authToken)
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

// httpPost is the live version of httpPostClient that is used
// by default.
func httpPost(mctx libkb.MetaContext, url string, data url.Values) (int, []byte, error) {
	client := http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest(http.MethodPost, url, strings.NewReader(data.Encode()))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

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

func (a *anchorInteractor) getAuthToken(mctx libkb.MetaContext) error {
	u, err := url.ParseRequestURI(a.asset.AuthEndpoint)
	if err != nil {
		return err
	}
	if !a.domainMatches(u.Host) {
		return errors.New("auth endpoint domain does not match asset")
	}
	if u.Scheme != "https" {
		return errors.New("auth endpoint is not https")
	}

	v := url.Values{}
	v.Set("account", a.accountID.String())
	u.RawQuery = v.Encode()

	code, body, err := a.httpGetClient(mctx, u.String(), a.authToken)
	if err != nil {
		return err
	}
	if code != http.StatusOK {
		return errors.New("auth endpoint GET error")
	}
	var res map[string]string
	if err := json.Unmarshal(body, &res); err != nil {
		return err
	}
	tx, ok := res["transaction"]
	if !ok {
		return errors.New("auth endpoint response did not contain a tx challenge")
	}
	var unpacked xdr.TransactionEnvelope
	err = xdr.SafeUnmarshalBase64(tx, &unpacked)
	if err != nil {
		return err
	}

	if unpacked.Tx.SeqNum != 0 {
		return errors.New("invalid tx challenge: seqno not zero")
	}

	// TODO:
	// sourceAccount := stellar1.AccountID(unpacked.Tx.SourceAccount.Address())
	// sourceAccount is supposed to be the same as SIGNING_KEY in stellar.toml.
	// we don't get that value currently...

	if err := stellarnet.VerifyEnvelope(unpacked); err != nil {
		return err
	}

	if len(unpacked.Tx.Operations) != 1 {
		return errors.New("invalid tx challenge: invalid number of operations")
	}

	op := unpacked.Tx.Operations[0]
	if op.Body.Type != xdr.OperationTypeManageData {
		return errors.New("invalid tx challenge: invalid operation type")
	}

	// ok, we've checked all we can check...go ahead and sign this tx.
	if a.secretKey == nil {
		return errors.New("no secret key, cannot sign the tx challenge")
	}
	hash, err := network.HashTransaction(&unpacked.Tx, stellarnet.NetworkPassphrase())
	if err != nil {
		return err
	}

	kp, err := keypair.Parse(a.secretKey.SecureNoLogString())
	if err != nil {
		return err
	}
	sig, err := kp.SignDecorated(hash[:])
	if err != nil {
		return err
	}
	unpacked.Signatures = append(unpacked.Signatures, sig)

	var buf bytes.Buffer
	_, err = xdr.Marshal(&buf, unpacked)
	if err != nil {
		return fmt.Errorf("marshaling envelope with signature returened an error: %s", err)
	}
	signed := base64.StdEncoding.EncodeToString(buf.Bytes())

	data := url.Values{}
	data.Set("transaction", signed)
	code, body, err = a.httpPostClient(mctx, a.asset.AuthEndpoint, data)
	if err != nil {
		return err
	}
	if code != http.StatusOK {
		return errors.New("challenge post didn't reutrn OK/200")
	}

	var tokres map[string]string
	if err := json.Unmarshal(body, &tokres); err != nil {
		return err
	}
	token, ok := tokres["token"]
	if ok {
		a.authToken = token
	} else {
		msg, ok := tokres["error"]
		if ok {
			return fmt.Errorf("challenge post returned an error: %s", msg)
		}
		return errors.New("invalid response from challenge post")
	}

	return nil
}
