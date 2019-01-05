package stellar1

import (
	"encoding/hex"
	"errors"
	"fmt"
	"time"
)

const (
	KeybaseTransactionIDLen       = 16
	KeybaseTransactionIDSuffix    = 0x30
	KeybaseTransactionIDSuffixHex = "30"

	KeybaseRequestIDLen       = 16
	KeybaseRequestIDSuffix    = 0x31
	KeybaseRequestIDSuffixHex = "31"
)

const (
	PushAutoClaim           = "stellar.autoclaim"
	PushPaymentStatus       = "stellar.payment_status"
	PushPaymentNotification = "stellar.payment_notification"
	PushRequestStatus       = "stellar.request_status"
)

func KeybaseTransactionIDFromString(s string) (KeybaseTransactionID, error) {
	if len(s) != hex.EncodedLen(KeybaseTransactionIDLen) {
		return "", fmt.Errorf("bad KeybaseTransactionID %q: must be %d bytes long", s, KeybaseTransactionIDLen)
	}
	suffix := s[len(s)-2:]
	if suffix != KeybaseTransactionIDSuffixHex {
		return "", fmt.Errorf("bad KeybaseTransactionID %q: must end in 0x%x", s, KeybaseTransactionIDSuffix)
	}
	return KeybaseTransactionID(s), nil
}

func (k KeybaseTransactionID) String() string {
	return string(k)
}

func (k KeybaseTransactionID) Eq(b KeybaseTransactionID) bool {
	return k == b
}

func (k KeybaseTransactionID) IsNil() bool {
	return len(k) == 0
}

func TransactionIDFromPaymentID(p PaymentID) TransactionID {
	return TransactionID(p)
}

func (t TransactionID) String() string {
	return string(t)
}

func (t TransactionID) Eq(b TransactionID) bool {
	return t == b
}

func KeybaseRequestIDFromString(s string) (KeybaseRequestID, error) {
	if len(s) != hex.EncodedLen(KeybaseRequestIDLen) {
		return "", fmt.Errorf("bad KeybaseRequestID %q: must be %d bytes long", s, KeybaseRequestIDLen)
	}
	suffix := s[len(s)-2:]
	if suffix != KeybaseRequestIDSuffixHex {
		return "", fmt.Errorf("bad KeybaseRequestID %q: must end in 0x%x", s, KeybaseRequestIDSuffix)
	}
	return KeybaseRequestID(s), nil
}

func (k KeybaseRequestID) String() string {
	return string(k)
}

func (k KeybaseRequestID) Eq(b KeybaseRequestID) bool {
	return k == b
}

func ToTimeMs(t time.Time) TimeMs {
	// the result of calling UnixNano on the zero Time is undefined.
	// https://golang.org/pkg/time/#Time.UnixNano
	if t.IsZero() {
		return 0
	}
	return TimeMs(t.UnixNano() / 1000000)
}

func FromTimeMs(t TimeMs) time.Time {
	if t == 0 {
		return time.Time{}
	}
	return time.Unix(0, int64(t)*1000000)
}

func (t TimeMs) Time() time.Time {
	return FromTimeMs(t)
}

func (a AccountID) String() string {
	return string(a)
}

func (a AccountID) Eq(b AccountID) bool {
	return a == b
}

func (a AccountID) IsNil() bool {
	return len(a) == 0
}

func (a AccountID) LossyAbbreviation() string {
	if len(a) != 56 {
		return "[invalid account id]"
	}
	return fmt.Sprintf("%v...%v", a[:2], a[len(a)-4:len(a)])
}

func (s SecretKey) String() string {
	return "[secret key redacted]"
}

func (s SecretKey) SecureNoLogString() string {
	return string(s)
}

