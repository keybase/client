package stellarnet

import (
	"encoding/base64"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/BurntSushi/toml"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/xdr"
)

// HTTPGetter is an interface for making GET http requests.
type HTTPGetter interface {
	Get(url string) (resp *http.Response, err error)
}

// ErrMissingParameter is returned when a required parameter is missing.
type ErrMissingParameter struct {
	Key string
}

// Error implements error for ErrMissingParameter.
func (e ErrMissingParameter) Error() string {
	if e.Key != "" {
		return fmt.Sprintf("request missing required parameter %q", e.Key)
	}
	return "request missing required parameter"
}

// ErrInvalidParameter is returned when a parameter is invalid.
type ErrInvalidParameter struct {
	Key string
}

// Error implements error for ErrInvalidParameter.
func (e ErrInvalidParameter) Error() string {
	if e.Key != "" {
		return fmt.Sprintf("request parameter %q is invalid", e.Key)
	}
	return "request parameter invalid"
}

// ErrNetworkWellKnownOrigin is returned when there is a network error
// fetching the well-known stellar.toml file.
type ErrNetworkWellKnownOrigin struct {
	Wrapped error
}

func (e ErrNetworkWellKnownOrigin) Error() string {
	return "network error getting signing key from origin domain"
}

// ErrInvalidWellKnownOrigin is returned when there the well-known stellar.toml
// file is invalid for the purposes of web+stellar URIs.
type ErrInvalidWellKnownOrigin struct {
	Wrapped error
}

func (e ErrInvalidWellKnownOrigin) Error() string {
	return "invalid origin domain stellar.toml file looking for signing key"
}

// ErrInvalidScheme is returned if the URI scheme is not web+stellar.
var ErrInvalidScheme = errors.New("invalid stellar URI scheme")

// ErrInvalidOperation is returned if the URI operation is not supported.
var ErrInvalidOperation = errors.New("invalid stellar URI operation")

// ErrBadSignature is returned if the signature fails verification.
var ErrBadSignature = errors.New("bad signature")

// SignStellarURI signs a stellar+web URI and returns the URI with the signature
// attached.
func SignStellarURI(uri string, seed SeedStr) (signedURI, signatureB64 string, err error) {
	kp, err := keypair.Parse(seed.SecureNoLogString())
	if err != nil {
		return "", "", err
	}
	payload := payloadFromString(uri)
	signature, err := kp.Sign(payload)
	if err != nil {
		return "", "", err
	}
	signatureB64 = base64.StdEncoding.EncodeToString(signature)
	signatureEsc := url.QueryEscape(signatureB64)

	signedURI = uri + "&signature=" + signatureEsc

	return signedURI, signatureB64, nil
}

// UnvalidatedStellarURIOriginDomain returns just the origin_domain from a stellar URI.
// This is just for informational purposes.
func UnvalidatedStellarURIOriginDomain(uri string) (originDomain string, err error) {
	uv, err := newUnvalidatedURI(uri)
	if err != nil {
		return "", err
	}
	if !isDomainName(uv.OriginDomain) {
		return "", errors.New("invalid origin domain")
	}
	return uv.OriginDomain, nil
}

// ValidatedStellarURI contains the origin domain that ValidateStellarURI
// confirmed
type ValidatedStellarURI struct {
	URI          string
	Operation    string
	OriginDomain string
	Message      string
	CallbackURL  string
	XDR          string
	TxEnv        *xdr.TransactionEnvelope
	Recipient    string
	Amount       string
	AssetCode    string
	AssetIssuer  string
	Memo         string
	MemoType     string
	Signed       bool
}

// ValidateStellarURI will check the validity of a web+stellar SEP7 URI.
//
// It will check that the parameters are valid and that the payload is
// signed with the appropriate key.
func ValidateStellarURI(uri string, getter HTTPGetter) (*ValidatedStellarURI, error) {
	uv, err := newUnvalidatedURI(uri)
	if err != nil {
		return nil, err
	}
	return uv.Validate(getter)
}

// MemoExport returns a Memo type based on Memo, MemoType from the URI.
func (v *ValidatedStellarURI) MemoExport() (*Memo, error) {
	switch v.MemoType {
	case "MEMO_TEXT":
		return NewMemoText(v.Memo), nil
	case "MEMO_ID":
		id, err := strconv.ParseUint(v.Memo, 10, 64)
		if err != nil {
			return nil, err
		}
		return NewMemoID(id), nil
	case "MEMO_HASH":
		hash, err := base64.StdEncoding.DecodeString(v.Memo)
		if err != nil {
			return nil, err
		}
		var bhash MemoHash
		copy(bhash[:], hash)
		return NewMemoHash(bhash), nil
	case "MEMO_RETURN":
		hash, err := base64.StdEncoding.DecodeString(v.Memo)
		if err != nil {
			return nil, err
		}
		var bhash MemoHash
		copy(bhash[:], hash)
		return NewMemoReturn(bhash), nil
	case "":
		if v.Memo == "" {
			return NewMemoNone(), nil
		}
	}

	return nil, errors.New("invalid memo")
}

