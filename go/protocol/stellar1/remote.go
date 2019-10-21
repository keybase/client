// Auto-generated to Go types and interfaces using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/stellar1/remote.avdl

package stellar1

import (
	"errors"
	"fmt"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type ChatConversationID string

func (o ChatConversationID) DeepCopy() ChatConversationID {
	return o
}

type PaymentDirectPost struct {
	FromDeviceID       keybase1.DeviceID     `codec:"fromDeviceID" json:"fromDeviceID"`
	To                 *keybase1.UserVersion `codec:"to,omitempty" json:"to,omitempty"`
	DisplayAmount      string                `codec:"displayAmount" json:"displayAmount"`
	DisplayCurrency    string                `codec:"displayCurrency" json:"displayCurrency"`
	NoteB64            string                `codec:"noteB64" json:"noteB64"`
	SignedTransaction  string                `codec:"signedTransaction" json:"signedTransaction"`
	QuickReturn        bool                  `codec:"quickReturn" json:"quickReturn"`
	ChatConversationID *ChatConversationID   `codec:"chatConversationID,omitempty" json:"chatConversationID,omitempty"`
	BatchID            string                `codec:"batchID" json:"batchID"`
}

func (o PaymentDirectPost) DeepCopy() PaymentDirectPost {
	return PaymentDirectPost{
		FromDeviceID: o.FromDeviceID.DeepCopy(),
		To: (func(x *keybase1.UserVersion) *keybase1.UserVersion {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.To),
		DisplayAmount:     o.DisplayAmount,
		DisplayCurrency:   o.DisplayCurrency,
		NoteB64:           o.NoteB64,
		SignedTransaction: o.SignedTransaction,
		QuickReturn:       o.QuickReturn,
		ChatConversationID: (func(x *ChatConversationID) *ChatConversationID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ChatConversationID),
		BatchID: o.BatchID,
	}
}

type PaymentRelayPost struct {
	FromDeviceID       keybase1.DeviceID     `codec:"fromDeviceID" json:"fromDeviceID"`
	To                 *keybase1.UserVersion `codec:"to,omitempty" json:"to,omitempty"`
	ToAssertion        string                `codec:"toAssertion" json:"toAssertion"`
	RelayAccount       AccountID             `codec:"relayAccount" json:"relayAccount"`
	TeamID             keybase1.TeamID       `codec:"teamID" json:"teamID"`
	DisplayAmount      string                `codec:"displayAmount" json:"displayAmount"`
	DisplayCurrency    string                `codec:"displayCurrency" json:"displayCurrency"`
	BoxB64             string                `codec:"boxB64" json:"boxB64"`
	SignedTransaction  string                `codec:"signedTransaction" json:"signedTransaction"`
	QuickReturn        bool                  `codec:"quickReturn" json:"quickReturn"`
	ChatConversationID *ChatConversationID   `codec:"chatConversationID,omitempty" json:"chatConversationID,omitempty"`
	BatchID            string                `codec:"batchID" json:"batchID"`
}

func (o PaymentRelayPost) DeepCopy() PaymentRelayPost {
	return PaymentRelayPost{
		FromDeviceID: o.FromDeviceID.DeepCopy(),
		To: (func(x *keybase1.UserVersion) *keybase1.UserVersion {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.To),
		ToAssertion:       o.ToAssertion,
		RelayAccount:      o.RelayAccount.DeepCopy(),
		TeamID:            o.TeamID.DeepCopy(),
		DisplayAmount:     o.DisplayAmount,
		DisplayCurrency:   o.DisplayCurrency,
		BoxB64:            o.BoxB64,
		SignedTransaction: o.SignedTransaction,
		QuickReturn:       o.QuickReturn,
		ChatConversationID: (func(x *ChatConversationID) *ChatConversationID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ChatConversationID),
		BatchID: o.BatchID,
	}
}

type RelayClaimPost struct {
	KeybaseID         KeybaseTransactionID `codec:"keybaseID" json:"keybaseID"`
	Dir               RelayDirection       `codec:"dir" json:"dir"`
	SignedTransaction string               `codec:"signedTransaction" json:"signedTransaction"`
	AutoClaimToken    *string              `codec:"autoClaimToken,omitempty" json:"autoClaimToken,omitempty"`
}

func (o RelayClaimPost) DeepCopy() RelayClaimPost {
	return RelayClaimPost{
		KeybaseID:         o.KeybaseID.DeepCopy(),
		Dir:               o.Dir.DeepCopy(),
		SignedTransaction: o.SignedTransaction,
		AutoClaimToken: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.AutoClaimToken),
	}
}

type PathPaymentPost struct {
	FromDeviceID       keybase1.DeviceID     `codec:"fromDeviceID" json:"fromDeviceID"`
	To                 *keybase1.UserVersion `codec:"to,omitempty" json:"to,omitempty"`
	NoteB64            string                `codec:"noteB64" json:"noteB64"`
	SignedTransaction  string                `codec:"signedTransaction" json:"signedTransaction"`
	QuickReturn        bool                  `codec:"quickReturn" json:"quickReturn"`
	ChatConversationID *ChatConversationID   `codec:"chatConversationID,omitempty" json:"chatConversationID,omitempty"`
}

func (o PathPaymentPost) DeepCopy() PathPaymentPost {
	return PathPaymentPost{
		FromDeviceID: o.FromDeviceID.DeepCopy(),
		To: (func(x *keybase1.UserVersion) *keybase1.UserVersion {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.To),
		NoteB64:           o.NoteB64,
		SignedTransaction: o.SignedTransaction,
		QuickReturn:       o.QuickReturn,
		ChatConversationID: (func(x *ChatConversationID) *ChatConversationID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ChatConversationID),
	}
}

type DirectOp struct {
	NoteB64 string `codec:"noteB64" json:"noteB64"`
}

func (o DirectOp) DeepCopy() DirectOp {
	return DirectOp{
		NoteB64: o.NoteB64,
	}
}

type RelayOp struct {
	ToAssertion  string          `codec:"toAssertion" json:"toAssertion"`
	RelayAccount AccountID       `codec:"relayAccount" json:"relayAccount"`
	TeamID       keybase1.TeamID `codec:"teamID" json:"teamID"`
	BoxB64       string          `codec:"boxB64" json:"boxB64"`
}

func (o RelayOp) DeepCopy() RelayOp {
	return RelayOp{
		ToAssertion:  o.ToAssertion,
		RelayAccount: o.RelayAccount.DeepCopy(),
		TeamID:       o.TeamID.DeepCopy(),
		BoxB64:       o.BoxB64,
	}
}

type PaymentOp struct {
	To     *keybase1.UserVersion `codec:"to,omitempty" json:"to,omitempty"`
	Direct *DirectOp             `codec:"direct,omitempty" json:"direct,omitempty"`
	Relay  *RelayOp              `codec:"relay,omitempty" json:"relay,omitempty"`
}

func (o PaymentOp) DeepCopy() PaymentOp {
	return PaymentOp{
		To: (func(x *keybase1.UserVersion) *keybase1.UserVersion {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.To),
		Direct: (func(x *DirectOp) *DirectOp {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Direct),
		Relay: (func(x *RelayOp) *RelayOp {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Relay),
	}
}

type PaymentMultiPost struct {
	FromDeviceID      keybase1.DeviceID `codec:"fromDeviceID" json:"fromDeviceID"`
	SignedTransaction string            `codec:"signedTransaction" json:"signedTransaction"`
	Operations        []PaymentOp       `codec:"operations" json:"operations"`
	BatchID           string            `codec:"batchID" json:"batchID"`
}

func (o PaymentMultiPost) DeepCopy() PaymentMultiPost {
	return PaymentMultiPost{
		FromDeviceID:      o.FromDeviceID.DeepCopy(),
		SignedTransaction: o.SignedTransaction,
		Operations: (func(x []PaymentOp) []PaymentOp {
			if x == nil {
				return nil
			}
			ret := make([]PaymentOp, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Operations),
		BatchID: o.BatchID,
	}
}

type PaymentSummaryType int

const (
	PaymentSummaryType_NONE    PaymentSummaryType = 0
	PaymentSummaryType_STELLAR PaymentSummaryType = 1
	PaymentSummaryType_DIRECT  PaymentSummaryType = 2
	PaymentSummaryType_RELAY   PaymentSummaryType = 3
)

func (o PaymentSummaryType) DeepCopy() PaymentSummaryType { return o }

var PaymentSummaryTypeMap = map[string]PaymentSummaryType{
	"NONE":    0,
	"STELLAR": 1,
	"DIRECT":  2,
	"RELAY":   3,
}

var PaymentSummaryTypeRevMap = map[PaymentSummaryType]string{
	0: "NONE",
	1: "STELLAR",
	2: "DIRECT",
	3: "RELAY",
}

func (e PaymentSummaryType) String() string {
	if v, ok := PaymentSummaryTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type PaymentSummary struct {
	Typ__     PaymentSummaryType     `codec:"typ" json:"typ"`
	Stellar__ *PaymentSummaryStellar `codec:"stellar,omitempty" json:"stellar,omitempty"`
	Direct__  *PaymentSummaryDirect  `codec:"direct,omitempty" json:"direct,omitempty"`
	Relay__   *PaymentSummaryRelay   `codec:"relay,omitempty" json:"relay,omitempty"`
}

func (o *PaymentSummary) Typ() (ret PaymentSummaryType, err error) {
	switch o.Typ__ {
	case PaymentSummaryType_STELLAR:
		if o.Stellar__ == nil {
			err = errors.New("unexpected nil value for Stellar__")
			return ret, err
		}
	case PaymentSummaryType_DIRECT:
		if o.Direct__ == nil {
			err = errors.New("unexpected nil value for Direct__")
			return ret, err
		}
	case PaymentSummaryType_RELAY:
		if o.Relay__ == nil {
			err = errors.New("unexpected nil value for Relay__")
			return ret, err
		}
	}
	return o.Typ__, nil
}

func (o PaymentSummary) Stellar() (res PaymentSummaryStellar) {
	if o.Typ__ != PaymentSummaryType_STELLAR {
		panic("wrong case accessed")
	}
	if o.Stellar__ == nil {
		return
	}
	return *o.Stellar__
}

func (o PaymentSummary) Direct() (res PaymentSummaryDirect) {
	if o.Typ__ != PaymentSummaryType_DIRECT {
		panic("wrong case accessed")
	}
	if o.Direct__ == nil {
		return
	}
	return *o.Direct__
}

func (o PaymentSummary) Relay() (res PaymentSummaryRelay) {
	if o.Typ__ != PaymentSummaryType_RELAY {
		panic("wrong case accessed")
	}
	if o.Relay__ == nil {
		return
	}
	return *o.Relay__
}

func NewPaymentSummaryWithStellar(v PaymentSummaryStellar) PaymentSummary {
	return PaymentSummary{
		Typ__:     PaymentSummaryType_STELLAR,
		Stellar__: &v,
	}
}

func NewPaymentSummaryWithDirect(v PaymentSummaryDirect) PaymentSummary {
	return PaymentSummary{
		Typ__:    PaymentSummaryType_DIRECT,
		Direct__: &v,
	}
}

func NewPaymentSummaryWithRelay(v PaymentSummaryRelay) PaymentSummary {
	return PaymentSummary{
		Typ__:   PaymentSummaryType_RELAY,
		Relay__: &v,
	}
}

func (o PaymentSummary) DeepCopy() PaymentSummary {
	return PaymentSummary{
		Typ__: o.Typ__.DeepCopy(),
		Stellar__: (func(x *PaymentSummaryStellar) *PaymentSummaryStellar {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Stellar__),
		Direct__: (func(x *PaymentSummaryDirect) *PaymentSummaryDirect {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Direct__),
		Relay__: (func(x *PaymentSummaryRelay) *PaymentSummaryRelay {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Relay__),
	}
}

type PaymentSummaryStellar struct {
	TxID               TransactionID          `codec:"txID" json:"txID"`
	From               AccountID              `codec:"from" json:"from"`
	To                 AccountID              `codec:"to" json:"to"`
	Amount             string                 `codec:"amount" json:"amount"`
	Asset              Asset                  `codec:"asset" json:"asset"`
	Ctime              TimeMs                 `codec:"ctime" json:"ctime"`
	CursorToken        string                 `codec:"cursorToken" json:"cursorToken"`
	Unread             bool                   `codec:"unread" json:"unread"`
	IsInflation        bool                   `codec:"isInflation" json:"isInflation"`
	InflationSource    *string                `codec:"inflationSource,omitempty" json:"inflationSource,omitempty"`
	SourceAmountMax    string                 `codec:"sourceAmountMax" json:"sourceAmountMax"`
	SourceAmountActual string                 `codec:"sourceAmountActual" json:"sourceAmountActual"`
	SourceAsset        Asset                  `codec:"sourceAsset" json:"sourceAsset"`
	IsAdvanced         bool                   `codec:"isAdvanced" json:"isAdvanced"`
	SummaryAdvanced    string                 `codec:"summaryAdvanced" json:"summaryAdvanced"`
	Operations         []string               `codec:"operations" json:"operations"`
	Trustline          *PaymentTrustlineLocal `codec:"trustline,omitempty" json:"trustline,omitempty"`
}

func (o PaymentSummaryStellar) DeepCopy() PaymentSummaryStellar {
	return PaymentSummaryStellar{
		TxID:        o.TxID.DeepCopy(),
		From:        o.From.DeepCopy(),
		To:          o.To.DeepCopy(),
		Amount:      o.Amount,
		Asset:       o.Asset.DeepCopy(),
		Ctime:       o.Ctime.DeepCopy(),
		CursorToken: o.CursorToken,
		Unread:      o.Unread,
		IsInflation: o.IsInflation,
		InflationSource: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.InflationSource),
		SourceAmountMax:    o.SourceAmountMax,
		SourceAmountActual: o.SourceAmountActual,
		SourceAsset:        o.SourceAsset.DeepCopy(),
		IsAdvanced:         o.IsAdvanced,
		SummaryAdvanced:    o.SummaryAdvanced,
		Operations: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Operations),
		Trustline: (func(x *PaymentTrustlineLocal) *PaymentTrustlineLocal {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Trustline),
	}
}

type PaymentSummaryDirect struct {
	KbTxID              KeybaseTransactionID  `codec:"kbTxID" json:"kbTxID"`
	TxID                TransactionID         `codec:"txID" json:"txID"`
	TxStatus            TransactionStatus     `codec:"txStatus" json:"txStatus"`
	TxErrMsg            string                `codec:"txErrMsg" json:"txErrMsg"`
	FromStellar         AccountID             `codec:"fromStellar" json:"fromStellar"`
	From                keybase1.UserVersion  `codec:"from" json:"from"`
	FromDeviceID        keybase1.DeviceID     `codec:"fromDeviceID" json:"fromDeviceID"`
	ToStellar           AccountID             `codec:"toStellar" json:"toStellar"`
	To                  *keybase1.UserVersion `codec:"to,omitempty" json:"to,omitempty"`
	Amount              string                `codec:"amount" json:"amount"`
	Asset               Asset                 `codec:"asset" json:"asset"`
	DisplayAmount       *string               `codec:"displayAmount,omitempty" json:"displayAmount,omitempty"`
	DisplayCurrency     *string               `codec:"displayCurrency,omitempty" json:"displayCurrency,omitempty"`
	NoteB64             string                `codec:"noteB64" json:"noteB64"`
	FromDisplayAmount   string                `codec:"fromDisplayAmount" json:"fromDisplayAmount"`
	FromDisplayCurrency string                `codec:"fromDisplayCurrency" json:"fromDisplayCurrency"`
	ToDisplayAmount     string                `codec:"toDisplayAmount" json:"toDisplayAmount"`
	ToDisplayCurrency   string                `codec:"toDisplayCurrency" json:"toDisplayCurrency"`
	Ctime               TimeMs                `codec:"ctime" json:"ctime"`
	Rtime               TimeMs                `codec:"rtime" json:"rtime"`
	CursorToken         string                `codec:"cursorToken" json:"cursorToken"`
	Unread              bool                  `codec:"unread" json:"unread"`
	FromPrimary         bool                  `codec:"fromPrimary" json:"fromPrimary"`
	BatchID             string                `codec:"batchID" json:"batchID"`
	FromAirdrop         bool                  `codec:"fromAirdrop" json:"fromAirdrop"`
	SourceAmountMax     string                `codec:"sourceAmountMax" json:"sourceAmountMax"`
	SourceAmountActual  string                `codec:"sourceAmountActual" json:"sourceAmountActual"`
	SourceAsset         Asset                 `codec:"sourceAsset" json:"sourceAsset"`
}

func (o PaymentSummaryDirect) DeepCopy() PaymentSummaryDirect {
	return PaymentSummaryDirect{
		KbTxID:       o.KbTxID.DeepCopy(),
		TxID:         o.TxID.DeepCopy(),
		TxStatus:     o.TxStatus.DeepCopy(),
		TxErrMsg:     o.TxErrMsg,
		FromStellar:  o.FromStellar.DeepCopy(),
		From:         o.From.DeepCopy(),
		FromDeviceID: o.FromDeviceID.DeepCopy(),
		ToStellar:    o.ToStellar.DeepCopy(),
		To: (func(x *keybase1.UserVersion) *keybase1.UserVersion {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.To),
		Amount: o.Amount,
		Asset:  o.Asset.DeepCopy(),
		DisplayAmount: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.DisplayAmount),
		DisplayCurrency: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.DisplayCurrency),
		NoteB64:             o.NoteB64,
		FromDisplayAmount:   o.FromDisplayAmount,
		FromDisplayCurrency: o.FromDisplayCurrency,
		ToDisplayAmount:     o.ToDisplayAmount,
		ToDisplayCurrency:   o.ToDisplayCurrency,
		Ctime:               o.Ctime.DeepCopy(),
		Rtime:               o.Rtime.DeepCopy(),
		CursorToken:         o.CursorToken,
		Unread:              o.Unread,
		FromPrimary:         o.FromPrimary,
		BatchID:             o.BatchID,
		FromAirdrop:         o.FromAirdrop,
		SourceAmountMax:     o.SourceAmountMax,
		SourceAmountActual:  o.SourceAmountActual,
		SourceAsset:         o.SourceAsset.DeepCopy(),
	}
}

type PaymentSummaryRelay struct {
	KbTxID          KeybaseTransactionID  `codec:"kbTxID" json:"kbTxID"`
	TxID            TransactionID         `codec:"txID" json:"txID"`
	TxStatus        TransactionStatus     `codec:"txStatus" json:"txStatus"`
	TxErrMsg        string                `codec:"txErrMsg" json:"txErrMsg"`
	FromStellar     AccountID             `codec:"fromStellar" json:"fromStellar"`
	From            keybase1.UserVersion  `codec:"from" json:"from"`
	FromDeviceID    keybase1.DeviceID     `codec:"fromDeviceID" json:"fromDeviceID"`
	To              *keybase1.UserVersion `codec:"to,omitempty" json:"to,omitempty"`
	ToAssertion     string                `codec:"toAssertion" json:"toAssertion"`
	RelayAccount    AccountID             `codec:"relayAccount" json:"relayAccount"`
	Amount          string                `codec:"amount" json:"amount"`
	DisplayAmount   *string               `codec:"displayAmount,omitempty" json:"displayAmount,omitempty"`
	DisplayCurrency *string               `codec:"displayCurrency,omitempty" json:"displayCurrency,omitempty"`
	Ctime           TimeMs                `codec:"ctime" json:"ctime"`
	Rtime           TimeMs                `codec:"rtime" json:"rtime"`
	BoxB64          string                `codec:"boxB64" json:"boxB64"`
	TeamID          keybase1.TeamID       `codec:"teamID" json:"teamID"`
	Claim           *ClaimSummary         `codec:"claim,omitempty" json:"claim,omitempty"`
	CursorToken     string                `codec:"cursorToken" json:"cursorToken"`
	BatchID         string                `codec:"batchID" json:"batchID"`
	FromAirdrop     bool                  `codec:"fromAirdrop" json:"fromAirdrop"`
}

func (o PaymentSummaryRelay) DeepCopy() PaymentSummaryRelay {
	return PaymentSummaryRelay{
		KbTxID:       o.KbTxID.DeepCopy(),
		TxID:         o.TxID.DeepCopy(),
		TxStatus:     o.TxStatus.DeepCopy(),
		TxErrMsg:     o.TxErrMsg,
		FromStellar:  o.FromStellar.DeepCopy(),
		From:         o.From.DeepCopy(),
		FromDeviceID: o.FromDeviceID.DeepCopy(),
		To: (func(x *keybase1.UserVersion) *keybase1.UserVersion {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.To),
		ToAssertion:  o.ToAssertion,
		RelayAccount: o.RelayAccount.DeepCopy(),
		Amount:       o.Amount,
		DisplayAmount: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.DisplayAmount),
		DisplayCurrency: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.DisplayCurrency),
		Ctime:  o.Ctime.DeepCopy(),
		Rtime:  o.Rtime.DeepCopy(),
		BoxB64: o.BoxB64,
		TeamID: o.TeamID.DeepCopy(),
		Claim: (func(x *ClaimSummary) *ClaimSummary {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Claim),
		CursorToken: o.CursorToken,
		BatchID:     o.BatchID,
		FromAirdrop: o.FromAirdrop,
	}
}

type ClaimSummary struct {
	TxID      TransactionID        `codec:"txID" json:"txID"`
	TxStatus  TransactionStatus    `codec:"txStatus" json:"txStatus"`
	TxErrMsg  string               `codec:"txErrMsg" json:"txErrMsg"`
	Dir       RelayDirection       `codec:"dir" json:"dir"`
	ToStellar AccountID            `codec:"toStellar" json:"toStellar"`
	To        keybase1.UserVersion `codec:"to" json:"to"`
}

func (o ClaimSummary) DeepCopy() ClaimSummary {
	return ClaimSummary{
		TxID:      o.TxID.DeepCopy(),
		TxStatus:  o.TxStatus.DeepCopy(),
		TxErrMsg:  o.TxErrMsg,
		Dir:       o.Dir.DeepCopy(),
		ToStellar: o.ToStellar.DeepCopy(),
		To:        o.To.DeepCopy(),
	}
}

type PaymentDetails struct {
	Summary          PaymentSummary `codec:"summary" json:"summary"`
	Memo             string         `codec:"memo" json:"memo"`
	MemoType         string         `codec:"memoType" json:"memoType"`
	ExternalTxURL    string         `codec:"externalTxURL" json:"externalTxURL"`
	FeeCharged       string         `codec:"feeCharged" json:"feeCharged"`
	PathIntermediate []Asset        `codec:"pathIntermediate" json:"pathIntermediate"`
}

func (o PaymentDetails) DeepCopy() PaymentDetails {
	return PaymentDetails{
		Summary:       o.Summary.DeepCopy(),
		Memo:          o.Memo,
		MemoType:      o.MemoType,
		ExternalTxURL: o.ExternalTxURL,
		FeeCharged:    o.FeeCharged,
		PathIntermediate: (func(x []Asset) []Asset {
			if x == nil {
				return nil
			}
			ret := make([]Asset, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.PathIntermediate),
	}
}

type AccountDetails struct {
	AccountID            AccountID        `codec:"accountID" json:"accountID"`
	Seqno                string           `codec:"seqno" json:"seqno"`
	Balances             []Balance        `codec:"balances" json:"balances"`
	SubentryCount        int              `codec:"subentryCount" json:"subentryCount"`
	Available            string           `codec:"available" json:"available"`
	Reserves             []AccountReserve `codec:"reserves" json:"reserves"`
	ReadTransactionID    *TransactionID   `codec:"readTransactionID,omitempty" json:"readTransactionID,omitempty"`
	UnreadPayments       int              `codec:"unreadPayments" json:"unreadPayments"`
	DisplayCurrency      string           `codec:"displayCurrency" json:"displayCurrency"`
	InflationDestination *AccountID       `codec:"inflationDestination,omitempty" json:"inflationDestination,omitempty"`
}

func (o AccountDetails) DeepCopy() AccountDetails {
	return AccountDetails{
		AccountID: o.AccountID.DeepCopy(),
		Seqno:     o.Seqno,
		Balances: (func(x []Balance) []Balance {
			if x == nil {
				return nil
			}
			ret := make([]Balance, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Balances),
		SubentryCount: o.SubentryCount,
		Available:     o.Available,
		Reserves: (func(x []AccountReserve) []AccountReserve {
			if x == nil {
				return nil
			}
			ret := make([]AccountReserve, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Reserves),
		ReadTransactionID: (func(x *TransactionID) *TransactionID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ReadTransactionID),
		UnreadPayments:  o.UnreadPayments,
		DisplayCurrency: o.DisplayCurrency,
		InflationDestination: (func(x *AccountID) *AccountID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.InflationDestination),
	}
}

type PaymentsPage struct {
	Payments     []PaymentSummary `codec:"payments" json:"payments"`
	Cursor       *PageCursor      `codec:"cursor,omitempty" json:"cursor,omitempty"`
	OldestUnread *TransactionID   `codec:"oldestUnread,omitempty" json:"oldestUnread,omitempty"`
}

func (o PaymentsPage) DeepCopy() PaymentsPage {
	return PaymentsPage{
		Payments: (func(x []PaymentSummary) []PaymentSummary {
			if x == nil {
				return nil
			}
			ret := make([]PaymentSummary, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Payments),
		Cursor: (func(x *PageCursor) *PageCursor {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Cursor),
		OldestUnread: (func(x *TransactionID) *TransactionID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.OldestUnread),
	}
}

type SubmitMultiRes struct {
	TxID TransactionID `codec:"txID" json:"txID"`
}

func (o SubmitMultiRes) DeepCopy() SubmitMultiRes {
	return SubmitMultiRes{
		TxID: o.TxID.DeepCopy(),
	}
}

type AutoClaim struct {
	KbTxID KeybaseTransactionID `codec:"kbTxID" json:"kbTxID"`
}

func (o AutoClaim) DeepCopy() AutoClaim {
	return AutoClaim{
		KbTxID: o.KbTxID.DeepCopy(),
	}
}

type RequestPost struct {
	ToUser      *keybase1.UserVersion `codec:"toUser,omitempty" json:"toUser,omitempty"`
	ToAssertion string                `codec:"toAssertion" json:"toAssertion"`
	Amount      string                `codec:"amount" json:"amount"`
	Asset       *Asset                `codec:"asset,omitempty" json:"asset,omitempty"`
	Currency    *OutsideCurrencyCode  `codec:"currency,omitempty" json:"currency,omitempty"`
}

func (o RequestPost) DeepCopy() RequestPost {
	return RequestPost{
		ToUser: (func(x *keybase1.UserVersion) *keybase1.UserVersion {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ToUser),
		ToAssertion: o.ToAssertion,
		Amount:      o.Amount,
		Asset: (func(x *Asset) *Asset {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Asset),
		Currency: (func(x *OutsideCurrencyCode) *OutsideCurrencyCode {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Currency),
	}
}

type RequestDetails struct {
	Id                  KeybaseRequestID      `codec:"id" json:"id"`
	FromUser            keybase1.UserVersion  `codec:"fromUser" json:"fromUser"`
	ToUser              *keybase1.UserVersion `codec:"toUser,omitempty" json:"toUser,omitempty"`
	ToAssertion         string                `codec:"toAssertion" json:"toAssertion"`
	Amount              string                `codec:"amount" json:"amount"`
	Asset               *Asset                `codec:"asset,omitempty" json:"asset,omitempty"`
	Currency            *OutsideCurrencyCode  `codec:"currency,omitempty" json:"currency,omitempty"`
	FromDisplayAmount   string                `codec:"fromDisplayAmount" json:"fromDisplayAmount"`
	FromDisplayCurrency string                `codec:"fromDisplayCurrency" json:"fromDisplayCurrency"`
	ToDisplayAmount     string                `codec:"toDisplayAmount" json:"toDisplayAmount"`
	ToDisplayCurrency   string                `codec:"toDisplayCurrency" json:"toDisplayCurrency"`
	FundingKbTxID       KeybaseTransactionID  `codec:"fundingKbTxID" json:"fundingKbTxID"`
	Status              RequestStatus         `codec:"status" json:"status"`
}

func (o RequestDetails) DeepCopy() RequestDetails {
	return RequestDetails{
		Id:       o.Id.DeepCopy(),
		FromUser: o.FromUser.DeepCopy(),
		ToUser: (func(x *keybase1.UserVersion) *keybase1.UserVersion {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ToUser),
		ToAssertion: o.ToAssertion,
		Amount:      o.Amount,
		Asset: (func(x *Asset) *Asset {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Asset),
		Currency: (func(x *OutsideCurrencyCode) *OutsideCurrencyCode {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Currency),
		FromDisplayAmount:   o.FromDisplayAmount,
		FromDisplayCurrency: o.FromDisplayCurrency,
		ToDisplayAmount:     o.ToDisplayAmount,
		ToDisplayCurrency:   o.ToDisplayCurrency,
		FundingKbTxID:       o.FundingKbTxID.DeepCopy(),
		Status:              o.Status.DeepCopy(),
	}
}

type TimeboundsRecommendation struct {
	TimeNow keybase1.UnixTime `codec:"timeNow" json:"time_now"`
	Timeout int64             `codec:"timeout" json:"timeout"`
}

func (o TimeboundsRecommendation) DeepCopy() TimeboundsRecommendation {
	return TimeboundsRecommendation{
		TimeNow: o.TimeNow.DeepCopy(),
		Timeout: o.Timeout,
	}
}

type NetworkOptions struct {
	BaseFee uint64 `codec:"baseFee" json:"baseFee"`
}

func (o NetworkOptions) DeepCopy() NetworkOptions {
	return NetworkOptions{
		BaseFee: o.BaseFee,
	}
}

type DetailsPlusPayments struct {
	Details         AccountDetails   `codec:"details" json:"details"`
	RecentPayments  PaymentsPage     `codec:"recentPayments" json:"recentPayments"`
	PendingPayments []PaymentSummary `codec:"pendingPayments" json:"pendingPayments"`
}

func (o DetailsPlusPayments) DeepCopy() DetailsPlusPayments {
	return DetailsPlusPayments{
		Details:        o.Details.DeepCopy(),
		RecentPayments: o.RecentPayments.DeepCopy(),
		PendingPayments: (func(x []PaymentSummary) []PaymentSummary {
			if x == nil {
				return nil
			}
			ret := make([]PaymentSummary, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.PendingPayments),
	}
}

type PaymentPathQuery struct {
	Source           AccountID `codec:"source" json:"source"`
	Destination      AccountID `codec:"destination" json:"destination"`
	SourceAsset      Asset     `codec:"sourceAsset" json:"sourceAsset"`
	DestinationAsset Asset     `codec:"destinationAsset" json:"destinationAsset"`
	Amount           string    `codec:"amount" json:"amount"`
}

func (o PaymentPathQuery) DeepCopy() PaymentPathQuery {
	return PaymentPathQuery{
		Source:           o.Source.DeepCopy(),
		Destination:      o.Destination.DeepCopy(),
		SourceAsset:      o.SourceAsset.DeepCopy(),
		DestinationAsset: o.DestinationAsset.DeepCopy(),
		Amount:           o.Amount,
	}
}

type BalancesArg struct {
	Caller    keybase1.UserVersion `codec:"caller" json:"caller"`
	AccountID AccountID            `codec:"accountID" json:"accountID"`
}

type DetailsArg struct {
	Caller          keybase1.UserVersion `codec:"caller" json:"caller"`
	AccountID       AccountID            `codec:"accountID" json:"accountID"`
	IncludeMulti    bool                 `codec:"includeMulti" json:"includeMulti"`
	IncludeAdvanced bool                 `codec:"includeAdvanced" json:"includeAdvanced"`
}

type RecentPaymentsArg struct {
	Caller          keybase1.UserVersion `codec:"caller" json:"caller"`
	AccountID       AccountID            `codec:"accountID" json:"accountID"`
	Cursor          *PageCursor          `codec:"cursor,omitempty" json:"cursor,omitempty"`
	Limit           int                  `codec:"limit" json:"limit"`
	SkipPending     bool                 `codec:"skipPending" json:"skipPending"`
	IncludeMulti    bool                 `codec:"includeMulti" json:"includeMulti"`
	IncludeAdvanced bool                 `codec:"includeAdvanced" json:"includeAdvanced"`
}

type PendingPaymentsArg struct {
	Caller    keybase1.UserVersion `codec:"caller" json:"caller"`
	AccountID AccountID            `codec:"accountID" json:"accountID"`
	Limit     int                  `codec:"limit" json:"limit"`
}

type MarkAsReadArg struct {
	Caller       keybase1.UserVersion `codec:"caller" json:"caller"`
	AccountID    AccountID            `codec:"accountID" json:"accountID"`
	MostRecentID TransactionID        `codec:"mostRecentID" json:"mostRecentID"`
}

type PaymentDetailsArg struct {
	Caller    keybase1.UserVersion `codec:"caller" json:"caller"`
	AccountID AccountID            `codec:"accountID" json:"accountID"`
	TxID      string               `codec:"txID" json:"txID"`
}

type AccountSeqnoArg struct {
	Caller    keybase1.UserVersion `codec:"caller" json:"caller"`
	AccountID AccountID            `codec:"accountID" json:"accountID"`
}

type SubmitPaymentArg struct {
	Caller  keybase1.UserVersion `codec:"caller" json:"caller"`
	Payment PaymentDirectPost    `codec:"payment" json:"payment"`
}

type SubmitRelayPaymentArg struct {
	Caller  keybase1.UserVersion `codec:"caller" json:"caller"`
	Payment PaymentRelayPost     `codec:"payment" json:"payment"`
}

type SubmitRelayClaimArg struct {
	Caller keybase1.UserVersion `codec:"caller" json:"caller"`
	Claim  RelayClaimPost       `codec:"claim" json:"claim"`
}

type SubmitPathPaymentArg struct {
	Caller  keybase1.UserVersion `codec:"caller" json:"caller"`
	Payment PathPaymentPost      `codec:"payment" json:"payment"`
}

type SubmitMultiPaymentArg struct {
	Caller  keybase1.UserVersion `codec:"caller" json:"caller"`
	Payment PaymentMultiPost     `codec:"payment" json:"payment"`
}

type AcquireAutoClaimLockArg struct {
	Caller keybase1.UserVersion `codec:"caller" json:"caller"`
}

type ReleaseAutoClaimLockArg struct {
	Caller keybase1.UserVersion `codec:"caller" json:"caller"`
	Token  string               `codec:"token" json:"token"`
}

type NextAutoClaimArg struct {
	Caller keybase1.UserVersion `codec:"caller" json:"caller"`
}

type IsMasterKeyActiveArg struct {
	Caller    keybase1.UserVersion `codec:"caller" json:"caller"`
	AccountID AccountID            `codec:"accountID" json:"accountID"`
}

type SubmitRequestArg struct {
	Caller  keybase1.UserVersion `codec:"caller" json:"caller"`
	Request RequestPost          `codec:"request" json:"request"`
}

type RequestDetailsArg struct {
	Caller keybase1.UserVersion `codec:"caller" json:"caller"`
	ReqID  KeybaseRequestID     `codec:"reqID" json:"reqID"`
}

type CancelRequestArg struct {
	Caller keybase1.UserVersion `codec:"caller" json:"caller"`
	ReqID  KeybaseRequestID     `codec:"reqID" json:"reqID"`
}

type SetInflationDestinationArg struct {
	Caller            keybase1.UserVersion `codec:"caller" json:"caller"`
	SignedTransaction string               `codec:"signedTransaction" json:"signedTransaction"`
}

type PingArg struct {
}

type NetworkOptionsArg struct {
	Caller keybase1.UserVersion `codec:"caller" json:"caller"`
}

type DetailsPlusPaymentsArg struct {
	Caller          keybase1.UserVersion `codec:"caller" json:"caller"`
	AccountID       AccountID            `codec:"accountID" json:"accountID"`
	IncludeAdvanced bool                 `codec:"includeAdvanced" json:"includeAdvanced"`
}

type AllDetailsPlusPaymentsArg struct {
	Caller keybase1.UserVersion `codec:"caller" json:"caller"`
}

type AssetSearchArg struct {
	AssetCode       string `codec:"assetCode" json:"assetCode"`
	IssuerAccountID string `codec:"issuerAccountID" json:"issuerAccountID"`
}

type FuzzyAssetSearchArg struct {
	Caller       keybase1.UserVersion `codec:"caller" json:"caller"`
	SearchString string               `codec:"searchString" json:"searchString"`
}

type ListPopularAssetsArg struct {
	Caller keybase1.UserVersion `codec:"caller" json:"caller"`
}

type ChangeTrustlineArg struct {
	Caller            keybase1.UserVersion `codec:"caller" json:"caller"`
	SignedTransaction string               `codec:"signedTransaction" json:"signedTransaction"`
}

type FindPaymentPathArg struct {
	Caller keybase1.UserVersion `codec:"caller" json:"caller"`
	Query  PaymentPathQuery     `codec:"query" json:"query"`
}

type PostAnyTransactionArg struct {
	Caller            keybase1.UserVersion `codec:"caller" json:"caller"`
	SignedTransaction string               `codec:"signedTransaction" json:"signedTransaction"`
}

type RemoteInterface interface {
	Balances(context.Context, BalancesArg) ([]Balance, error)
	Details(context.Context, DetailsArg) (AccountDetails, error)
	RecentPayments(context.Context, RecentPaymentsArg) (PaymentsPage, error)
	PendingPayments(context.Context, PendingPaymentsArg) ([]PaymentSummary, error)
	MarkAsRead(context.Context, MarkAsReadArg) error
	PaymentDetails(context.Context, PaymentDetailsArg) (PaymentDetails, error)
	AccountSeqno(context.Context, AccountSeqnoArg) (string, error)
	SubmitPayment(context.Context, SubmitPaymentArg) (PaymentResult, error)
	SubmitRelayPayment(context.Context, SubmitRelayPaymentArg) (PaymentResult, error)
	SubmitRelayClaim(context.Context, SubmitRelayClaimArg) (RelayClaimResult, error)
	SubmitPathPayment(context.Context, SubmitPathPaymentArg) (PaymentResult, error)
	SubmitMultiPayment(context.Context, SubmitMultiPaymentArg) (SubmitMultiRes, error)
	AcquireAutoClaimLock(context.Context, keybase1.UserVersion) (string, error)
	ReleaseAutoClaimLock(context.Context, ReleaseAutoClaimLockArg) error
	NextAutoClaim(context.Context, keybase1.UserVersion) (*AutoClaim, error)
	IsMasterKeyActive(context.Context, IsMasterKeyActiveArg) (bool, error)
	SubmitRequest(context.Context, SubmitRequestArg) (KeybaseRequestID, error)
	RequestDetails(context.Context, RequestDetailsArg) (RequestDetails, error)
	CancelRequest(context.Context, CancelRequestArg) error
	SetInflationDestination(context.Context, SetInflationDestinationArg) error
	Ping(context.Context) (string, error)
	NetworkOptions(context.Context, keybase1.UserVersion) (NetworkOptions, error)
	DetailsPlusPayments(context.Context, DetailsPlusPaymentsArg) (DetailsPlusPayments, error)
	AllDetailsPlusPayments(context.Context, keybase1.UserVersion) ([]DetailsPlusPayments, error)
	AssetSearch(context.Context, AssetSearchArg) ([]Asset, error)
	FuzzyAssetSearch(context.Context, FuzzyAssetSearchArg) ([]Asset, error)
	ListPopularAssets(context.Context, keybase1.UserVersion) (AssetListResult, error)
	ChangeTrustline(context.Context, ChangeTrustlineArg) error
	FindPaymentPath(context.Context, FindPaymentPathArg) (PaymentPath, error)
	PostAnyTransaction(context.Context, PostAnyTransactionArg) error
}

func RemoteProtocol(i RemoteInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "stellar.1.remote",
		Methods: map[string]rpc.ServeHandlerDescription{
			"balances": {
				MakeArg: func() interface{} {
					var ret [1]BalancesArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]BalancesArg)
					if !ok {
						err = rpc.NewTypeError((*[1]BalancesArg)(nil), args)
						return
					}
					ret, err = i.Balances(ctx, typedArgs[0])
					return
				},
			},
			"details": {
				MakeArg: func() interface{} {
					var ret [1]DetailsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DetailsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DetailsArg)(nil), args)
						return
					}
					ret, err = i.Details(ctx, typedArgs[0])
					return
				},
			},
			"recentPayments": {
				MakeArg: func() interface{} {
					var ret [1]RecentPaymentsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RecentPaymentsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RecentPaymentsArg)(nil), args)
						return
					}
					ret, err = i.RecentPayments(ctx, typedArgs[0])
					return
				},
			},
			"pendingPayments": {
				MakeArg: func() interface{} {
					var ret [1]PendingPaymentsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PendingPaymentsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PendingPaymentsArg)(nil), args)
						return
					}
					ret, err = i.PendingPayments(ctx, typedArgs[0])
					return
				},
			},
			"markAsRead": {
				MakeArg: func() interface{} {
					var ret [1]MarkAsReadArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]MarkAsReadArg)
					if !ok {
						err = rpc.NewTypeError((*[1]MarkAsReadArg)(nil), args)
						return
					}
					err = i.MarkAsRead(ctx, typedArgs[0])
					return
				},
			},
			"paymentDetails": {
				MakeArg: func() interface{} {
					var ret [1]PaymentDetailsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PaymentDetailsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PaymentDetailsArg)(nil), args)
						return
					}
					ret, err = i.PaymentDetails(ctx, typedArgs[0])
					return
				},
			},
			"accountSeqno": {
				MakeArg: func() interface{} {
					var ret [1]AccountSeqnoArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AccountSeqnoArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AccountSeqnoArg)(nil), args)
						return
					}
					ret, err = i.AccountSeqno(ctx, typedArgs[0])
					return
				},
			},
			"submitPayment": {
				MakeArg: func() interface{} {
					var ret [1]SubmitPaymentArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SubmitPaymentArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SubmitPaymentArg)(nil), args)
						return
					}
					ret, err = i.SubmitPayment(ctx, typedArgs[0])
					return
				},
			},
			"submitRelayPayment": {
				MakeArg: func() interface{} {
					var ret [1]SubmitRelayPaymentArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SubmitRelayPaymentArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SubmitRelayPaymentArg)(nil), args)
						return
					}
					ret, err = i.SubmitRelayPayment(ctx, typedArgs[0])
					return
				},
			},
			"submitRelayClaim": {
				MakeArg: func() interface{} {
					var ret [1]SubmitRelayClaimArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SubmitRelayClaimArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SubmitRelayClaimArg)(nil), args)
						return
					}
					ret, err = i.SubmitRelayClaim(ctx, typedArgs[0])
					return
				},
			},
			"submitPathPayment": {
				MakeArg: func() interface{} {
					var ret [1]SubmitPathPaymentArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SubmitPathPaymentArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SubmitPathPaymentArg)(nil), args)
						return
					}
					ret, err = i.SubmitPathPayment(ctx, typedArgs[0])
					return
				},
			},
			"submitMultiPayment": {
				MakeArg: func() interface{} {
					var ret [1]SubmitMultiPaymentArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SubmitMultiPaymentArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SubmitMultiPaymentArg)(nil), args)
						return
					}
					ret, err = i.SubmitMultiPayment(ctx, typedArgs[0])
					return
				},
			},
			"acquireAutoClaimLock": {
				MakeArg: func() interface{} {
					var ret [1]AcquireAutoClaimLockArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AcquireAutoClaimLockArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AcquireAutoClaimLockArg)(nil), args)
						return
					}
					ret, err = i.AcquireAutoClaimLock(ctx, typedArgs[0].Caller)
					return
				},
			},
			"releaseAutoClaimLock": {
				MakeArg: func() interface{} {
					var ret [1]ReleaseAutoClaimLockArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ReleaseAutoClaimLockArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ReleaseAutoClaimLockArg)(nil), args)
						return
					}
					err = i.ReleaseAutoClaimLock(ctx, typedArgs[0])
					return
				},
			},
			"nextAutoClaim": {
				MakeArg: func() interface{} {
					var ret [1]NextAutoClaimArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]NextAutoClaimArg)
					if !ok {
						err = rpc.NewTypeError((*[1]NextAutoClaimArg)(nil), args)
						return
					}
					ret, err = i.NextAutoClaim(ctx, typedArgs[0].Caller)
					return
				},
			},
			"isMasterKeyActive": {
				MakeArg: func() interface{} {
					var ret [1]IsMasterKeyActiveArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]IsMasterKeyActiveArg)
					if !ok {
						err = rpc.NewTypeError((*[1]IsMasterKeyActiveArg)(nil), args)
						return
					}
					ret, err = i.IsMasterKeyActive(ctx, typedArgs[0])
					return
				},
			},
			"submitRequest": {
				MakeArg: func() interface{} {
					var ret [1]SubmitRequestArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SubmitRequestArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SubmitRequestArg)(nil), args)
						return
					}
					ret, err = i.SubmitRequest(ctx, typedArgs[0])
					return
				},
			},
			"requestDetails": {
				MakeArg: func() interface{} {
					var ret [1]RequestDetailsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RequestDetailsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RequestDetailsArg)(nil), args)
						return
					}
					ret, err = i.RequestDetails(ctx, typedArgs[0])
					return
				},
			},
			"cancelRequest": {
				MakeArg: func() interface{} {
					var ret [1]CancelRequestArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CancelRequestArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CancelRequestArg)(nil), args)
						return
					}
					err = i.CancelRequest(ctx, typedArgs[0])
					return
				},
			},
			"setInflationDestination": {
				MakeArg: func() interface{} {
					var ret [1]SetInflationDestinationArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetInflationDestinationArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetInflationDestinationArg)(nil), args)
						return
					}
					err = i.SetInflationDestination(ctx, typedArgs[0])
					return
				},
			},
			"ping": {
				MakeArg: func() interface{} {
					var ret [1]PingArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.Ping(ctx)
					return
				},
			},
			"networkOptions": {
				MakeArg: func() interface{} {
					var ret [1]NetworkOptionsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]NetworkOptionsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]NetworkOptionsArg)(nil), args)
						return
					}
					ret, err = i.NetworkOptions(ctx, typedArgs[0].Caller)
					return
				},
			},
			"detailsPlusPayments": {
				MakeArg: func() interface{} {
					var ret [1]DetailsPlusPaymentsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DetailsPlusPaymentsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DetailsPlusPaymentsArg)(nil), args)
						return
					}
					ret, err = i.DetailsPlusPayments(ctx, typedArgs[0])
					return
				},
			},
			"allDetailsPlusPayments": {
				MakeArg: func() interface{} {
					var ret [1]AllDetailsPlusPaymentsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AllDetailsPlusPaymentsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AllDetailsPlusPaymentsArg)(nil), args)
						return
					}
					ret, err = i.AllDetailsPlusPayments(ctx, typedArgs[0].Caller)
					return
				},
			},
			"assetSearch": {
				MakeArg: func() interface{} {
					var ret [1]AssetSearchArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AssetSearchArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AssetSearchArg)(nil), args)
						return
					}
					ret, err = i.AssetSearch(ctx, typedArgs[0])
					return
				},
			},
			"fuzzyAssetSearch": {
				MakeArg: func() interface{} {
					var ret [1]FuzzyAssetSearchArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FuzzyAssetSearchArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FuzzyAssetSearchArg)(nil), args)
						return
					}
					ret, err = i.FuzzyAssetSearch(ctx, typedArgs[0])
					return
				},
			},
			"listPopularAssets": {
				MakeArg: func() interface{} {
					var ret [1]ListPopularAssetsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ListPopularAssetsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ListPopularAssetsArg)(nil), args)
						return
					}
					ret, err = i.ListPopularAssets(ctx, typedArgs[0].Caller)
					return
				},
			},
			"changeTrustline": {
				MakeArg: func() interface{} {
					var ret [1]ChangeTrustlineArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ChangeTrustlineArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ChangeTrustlineArg)(nil), args)
						return
					}
					err = i.ChangeTrustline(ctx, typedArgs[0])
					return
				},
			},
			"findPaymentPath": {
				MakeArg: func() interface{} {
					var ret [1]FindPaymentPathArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FindPaymentPathArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FindPaymentPathArg)(nil), args)
						return
					}
					ret, err = i.FindPaymentPath(ctx, typedArgs[0])
					return
				},
			},
			"postAnyTransaction": {
				MakeArg: func() interface{} {
					var ret [1]PostAnyTransactionArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PostAnyTransactionArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PostAnyTransactionArg)(nil), args)
						return
					}
					err = i.PostAnyTransaction(ctx, typedArgs[0])
					return
				},
			},
		},
	}
}