// CheckInvariants checks that the bundle satisfies
// 1. No duplicate account IDs
// 2. Exactly one primary account
// 3. Non-negative revision numbers
func (s Bundle) CheckInvariants() error {
	accountIDs := make(map[AccountID]bool)
	var foundPrimary bool
	for _, entry := range s.Accounts {
		_, found := accountIDs[entry.AccountID]
		if found {
			return fmt.Errorf("duplicate account ID: %v", entry.AccountID)
		}
		accountIDs[entry.AccountID] = true
		if entry.IsPrimary {
			if foundPrimary {
				return errors.New("multiple primary accounts")
			}
			foundPrimary = true
		}
		if entry.Mode == AccountMode_NONE {
			return errors.New("account missing mode")
		}
	}
	if !foundPrimary {
		return errors.New("missing primary account")
	}
	if s.Revision < 1 {
		return fmt.Errorf("revision %v < 1", s.Revision)
	}
	return nil
}

// CheckInvariants checks that the BundleRestricted satisfies
// 1. No duplicate account IDs
// 2. Exactly one primary account
// 3. Non-negative revision numbers
// 4. Account Bundle maps to Accounts
func (r BundleRestricted) CheckInvariants() error {
	accountIDs := make(map[AccountID]bool)
	var foundPrimary bool
	for _, entry := range r.Accounts {
		_, found := accountIDs[entry.AccountID]
		if found {
			return fmt.Errorf("duplicate account ID: %v", entry.AccountID)
		}
		accountIDs[entry.AccountID] = true
		if entry.IsPrimary {
			if foundPrimary {
				return errors.New("multiple primary accounts")
			}
			foundPrimary = true
		}
		if entry.Mode == AccountMode_NONE {
			return errors.New("account missing mode")
		}
		if entry.AcctBundleRevision < 1 {
			return fmt.Errorf("account bundle revision %v < 1 for %v", entry.AcctBundleRevision, entry.AccountID)
		}
	}
	if !foundPrimary {
		return errors.New("missing primary account")
	}
	if r.Revision < 1 {
		return fmt.Errorf("revision %v < 1", r.Revision)
	}
	for accID, accBundle := range r.AccountBundles {
		if accID != accBundle.AccountID {
			return fmt.Errorf("account ID mismatch in bundle for %v", accID)
		}
	}
	return nil
}

func (s Bundle) PrimaryAccount() (BundleEntry, error) {
	for _, entry := range s.Accounts {
		if entry.IsPrimary {
			return entry, nil
		}
	}
	return BundleEntry{}, errors.New("primary stellar account not found")
}

func (s BundleRestricted) PrimaryAccount() (BundleEntryRestricted, error) {
	for _, entry := range s.Accounts {
		if entry.IsPrimary {
			return entry, nil
		}
	}
	return BundleEntryRestricted{}, errors.New("primary stellar account not found")
}

func (s Bundle) Lookup(acctID AccountID) (BundleEntry, error) {
	for _, entry := range s.Accounts {
		if entry.AccountID == acctID {
			return entry, nil
		}
	}
	return BundleEntry{}, errors.New("stellar account not found")
}

func (s BundleRestricted) Lookup(acctID AccountID) (BundleEntryRestricted, error) {
	for _, entry := range s.Accounts {
		if entry.AccountID == acctID {
			return entry, nil
		}
	}
	return BundleEntryRestricted{}, errors.New("stellar account not found")
}

// Eq compares assets strictly.
// Assets are not Eq if their type is different
//   even if they have the same code and issuer.
func (a Asset) Eq(b Asset) bool {
	return a == b
}

func (a *Asset) IsNativeXLM() bool {
	return a.Type == "native"
}

func AssetNative() Asset {
	return Asset{
		Type:   "native",
		Code:   "",
		Issuer: "",
	}
}

func CreateNonNativeAssetType(code string) (string, error) {
	if len(code) >= 1 && len(code) <= 4 {
		return "credit_alphanum4", nil
	} else if len(code) >= 5 && len(code) <= 12 {
		return "credit_alphanum12", nil
	} else {
		return "", fmt.Errorf("Invalid asset code: %q", code)
	}
}