type unvalidatedURI struct {
	raw          string
	values       url.Values
	Operation    string
	OriginDomain string
	Signature    string
}

func newUnvalidatedURI(uri string) (*unvalidatedURI, error) {
	res := &unvalidatedURI{raw: uri}

	u, err := url.Parse(uri)
	if err != nil {
		return nil, err
	}
	if u.Scheme != "web+stellar" {
		return nil, ErrInvalidScheme
	}

	res.Operation = u.Opaque

	res.values = u.Query()

	res.OriginDomain = res.value("origin_domain")
	res.Signature = res.value("signature")

	return res, nil

}

func (u *unvalidatedURI) Validate(getter HTTPGetter) (*ValidatedStellarURI, error) {
	// URIs without signatures are valid iff the origin domain is also not set
	if u.OriginDomain == "" && u.Signature != "" {
		return nil, ErrMissingParameter{Key: "origin_domain"}
	}
	if u.OriginDomain != "" && u.Signature == "" {
		return nil, ErrMissingParameter{Key: "signature"}
	}

	if u.OriginDomain != "" && !isDomainName(u.OriginDomain) {
		return nil, ErrInvalidParameter{Key: "origin_domain"}
	}

	switch u.Operation {
	case "pay":
		return u.validatePay(getter)
	case "tx":
		return u.validateTx(getter)
	default:
		return nil, ErrInvalidOperation
	}
}

type tomlStellar struct {
	SigningKey string `toml:"URI_REQUEST_SIGNING_KEY"`
}

func (u *unvalidatedURI) originDomainSigningKey(getter HTTPGetter) (string, error) {
	wellKnownURL := fmt.Sprintf("https://%s/.well-known/stellar.toml", u.OriginDomain)
	_, err := url.Parse(wellKnownURL)
	if err != nil {
		return "", ErrInvalidParameter{Key: "origin_domain"}
	}

	resp, err := getter.Get(wellKnownURL)
	if err != nil {
		return "", ErrNetworkWellKnownOrigin{Wrapped: err}
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", ErrInvalidWellKnownOrigin{Wrapped: err}
	}
	if resp.StatusCode != http.StatusOK {
		return "", ErrInvalidWellKnownOrigin{Wrapped: errors.New("stellar.toml not found")}
	}

	var sdoc tomlStellar
	if _, err := toml.Decode(string(body), &sdoc); err != nil {
		return "", ErrInvalidWellKnownOrigin{Wrapped: err}
	}

	return strings.TrimSpace(sdoc.SigningKey), nil
}

// Validates the origin domain. Returns (isSigned, error)
func (u *unvalidatedURI) validateOriginDomain(getter HTTPGetter) (bool, error) {
	if u.Signature == "" {
		return false, nil
	}

	signingKey, err := u.originDomainSigningKey(getter)
	if err != nil {
		return false, err
	}

	if signingKey == "" {
		return false, ErrInvalidWellKnownOrigin{Wrapped: errors.New("no signing key")}
	}

	kp, err := keypair.Parse(signingKey)
	if err != nil {
		return false, ErrInvalidWellKnownOrigin{Wrapped: errors.New("invalid signing key")}
	}

	signature, err := base64.StdEncoding.DecodeString(u.Signature)
	if err != nil {
		return false, ErrBadSignature
	}

	if err := kp.Verify(u.payload(), signature); err != nil {
		return false, ErrBadSignature
	}

	return true, nil
}

func (u *unvalidatedURI) payload() []byte {
	// get the portion of the URI that was signed by stripping &signature off the end
	// note that we are stripping off whatever is the last parameter.  In a valid URI
	// that will be the signature.
	index := strings.LastIndex(u.raw, "&")
	if index == -1 {
		// this shouldn't happen because we already checked that signature
		// exists
		return nil
	}

	return payloadFromString(u.raw[0:index])
}

