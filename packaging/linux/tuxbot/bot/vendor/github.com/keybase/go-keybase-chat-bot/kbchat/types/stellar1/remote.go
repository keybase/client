// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/stellar1/remote.avdl

package stellar1

import (
	"errors"
	"fmt"

	keybase1 "github.com/keybase/go-keybase-chat-bot/kbchat/types/keybase1"
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