func (t TransactionStatus) ToPaymentStatus() PaymentStatus {
	switch t {
	case TransactionStatus_PENDING:
		return PaymentStatus_PENDING
	case TransactionStatus_SUCCESS:
		return PaymentStatus_COMPLETED
	case TransactionStatus_ERROR_TRANSIENT, TransactionStatus_ERROR_PERMANENT:
		return PaymentStatus_ERROR
	default:
		return PaymentStatus_UNKNOWN
	}

}

func (t TransactionStatus) Details(errMsg string) (status, detail string) {
	switch t {
	case TransactionStatus_PENDING:
		status = "pending"
	case TransactionStatus_SUCCESS:
		status = "completed"
	case TransactionStatus_ERROR_TRANSIENT, TransactionStatus_ERROR_PERMANENT:
		status = "error"
		detail = errMsg
	default:
		status = "unknown"
		detail = errMsg
	}

	return status, detail
}

func NewPaymentLocal(txid TransactionID, ctime TimeMs) *PaymentLocal {
	return &PaymentLocal{
		Id:   NewPaymentID(txid),
		Time: ctime,
	}
}

func NewPaymentID(txid TransactionID) PaymentID {
	return PaymentID(txid)
}

func (p PaymentID) String() string {
	return string(p)
}

func (p *PaymentSummary) ToDetails() *PaymentDetails {
	return &PaymentDetails{
		Summary: *p,
	}
}

func (p *PaymentSummary) TransactionID() (TransactionID, error) {
	t, err := p.Typ()
	if err != nil {
		return "", err
	}

	switch t {
	case PaymentSummaryType_STELLAR:
		s := p.Stellar()
		return s.TxID, nil
	case PaymentSummaryType_DIRECT:
		s := p.Direct()
		return s.TxID, nil
	case PaymentSummaryType_RELAY:
		s := p.Relay()
		return s.TxID, nil
	}

	return "", errors.New("unknown payment summary type")
}

func (p *PaymentSummary) TransactionStatus() (TransactionStatus, error) {
	t, err := p.Typ()
	if err != nil {
		return TransactionStatus_NONE, err
	}

	switch t {
	case PaymentSummaryType_STELLAR:
		return TransactionStatus_SUCCESS, nil
	case PaymentSummaryType_DIRECT:
		return p.Direct().TxStatus, nil
	case PaymentSummaryType_RELAY:
		return p.Relay().TxStatus, nil
	}

	return TransactionStatus_NONE, errors.New("unknown payment summary type")
}

func (c *ClaimSummary) ToPaymentStatus() PaymentStatus {
	txStatus := c.TxStatus.ToPaymentStatus()
	switch txStatus {
	case PaymentStatus_COMPLETED:
		if c.Dir == RelayDirection_YANK {
			return PaymentStatus_CANCELED
		}
	}
	return txStatus
}

func (d *StellarServerDefinitions) GetCurrencyLocal(code OutsideCurrencyCode) (res CurrencyLocal, ok bool) {
	def, found := d.Currencies[code]
	if found {
		res = CurrencyLocal{
			Description: fmt.Sprintf("%s (%s)", string(code), def.Symbol.Symbol),
			Code:        code,
			Symbol:      def.Symbol.Symbol,
			Name:        def.Name,
		}
		ok = true
	} else {
		res = CurrencyLocal{
			Code: code,
		}
		ok = false
	}
	return res, ok
}

func (c OutsideCurrencyCode) String() string {
	return string(c)
}

func (b BuildPaymentID) String() string {
	return string(b)
}

func (b BuildPaymentID) IsNil() bool {
	return len(b) == 0
}

func (b BuildPaymentID) Eq(other BuildPaymentID) bool {
	return b == other
}

func NewChatConversationID(b []byte) *ChatConversationID {
	cid := ChatConversationID(hex.EncodeToString(b))
	return &cid
}

func (a *AccountDetails) SetDefaultDisplayCurrency() {
	if a.DisplayCurrency == "" {
		a.DisplayCurrency = "USD"
	}
}