type RemoteClient struct {
	Cli rpc.GenericClient
}

func (c RemoteClient) Balances(ctx context.Context, __arg BalancesArg) (res []Balance, err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.balances", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) Details(ctx context.Context, __arg DetailsArg) (res AccountDetails, err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.details", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) RecentPayments(ctx context.Context, __arg RecentPaymentsArg) (res PaymentsPage, err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.recentPayments", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) PendingPayments(ctx context.Context, __arg PendingPaymentsArg) (res []PaymentSummary, err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.pendingPayments", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) MarkAsRead(ctx context.Context, __arg MarkAsReadArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.markAsRead", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c RemoteClient) PaymentDetails(ctx context.Context, __arg PaymentDetailsArg) (res PaymentDetails, err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.paymentDetails", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) AccountSeqno(ctx context.Context, __arg AccountSeqnoArg) (res string, err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.accountSeqno", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) SubmitPayment(ctx context.Context, __arg SubmitPaymentArg) (res PaymentResult, err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.submitPayment", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) SubmitRelayPayment(ctx context.Context, __arg SubmitRelayPaymentArg) (res PaymentResult, err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.submitRelayPayment", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) SubmitRelayClaim(ctx context.Context, __arg SubmitRelayClaimArg) (res RelayClaimResult, err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.submitRelayClaim", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) SubmitPathPayment(ctx context.Context, __arg SubmitPathPaymentArg) (res PaymentResult, err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.submitPathPayment", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) SubmitMultiPayment(ctx context.Context, __arg SubmitMultiPaymentArg) (res SubmitMultiRes, err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.submitMultiPayment", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) AcquireAutoClaimLock(ctx context.Context, caller keybase1.UserVersion) (res string, err error) {
	__arg := AcquireAutoClaimLockArg{Caller: caller}
	err = c.Cli.Call(ctx, "stellar.1.remote.acquireAutoClaimLock", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) ReleaseAutoClaimLock(ctx context.Context, __arg ReleaseAutoClaimLockArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.releaseAutoClaimLock", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c RemoteClient) NextAutoClaim(ctx context.Context, caller keybase1.UserVersion) (res *AutoClaim, err error) {
	__arg := NextAutoClaimArg{Caller: caller}
	err = c.Cli.Call(ctx, "stellar.1.remote.nextAutoClaim", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) IsMasterKeyActive(ctx context.Context, __arg IsMasterKeyActiveArg) (res bool, err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.isMasterKeyActive", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) SubmitRequest(ctx context.Context, __arg SubmitRequestArg) (res KeybaseRequestID, err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.submitRequest", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) RequestDetails(ctx context.Context, __arg RequestDetailsArg) (res RequestDetails, err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.requestDetails", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) CancelRequest(ctx context.Context, __arg CancelRequestArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.cancelRequest", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c RemoteClient) SetInflationDestination(ctx context.Context, __arg SetInflationDestinationArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.setInflationDestination", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c RemoteClient) Ping(ctx context.Context) (res string, err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.ping", []interface{}{PingArg{}}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) NetworkOptions(ctx context.Context, caller keybase1.UserVersion) (res NetworkOptions, err error) {
	__arg := NetworkOptionsArg{Caller: caller}
	err = c.Cli.Call(ctx, "stellar.1.remote.networkOptions", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) DetailsPlusPayments(ctx context.Context, __arg DetailsPlusPaymentsArg) (res DetailsPlusPayments, err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.detailsPlusPayments", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) AllDetailsPlusPayments(ctx context.Context, caller keybase1.UserVersion) (res []DetailsPlusPayments, err error) {
	__arg := AllDetailsPlusPaymentsArg{Caller: caller}
	err = c.Cli.Call(ctx, "stellar.1.remote.allDetailsPlusPayments", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) AssetSearch(ctx context.Context, __arg AssetSearchArg) (res []Asset, err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.assetSearch", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) FuzzyAssetSearch(ctx context.Context, __arg FuzzyAssetSearchArg) (res []Asset, err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.fuzzyAssetSearch", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) ListPopularAssets(ctx context.Context, caller keybase1.UserVersion) (res AssetListResult, err error) {
	__arg := ListPopularAssetsArg{Caller: caller}
	err = c.Cli.Call(ctx, "stellar.1.remote.listPopularAssets", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) ChangeTrustline(ctx context.Context, __arg ChangeTrustlineArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.changeTrustline", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c RemoteClient) FindPaymentPath(ctx context.Context, __arg FindPaymentPathArg) (res PaymentPath, err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.findPaymentPath", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c RemoteClient) PostAnyTransaction(ctx context.Context, __arg PostAnyTransactionArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.remote.postAnyTransaction", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