func (u *unvalidatedURI) validatePay(getter HTTPGetter) (*ValidatedStellarURI, error) {
	signed, err := u.validateOriginDomain(getter)
	if err != nil {
		return nil, err
	}

	destination := u.value("destination")
	if destination == "" {
		return nil, ErrMissingParameter{Key: "destination"}
	}

	validated := u.newValidated("pay")
	validated.Signed = signed
	validated.Recipient = destination
	validated.Amount = u.value("amount")
	validated.AssetCode = u.value("asset_code")
	validated.AssetIssuer = u.value("asset_issuer")
	validated.Memo = u.value("memo")
	validated.MemoType = u.value("memo_type")

	if validated.AssetCode != "" && validated.AssetIssuer == "" {
		return nil, ErrMissingParameter{Key: "asset_issuer"}
	}
	if validated.AssetIssuer != "" && validated.AssetCode == "" {
		return nil, ErrMissingParameter{Key: "asset_code"}
	}
	if validated.Memo != "" && validated.MemoType == "" {
		validated.MemoType = "MEMO_TEXT"
	}
	if validated.MemoType != "" && validated.Memo == "" {
		return nil, ErrMissingParameter{Key: "memo"}
	}

	return validated, nil
}

func (u *unvalidatedURI) validateTx(getter HTTPGetter) (*ValidatedStellarURI, error) {
	xdrEncoded := u.value("xdr")
	if xdrEncoded == "" {
		return nil, ErrMissingParameter{Key: "xdr"}
	}

	signed, err := u.validateOriginDomain(getter)
	if err != nil {
		return nil, err
	}

	// this isn't in the spec (as of May 2019), but the tx parameter
	// is actually a TransactionEnvelope.
	var unvalidatedTxEnv xdr.TransactionEnvelope
	if err := xdr.SafeUnmarshalBase64(xdrEncoded, &unvalidatedTxEnv); err != nil {
		return nil, ErrInvalidParameter{Key: "xdr"}
	}

	validatedTxEnv, err := validateTxEnv(unvalidatedTxEnv)
	if err != nil {
		return nil, err
	}
	validated := u.newValidated("tx")
	validated.Signed = signed
	validated.XDR = xdrEncoded
	validated.TxEnv = &validatedTxEnv

	return validated, nil
}

func validateTxEnv(txEnv xdr.TransactionEnvelope) (validated xdr.TransactionEnvelope, err error) {
	var emptyTxEnv xdr.TransactionEnvelope
	var emptySourceAccount xdr.AccountId
	for _, op := range txEnv.Tx.Operations {
		if op.SourceAccount != nil && *op.SourceAccount == emptySourceAccount {
			return emptyTxEnv, ErrInvalidParameter{Key: "SourceAccount"}
		}
	}
	return txEnv, nil
}

// newValidated returns a new ValidatedStellarURI with the common
// fields populated.
func (u *unvalidatedURI) newValidated(op string) *ValidatedStellarURI {
	return &ValidatedStellarURI{
		URI:          u.raw,
		Operation:    op,
		OriginDomain: u.OriginDomain,
		Message:      u.value("msg"),
		CallbackURL:  u.value("callback"),
	}
}

func (u *unvalidatedURI) value(key string) string {
	return strings.TrimSpace(u.values.Get(key))
}

func payloadFromString(data string) []byte {
	payload := make([]byte, 36)
	payload[35] = 4

	payload = append(payload, []byte("stellar.sep.7 - URI Scheme")...)
	payload = append(payload, []byte(data)...)

	return payload
}

// Copied from Go source for net/dnsclient.go
//
// isDomainName checks if a string is a presentation-format domain name
// (currently restricted to hostname-compatible "preferred name" LDH labels and
// SRV-like "underscore labels"; see golang.org/issue/12421).
func isDomainName(s string) bool {
	// terminal empty label is optional here because we assume fully-qualified
	// (absolute) input. We must therefore reserve space for the first and last
	// labels' length octets in wire format, where they are necessary and the
	// maximum total length is 255.
	// So our _effective_ maximum is 253, but 254 is not rejected if the last
	// character is a dot.
	l := len(s)
	if l == 0 || l > 254 || l == 254 && s[l-1] != '.' {
		return false
	}

	last := byte('.')
	ok := false // Ok once we've seen a letter.
	partlen := 0
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		default:
			return false
		case 'a' <= c && c <= 'z' || 'A' <= c && c <= 'Z' || c == '_':
			ok = true
			partlen++
		case '0' <= c && c <= '9':
			// fine
			partlen++
		case c == '-':
			// Byte before dash cannot be dot.
			if last == '.' {
				return false
			}
			partlen++
		case c == '.':
			// Byte before dot cannot be dot, dash.
			if last == '.' || last == '-' {
				return false
			}
			if partlen > 63 || partlen == 0 {
				return false
			}
			partlen = 0
		}
		last = c
	}
	if last == '-' || partlen > 63 {
		return false
	}

	return ok
}
