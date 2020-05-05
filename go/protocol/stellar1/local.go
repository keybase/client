// Auto-generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/stellar1/local.avdl

package stellar1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type WalletAccountLocal struct {
	AccountID           AccountID     `codec:"accountID" json:"accountID"`
	IsDefault           bool          `codec:"isDefault" json:"isDefault"`
	Name                string        `codec:"name" json:"name"`
	BalanceDescription  string        `codec:"balanceDescription" json:"balanceDescription"`
	Seqno               string        `codec:"seqno" json:"seqno"`
	CurrencyLocal       CurrencyLocal `codec:"currencyLocal" json:"currencyLocal"`
	AccountMode         AccountMode   `codec:"accountMode" json:"accountMode"`
	AccountModeEditable bool          `codec:"accountModeEditable" json:"accountModeEditable"`
	DeviceReadOnly      bool          `codec:"deviceReadOnly" json:"deviceReadOnly"`
	IsFunded            bool          `codec:"isFunded" json:"isFunded"`
	CanSubmitTx         bool          `codec:"canSubmitTx" json:"canSubmitTx"`
	CanAddTrustline     bool          `codec:"canAddTrustline" json:"canAddTrustline"`
}

func (o WalletAccountLocal) DeepCopy() WalletAccountLocal {
	return WalletAccountLocal{
		AccountID:           o.AccountID.DeepCopy(),
		IsDefault:           o.IsDefault,
		Name:                o.Name,
		BalanceDescription:  o.BalanceDescription,
		Seqno:               o.Seqno,
		CurrencyLocal:       o.CurrencyLocal.DeepCopy(),
		AccountMode:         o.AccountMode.DeepCopy(),
		AccountModeEditable: o.AccountModeEditable,
		DeviceReadOnly:      o.DeviceReadOnly,
		IsFunded:            o.IsFunded,
		CanSubmitTx:         o.CanSubmitTx,
		CanAddTrustline:     o.CanAddTrustline,
	}
}

type AccountAssetLocal struct {
	Name                   string           `codec:"name" json:"name"`
	AssetCode              string           `codec:"assetCode" json:"assetCode"`
	IssuerName             string           `codec:"issuerName" json:"issuerName"`
	IssuerAccountID        string           `codec:"issuerAccountID" json:"issuerAccountID"`
	IssuerVerifiedDomain   string           `codec:"issuerVerifiedDomain" json:"issuerVerifiedDomain"`
	BalanceTotal           string           `codec:"balanceTotal" json:"balanceTotal"`
	BalanceAvailableToSend string           `codec:"balanceAvailableToSend" json:"balanceAvailableToSend"`
	WorthCurrency          string           `codec:"worthCurrency" json:"worthCurrency"`
	Worth                  string           `codec:"worth" json:"worth"`
	AvailableToSendWorth   string           `codec:"availableToSendWorth" json:"availableToSendWorth"`
	Reserves               []AccountReserve `codec:"reserves" json:"reserves"`
	Desc                   string           `codec:"desc" json:"desc"`
	InfoUrl                string           `codec:"infoUrl" json:"infoUrl"`
	InfoUrlText            string           `codec:"infoUrlText" json:"infoUrlText"`
	ShowDepositButton      bool             `codec:"showDepositButton" json:"showDepositButton"`
	DepositButtonText      string           `codec:"depositButtonText" json:"depositButtonText"`
	ShowWithdrawButton     bool             `codec:"showWithdrawButton" json:"showWithdrawButton"`
	WithdrawButtonText     string           `codec:"withdrawButtonText" json:"withdrawButtonText"`
}

func (o AccountAssetLocal) DeepCopy() AccountAssetLocal {
	return AccountAssetLocal{
		Name:                   o.Name,
		AssetCode:              o.AssetCode,
		IssuerName:             o.IssuerName,
		IssuerAccountID:        o.IssuerAccountID,
		IssuerVerifiedDomain:   o.IssuerVerifiedDomain,
		BalanceTotal:           o.BalanceTotal,
		BalanceAvailableToSend: o.BalanceAvailableToSend,
		WorthCurrency:          o.WorthCurrency,
		Worth:                  o.Worth,
		AvailableToSendWorth:   o.AvailableToSendWorth,
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
		Desc:               o.Desc,
		InfoUrl:            o.InfoUrl,
		InfoUrlText:        o.InfoUrlText,
		ShowDepositButton:  o.ShowDepositButton,
		DepositButtonText:  o.DepositButtonText,
		ShowWithdrawButton: o.ShowWithdrawButton,
		WithdrawButtonText: o.WithdrawButtonText,
	}
}

type BalanceDelta int

const (
	BalanceDelta_NONE     BalanceDelta = 0
	BalanceDelta_INCREASE BalanceDelta = 1
	BalanceDelta_DECREASE BalanceDelta = 2
)

func (o BalanceDelta) DeepCopy() BalanceDelta { return o }

var BalanceDeltaMap = map[string]BalanceDelta{
	"NONE":     0,
	"INCREASE": 1,
	"DECREASE": 2,
}

var BalanceDeltaRevMap = map[BalanceDelta]string{
	0: "NONE",
	1: "INCREASE",
	2: "DECREASE",
}

func (e BalanceDelta) String() string {
	if v, ok := BalanceDeltaRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type PaymentStatus int

const (
	PaymentStatus_NONE      PaymentStatus = 0
	PaymentStatus_PENDING   PaymentStatus = 1
	PaymentStatus_CLAIMABLE PaymentStatus = 2
	PaymentStatus_COMPLETED PaymentStatus = 3
	PaymentStatus_ERROR     PaymentStatus = 4
	PaymentStatus_UNKNOWN   PaymentStatus = 5
	PaymentStatus_CANCELED  PaymentStatus = 6
)

func (o PaymentStatus) DeepCopy() PaymentStatus { return o }

var PaymentStatusMap = map[string]PaymentStatus{
	"NONE":      0,
	"PENDING":   1,
	"CLAIMABLE": 2,
	"COMPLETED": 3,
	"ERROR":     4,
	"UNKNOWN":   5,
	"CANCELED":  6,
}

var PaymentStatusRevMap = map[PaymentStatus]string{
	0: "NONE",
	1: "PENDING",
	2: "CLAIMABLE",
	3: "COMPLETED",
	4: "ERROR",
	5: "UNKNOWN",
	6: "CANCELED",
}

func (e PaymentStatus) String() string {
	if v, ok := PaymentStatusRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ParticipantType int

const (
	ParticipantType_NONE       ParticipantType = 0
	ParticipantType_KEYBASE    ParticipantType = 1
	ParticipantType_STELLAR    ParticipantType = 2
	ParticipantType_SBS        ParticipantType = 3
	ParticipantType_OWNACCOUNT ParticipantType = 4
)

func (o ParticipantType) DeepCopy() ParticipantType { return o }

var ParticipantTypeMap = map[string]ParticipantType{
	"NONE":       0,
	"KEYBASE":    1,
	"STELLAR":    2,
	"SBS":        3,
	"OWNACCOUNT": 4,
}

var ParticipantTypeRevMap = map[ParticipantType]string{
	0: "NONE",
	1: "KEYBASE",
	2: "STELLAR",
	3: "SBS",
	4: "OWNACCOUNT",
}

func (e ParticipantType) String() string {
	if v, ok := ParticipantTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type PaymentOrErrorLocal struct {
	Payment *PaymentLocal `codec:"payment,omitempty" json:"payment,omitempty"`
	Err     *string       `codec:"err,omitempty" json:"err,omitempty"`
}

func (o PaymentOrErrorLocal) DeepCopy() PaymentOrErrorLocal {
	return PaymentOrErrorLocal{
		Payment: (func(x *PaymentLocal) *PaymentLocal {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Payment),
		Err: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Err),
	}
}

type PaymentsPageLocal struct {
	Payments     []PaymentOrErrorLocal `codec:"payments" json:"payments"`
	Cursor       *PageCursor           `codec:"cursor,omitempty" json:"cursor,omitempty"`
	OldestUnread *PaymentID            `codec:"oldestUnread,omitempty" json:"oldestUnread,omitempty"`
}

func (o PaymentsPageLocal) DeepCopy() PaymentsPageLocal {
	return PaymentsPageLocal{
		Payments: (func(x []PaymentOrErrorLocal) []PaymentOrErrorLocal {
			if x == nil {
				return nil
			}
			ret := make([]PaymentOrErrorLocal, len(x))
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
		OldestUnread: (func(x *PaymentID) *PaymentID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.OldestUnread),
	}
}

type PaymentLocal struct {
	Id                  PaymentID              `codec:"id" json:"id"`
	TxID                TransactionID          `codec:"txID" json:"txID"`
	Time                TimeMs                 `codec:"time" json:"time"`
	StatusSimplified    PaymentStatus          `codec:"statusSimplified" json:"statusSimplified"`
	StatusDescription   string                 `codec:"statusDescription" json:"statusDescription"`
	StatusDetail        string                 `codec:"statusDetail" json:"statusDetail"`
	ShowCancel          bool                   `codec:"showCancel" json:"showCancel"`
	AmountDescription   string                 `codec:"amountDescription" json:"amountDescription"`
	Delta               BalanceDelta           `codec:"delta" json:"delta"`
	Worth               string                 `codec:"worth" json:"worth"`
	WorthAtSendTime     string                 `codec:"worthAtSendTime" json:"worthAtSendTime"`
	IssuerDescription   string                 `codec:"issuerDescription" json:"issuerDescription"`
	IssuerAccountID     *AccountID             `codec:"issuerAccountID,omitempty" json:"issuerAccountID,omitempty"`
	FromType            ParticipantType        `codec:"fromType" json:"fromType"`
	ToType              ParticipantType        `codec:"toType" json:"toType"`
	AssetCode           string                 `codec:"assetCode" json:"assetCode"`
	FromAccountID       AccountID              `codec:"fromAccountID" json:"fromAccountID"`
	FromAccountName     string                 `codec:"fromAccountName" json:"fromAccountName"`
	FromUsername        string                 `codec:"fromUsername" json:"fromUsername"`
	ToAccountID         *AccountID             `codec:"toAccountID,omitempty" json:"toAccountID,omitempty"`
	ToAccountName       string                 `codec:"toAccountName" json:"toAccountName"`
	ToUsername          string                 `codec:"toUsername" json:"toUsername"`
	ToAssertion         string                 `codec:"toAssertion" json:"toAssertion"`
	OriginalToAssertion string                 `codec:"originalToAssertion" json:"originalToAssertion"`
	Note                string                 `codec:"note" json:"note"`
	NoteErr             string                 `codec:"noteErr" json:"noteErr"`
	SourceAmountMax     string                 `codec:"sourceAmountMax" json:"sourceAmountMax"`
	SourceAmountActual  string                 `codec:"sourceAmountActual" json:"sourceAmountActual"`
	SourceAsset         Asset                  `codec:"sourceAsset" json:"sourceAsset"`
	SourceConvRate      string                 `codec:"sourceConvRate" json:"sourceConvRate"`
	IsAdvanced          bool                   `codec:"isAdvanced" json:"isAdvanced"`
	SummaryAdvanced     string                 `codec:"summaryAdvanced" json:"summaryAdvanced"`
	Operations          []string               `codec:"operations" json:"operations"`
	Unread              bool                   `codec:"unread" json:"unread"`
	BatchID             string                 `codec:"batchID" json:"batchID"`
	FromAirdrop         bool                   `codec:"fromAirdrop" json:"fromAirdrop"`
	IsInflation         bool                   `codec:"isInflation" json:"isInflation"`
	InflationSource     *string                `codec:"inflationSource,omitempty" json:"inflationSource,omitempty"`
	Trustline           *PaymentTrustlineLocal `codec:"trustline,omitempty" json:"trustline,omitempty"`
}

func (o PaymentLocal) DeepCopy() PaymentLocal {
	return PaymentLocal{
		Id:                o.Id.DeepCopy(),
		TxID:              o.TxID.DeepCopy(),
		Time:              o.Time.DeepCopy(),
		StatusSimplified:  o.StatusSimplified.DeepCopy(),
		StatusDescription: o.StatusDescription,
		StatusDetail:      o.StatusDetail,
		ShowCancel:        o.ShowCancel,
		AmountDescription: o.AmountDescription,
		Delta:             o.Delta.DeepCopy(),
		Worth:             o.Worth,
		WorthAtSendTime:   o.WorthAtSendTime,
		IssuerDescription: o.IssuerDescription,
		IssuerAccountID: (func(x *AccountID) *AccountID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.IssuerAccountID),
		FromType:        o.FromType.DeepCopy(),
		ToType:          o.ToType.DeepCopy(),
		AssetCode:       o.AssetCode,
		FromAccountID:   o.FromAccountID.DeepCopy(),
		FromAccountName: o.FromAccountName,
		FromUsername:    o.FromUsername,
		ToAccountID: (func(x *AccountID) *AccountID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ToAccountID),
		ToAccountName:       o.ToAccountName,
		ToUsername:          o.ToUsername,
		ToAssertion:         o.ToAssertion,
		OriginalToAssertion: o.OriginalToAssertion,
		Note:                o.Note,
		NoteErr:             o.NoteErr,
		SourceAmountMax:     o.SourceAmountMax,
		SourceAmountActual:  o.SourceAmountActual,
		SourceAsset:         o.SourceAsset.DeepCopy(),
		SourceConvRate:      o.SourceConvRate,
		IsAdvanced:          o.IsAdvanced,
		SummaryAdvanced:     o.SummaryAdvanced,
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
		Unread:      o.Unread,
		BatchID:     o.BatchID,
		FromAirdrop: o.FromAirdrop,
		IsInflation: o.IsInflation,
		InflationSource: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.InflationSource),
		Trustline: (func(x *PaymentTrustlineLocal) *PaymentTrustlineLocal {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Trustline),
	}
}

type PaymentDetailsLocal struct {
	Summary PaymentLocal            `codec:"summary" json:"summary"`
	Details PaymentDetailsOnlyLocal `codec:"details" json:"details"`
}

func (o PaymentDetailsLocal) DeepCopy() PaymentDetailsLocal {
	return PaymentDetailsLocal{
		Summary: o.Summary.DeepCopy(),
		Details: o.Details.DeepCopy(),
	}
}

type PaymentDetailsOnlyLocal struct {
	PublicNote            string  `codec:"publicNote" json:"publicNote"`
	PublicNoteType        string  `codec:"publicNoteType" json:"publicNoteType"`
	ExternalTxURL         string  `codec:"externalTxURL" json:"externalTxURL"`
	FeeChargedDescription string  `codec:"feeChargedDescription" json:"feeChargedDescription"`
	PathIntermediate      []Asset `codec:"pathIntermediate" json:"pathIntermediate"`
}

func (o PaymentDetailsOnlyLocal) DeepCopy() PaymentDetailsOnlyLocal {
	return PaymentDetailsOnlyLocal{
		PublicNote:            o.PublicNote,
		PublicNoteType:        o.PublicNoteType,
		ExternalTxURL:         o.ExternalTxURL,
		FeeChargedDescription: o.FeeChargedDescription,
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

type PaymentTrustlineLocal struct {
	Asset  Asset `codec:"asset" json:"asset"`
	Remove bool  `codec:"remove" json:"remove"`
}

func (o PaymentTrustlineLocal) DeepCopy() PaymentTrustlineLocal {
	return PaymentTrustlineLocal{
		Asset:  o.Asset.DeepCopy(),
		Remove: o.Remove,
	}
}

type CurrencyLocal struct {
	Description string              `codec:"description" json:"description"`
	Code        OutsideCurrencyCode `codec:"code" json:"code"`
	Symbol      string              `codec:"symbol" json:"symbol"`
	Name        string              `codec:"name" json:"name"`
}

func (o CurrencyLocal) DeepCopy() CurrencyLocal {
	return CurrencyLocal{
		Description: o.Description,
		Code:        o.Code.DeepCopy(),
		Symbol:      o.Symbol,
		Name:        o.Name,
	}
}

type SendAssetChoiceLocal struct {
	Asset   Asset  `codec:"asset" json:"asset"`
	Enabled bool   `codec:"enabled" json:"enabled"`
	Left    string `codec:"left" json:"left"`
	Right   string `codec:"right" json:"right"`
	Subtext string `codec:"subtext" json:"subtext"`
}

func (o SendAssetChoiceLocal) DeepCopy() SendAssetChoiceLocal {
	return SendAssetChoiceLocal{
		Asset:   o.Asset.DeepCopy(),
		Enabled: o.Enabled,
		Left:    o.Left,
		Right:   o.Right,
		Subtext: o.Subtext,
	}
}

type BuildPaymentID string

func (o BuildPaymentID) DeepCopy() BuildPaymentID {
	return o
}

type BuildPaymentResLocal struct {
	ReadyToReview       bool              `codec:"readyToReview" json:"readyToReview"`
	From                AccountID         `codec:"from" json:"from"`
	ToErrMsg            string            `codec:"toErrMsg" json:"toErrMsg"`
	AmountErrMsg        string            `codec:"amountErrMsg" json:"amountErrMsg"`
	SecretNoteErrMsg    string            `codec:"secretNoteErrMsg" json:"secretNoteErrMsg"`
	PublicMemoErrMsg    string            `codec:"publicMemoErrMsg" json:"publicMemoErrMsg"`
	PublicMemoOverride  string            `codec:"publicMemoOverride" json:"publicMemoOverride"`
	WorthDescription    string            `codec:"worthDescription" json:"worthDescription"`
	WorthInfo           string            `codec:"worthInfo" json:"worthInfo"`
	WorthAmount         string            `codec:"worthAmount" json:"worthAmount"`
	WorthCurrency       string            `codec:"worthCurrency" json:"worthCurrency"`
	DisplayAmountXLM    string            `codec:"displayAmountXLM" json:"displayAmountXLM"`
	DisplayAmountFiat   string            `codec:"displayAmountFiat" json:"displayAmountFiat"`
	SendingIntentionXLM bool              `codec:"sendingIntentionXLM" json:"sendingIntentionXLM"`
	AmountAvailable     string            `codec:"amountAvailable" json:"amountAvailable"`
	Banners             []SendBannerLocal `codec:"banners" json:"banners"`
}

func (o BuildPaymentResLocal) DeepCopy() BuildPaymentResLocal {
	return BuildPaymentResLocal{
		ReadyToReview:       o.ReadyToReview,
		From:                o.From.DeepCopy(),
		ToErrMsg:            o.ToErrMsg,
		AmountErrMsg:        o.AmountErrMsg,
		SecretNoteErrMsg:    o.SecretNoteErrMsg,
		PublicMemoErrMsg:    o.PublicMemoErrMsg,
		PublicMemoOverride:  o.PublicMemoOverride,
		WorthDescription:    o.WorthDescription,
		WorthInfo:           o.WorthInfo,
		WorthAmount:         o.WorthAmount,
		WorthCurrency:       o.WorthCurrency,
		DisplayAmountXLM:    o.DisplayAmountXLM,
		DisplayAmountFiat:   o.DisplayAmountFiat,
		SendingIntentionXLM: o.SendingIntentionXLM,
		AmountAvailable:     o.AmountAvailable,
		Banners: (func(x []SendBannerLocal) []SendBannerLocal {
			if x == nil {
				return nil
			}
			ret := make([]SendBannerLocal, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Banners),
	}
}

type AdvancedBanner int

const (
	AdvancedBanner_NO_BANNER       AdvancedBanner = 0
	AdvancedBanner_SENDER_BANNER   AdvancedBanner = 1
	AdvancedBanner_RECEIVER_BANNER AdvancedBanner = 2
)

func (o AdvancedBanner) DeepCopy() AdvancedBanner { return o }

var AdvancedBannerMap = map[string]AdvancedBanner{
	"NO_BANNER":       0,
	"SENDER_BANNER":   1,
	"RECEIVER_BANNER": 2,
}

var AdvancedBannerRevMap = map[AdvancedBanner]string{
	0: "NO_BANNER",
	1: "SENDER_BANNER",
	2: "RECEIVER_BANNER",
}

func (e AdvancedBanner) String() string {
	if v, ok := AdvancedBannerRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type SendBannerLocal struct {
	Level                 string         `codec:"level" json:"level"`
	Message               string         `codec:"message" json:"message"`
	ProofsChanged         bool           `codec:"proofsChanged" json:"proofsChanged"`
	OfferAdvancedSendForm AdvancedBanner `codec:"offerAdvancedSendForm" json:"offerAdvancedSendForm"`
}

func (o SendBannerLocal) DeepCopy() SendBannerLocal {
	return SendBannerLocal{
		Level:                 o.Level,
		Message:               o.Message,
		ProofsChanged:         o.ProofsChanged,
		OfferAdvancedSendForm: o.OfferAdvancedSendForm.DeepCopy(),
	}
}

type SendPaymentResLocal struct {
	KbTxID     KeybaseTransactionID `codec:"kbTxID" json:"kbTxID"`
	Pending    bool                 `codec:"pending" json:"pending"`
	JumpToChat string               `codec:"jumpToChat" json:"jumpToChat"`
}

func (o SendPaymentResLocal) DeepCopy() SendPaymentResLocal {
	return SendPaymentResLocal{
		KbTxID:     o.KbTxID.DeepCopy(),
		Pending:    o.Pending,
		JumpToChat: o.JumpToChat,
	}
}

type BuildRequestResLocal struct {
	ReadyToRequest      bool              `codec:"readyToRequest" json:"readyToRequest"`
	ToErrMsg            string            `codec:"toErrMsg" json:"toErrMsg"`
	AmountErrMsg        string            `codec:"amountErrMsg" json:"amountErrMsg"`
	SecretNoteErrMsg    string            `codec:"secretNoteErrMsg" json:"secretNoteErrMsg"`
	WorthDescription    string            `codec:"worthDescription" json:"worthDescription"`
	WorthInfo           string            `codec:"worthInfo" json:"worthInfo"`
	DisplayAmountXLM    string            `codec:"displayAmountXLM" json:"displayAmountXLM"`
	DisplayAmountFiat   string            `codec:"displayAmountFiat" json:"displayAmountFiat"`
	SendingIntentionXLM bool              `codec:"sendingIntentionXLM" json:"sendingIntentionXLM"`
	Banners             []SendBannerLocal `codec:"banners" json:"banners"`
}

func (o BuildRequestResLocal) DeepCopy() BuildRequestResLocal {
	return BuildRequestResLocal{
		ReadyToRequest:      o.ReadyToRequest,
		ToErrMsg:            o.ToErrMsg,
		AmountErrMsg:        o.AmountErrMsg,
		SecretNoteErrMsg:    o.SecretNoteErrMsg,
		WorthDescription:    o.WorthDescription,
		WorthInfo:           o.WorthInfo,
		DisplayAmountXLM:    o.DisplayAmountXLM,
		DisplayAmountFiat:   o.DisplayAmountFiat,
		SendingIntentionXLM: o.SendingIntentionXLM,
		Banners: (func(x []SendBannerLocal) []SendBannerLocal {
			if x == nil {
				return nil
			}
			ret := make([]SendBannerLocal, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Banners),
	}
}

type RequestDetailsLocal struct {
	Id                 KeybaseRequestID     `codec:"id" json:"id"`
	FromAssertion      string               `codec:"fromAssertion" json:"fromAssertion"`
	FromCurrentUser    bool                 `codec:"fromCurrentUser" json:"fromCurrentUser"`
	ToUserType         ParticipantType      `codec:"toUserType" json:"toUserType"`
	ToAssertion        string               `codec:"toAssertion" json:"toAssertion"`
	Amount             string               `codec:"amount" json:"amount"`
	Asset              *Asset               `codec:"asset,omitempty" json:"asset,omitempty"`
	Currency           *OutsideCurrencyCode `codec:"currency,omitempty" json:"currency,omitempty"`
	AmountDescription  string               `codec:"amountDescription" json:"amountDescription"`
	WorthAtRequestTime string               `codec:"worthAtRequestTime" json:"worthAtRequestTime"`
	Status             RequestStatus        `codec:"status" json:"status"`
}

func (o RequestDetailsLocal) DeepCopy() RequestDetailsLocal {
	return RequestDetailsLocal{
		Id:              o.Id.DeepCopy(),
		FromAssertion:   o.FromAssertion,
		FromCurrentUser: o.FromCurrentUser,
		ToUserType:      o.ToUserType.DeepCopy(),
		ToAssertion:     o.ToAssertion,
		Amount:          o.Amount,
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
		AmountDescription:  o.AmountDescription,
		WorthAtRequestTime: o.WorthAtRequestTime,
		Status:             o.Status.DeepCopy(),
	}
}

type InflationDestinationTag string

func (o InflationDestinationTag) DeepCopy() InflationDestinationTag {
	return o
}

type PredefinedInflationDestination struct {
	Tag         InflationDestinationTag `codec:"tag" json:"tag"`
	Name        string                  `codec:"name" json:"name"`
	Recommended bool                    `codec:"recommended" json:"recommended"`
	AccountID   AccountID               `codec:"accountID" json:"accountID"`
	Url         string                  `codec:"url" json:"url"`
}

func (o PredefinedInflationDestination) DeepCopy() PredefinedInflationDestination {
	return PredefinedInflationDestination{
		Tag:         o.Tag.DeepCopy(),
		Name:        o.Name,
		Recommended: o.Recommended,
		AccountID:   o.AccountID.DeepCopy(),
		Url:         o.Url,
	}
}

type InflationDestinationResultLocal struct {
	Destination      *AccountID                      `codec:"destination,omitempty" json:"destination,omitempty"`
	KnownDestination *PredefinedInflationDestination `codec:"knownDestination,omitempty" json:"knownDestination,omitempty"`
	Self             bool                            `codec:"self" json:"self"`
}

func (o InflationDestinationResultLocal) DeepCopy() InflationDestinationResultLocal {
	return InflationDestinationResultLocal{
		Destination: (func(x *AccountID) *AccountID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Destination),
		KnownDestination: (func(x *PredefinedInflationDestination) *PredefinedInflationDestination {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.KnownDestination),
		Self: o.Self,
	}
}

type AirdropDetails struct {
	IsPromoted bool   `codec:"isPromoted" json:"isPromoted"`
	Details    string `codec:"details" json:"details"`
	Disclaimer string `codec:"disclaimer" json:"disclaimer"`
}

func (o AirdropDetails) DeepCopy() AirdropDetails {
	return AirdropDetails{
		IsPromoted: o.IsPromoted,
		Details:    o.Details,
		Disclaimer: o.Disclaimer,
	}
}

type AirdropState string

func (o AirdropState) DeepCopy() AirdropState {
	return o
}

type AirdropQualification struct {
	Title    string `codec:"title" json:"title"`
	Subtitle string `codec:"subtitle" json:"subtitle"`
	Valid    bool   `codec:"valid" json:"valid"`
}

func (o AirdropQualification) DeepCopy() AirdropQualification {
	return AirdropQualification{
		Title:    o.Title,
		Subtitle: o.Subtitle,
		Valid:    o.Valid,
	}
}

type AirdropStatus struct {
	State AirdropState           `codec:"state" json:"state"`
	Rows  []AirdropQualification `codec:"rows" json:"rows"`
}

func (o AirdropStatus) DeepCopy() AirdropStatus {
	return AirdropStatus{
		State: o.State.DeepCopy(),
		Rows: (func(x []AirdropQualification) []AirdropQualification {
			if x == nil {
				return nil
			}
			ret := make([]AirdropQualification, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Rows),
	}
}

type RecipientTrustlinesLocal struct {
	Trustlines    []Balance       `codec:"trustlines" json:"trustlines"`
	RecipientType ParticipantType `codec:"recipientType" json:"recipientType"`
}

func (o RecipientTrustlinesLocal) DeepCopy() RecipientTrustlinesLocal {
	return RecipientTrustlinesLocal{
		Trustlines: (func(x []Balance) []Balance {
			if x == nil {
				return nil
			}
			ret := make([]Balance, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Trustlines),
		RecipientType: o.RecipientType.DeepCopy(),
	}
}

type PaymentPathLocal struct {
	SourceDisplay      string      `codec:"sourceDisplay" json:"sourceDisplay"`
	SourceMaxDisplay   string      `codec:"sourceMaxDisplay" json:"sourceMaxDisplay"`
	DestinationDisplay string      `codec:"destinationDisplay" json:"destinationDisplay"`
	ExchangeRate       string      `codec:"exchangeRate" json:"exchangeRate"`
	AmountError        string      `codec:"amountError" json:"amountError"`
	DestinationAccount AccountID   `codec:"destinationAccount" json:"destinationAccount"`
	FullPath           PaymentPath `codec:"fullPath" json:"fullPath"`
}

func (o PaymentPathLocal) DeepCopy() PaymentPathLocal {
	return PaymentPathLocal{
		SourceDisplay:      o.SourceDisplay,
		SourceMaxDisplay:   o.SourceMaxDisplay,
		DestinationDisplay: o.DestinationDisplay,
		ExchangeRate:       o.ExchangeRate,
		AmountError:        o.AmountError,
		DestinationAccount: o.DestinationAccount.DeepCopy(),
		FullPath:           o.FullPath.DeepCopy(),
	}
}

type AssetActionResultLocal struct {
	ExternalUrl       *string `codec:"externalUrl,omitempty" json:"externalUrl,omitempty"`
	MessageFromAnchor *string `codec:"messageFromAnchor,omitempty" json:"messageFromAnchor,omitempty"`
}

func (o AssetActionResultLocal) DeepCopy() AssetActionResultLocal {
	return AssetActionResultLocal{
		ExternalUrl: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.ExternalUrl),
		MessageFromAnchor: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.MessageFromAnchor),
	}
}

type SendResultCLILocal struct {
	KbTxID KeybaseTransactionID `codec:"kbTxID" json:"kbTxID"`
	TxID   TransactionID        `codec:"txID" json:"txID"`
}

func (o SendResultCLILocal) DeepCopy() SendResultCLILocal {
	return SendResultCLILocal{
		KbTxID: o.KbTxID.DeepCopy(),
		TxID:   o.TxID.DeepCopy(),
	}
}

type PublicNoteType int

const (
	PublicNoteType_NONE   PublicNoteType = 0
	PublicNoteType_TEXT   PublicNoteType = 1
	PublicNoteType_ID     PublicNoteType = 2
	PublicNoteType_HASH   PublicNoteType = 3
	PublicNoteType_RETURN PublicNoteType = 4
)

func (o PublicNoteType) DeepCopy() PublicNoteType { return o }

var PublicNoteTypeMap = map[string]PublicNoteType{
	"NONE":   0,
	"TEXT":   1,
	"ID":     2,
	"HASH":   3,
	"RETURN": 4,
}

var PublicNoteTypeRevMap = map[PublicNoteType]string{
	0: "NONE",
	1: "TEXT",
	2: "ID",
	3: "HASH",
	4: "RETURN",
}

func (e PublicNoteType) String() string {
	if v, ok := PublicNoteTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type PaymentOrErrorCLILocal struct {
	Payment *PaymentCLILocal `codec:"payment,omitempty" json:"payment,omitempty"`
	Err     *string          `codec:"err,omitempty" json:"err,omitempty"`
}

func (o PaymentOrErrorCLILocal) DeepCopy() PaymentOrErrorCLILocal {
	return PaymentOrErrorCLILocal{
		Payment: (func(x *PaymentCLILocal) *PaymentCLILocal {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Payment),
		Err: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Err),
	}
}

type PaymentCLILocal struct {
	TxID                  TransactionID `codec:"txID" json:"txID"`
	Time                  TimeMs        `codec:"time" json:"time"`
	Status                string        `codec:"status" json:"status"`
	StatusDetail          string        `codec:"statusDetail" json:"statusDetail"`
	Amount                string        `codec:"amount" json:"amount"`
	Asset                 Asset         `codec:"asset" json:"asset"`
	DisplayAmount         *string       `codec:"displayAmount,omitempty" json:"displayAmount,omitempty"`
	DisplayCurrency       *string       `codec:"displayCurrency,omitempty" json:"displayCurrency,omitempty"`
	SourceAmountMax       string        `codec:"sourceAmountMax" json:"sourceAmountMax"`
	SourceAmountActual    string        `codec:"sourceAmountActual" json:"sourceAmountActual"`
	SourceAsset           Asset         `codec:"sourceAsset" json:"sourceAsset"`
	IsAdvanced            bool          `codec:"isAdvanced" json:"isAdvanced"`
	SummaryAdvanced       string        `codec:"summaryAdvanced" json:"summaryAdvanced"`
	Operations            []string      `codec:"operations" json:"operations"`
	FromStellar           AccountID     `codec:"fromStellar" json:"fromStellar"`
	ToStellar             *AccountID    `codec:"toStellar,omitempty" json:"toStellar,omitempty"`
	FromUsername          *string       `codec:"fromUsername,omitempty" json:"fromUsername,omitempty"`
	ToUsername            *string       `codec:"toUsername,omitempty" json:"toUsername,omitempty"`
	ToAssertion           *string       `codec:"toAssertion,omitempty" json:"toAssertion,omitempty"`
	Note                  string        `codec:"note" json:"note"`
	NoteErr               string        `codec:"noteErr" json:"noteErr"`
	Unread                bool          `codec:"unread" json:"unread"`
	PublicNote            string        `codec:"publicNote" json:"publicNote"`
	PublicNoteType        string        `codec:"publicNoteType" json:"publicNoteType"`
	FeeChargedDescription string        `codec:"feeChargedDescription" json:"feeChargedDescription"`
}

func (o PaymentCLILocal) DeepCopy() PaymentCLILocal {
	return PaymentCLILocal{
		TxID:         o.TxID.DeepCopy(),
		Time:         o.Time.DeepCopy(),
		Status:       o.Status,
		StatusDetail: o.StatusDetail,
		Amount:       o.Amount,
		Asset:        o.Asset.DeepCopy(),
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
		FromStellar: o.FromStellar.DeepCopy(),
		ToStellar: (func(x *AccountID) *AccountID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ToStellar),
		FromUsername: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.FromUsername),
		ToUsername: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.ToUsername),
		ToAssertion: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.ToAssertion),
		Note:                  o.Note,
		NoteErr:               o.NoteErr,
		Unread:                o.Unread,
		PublicNote:            o.PublicNote,
		PublicNoteType:        o.PublicNoteType,
		FeeChargedDescription: o.FeeChargedDescription,
	}
}

type OwnAccountCLILocal struct {
	AccountID    AccountID            `codec:"accountID" json:"accountID"`
	IsPrimary    bool                 `codec:"isPrimary" json:"isPrimary"`
	Name         string               `codec:"name" json:"name"`
	Balance      []Balance            `codec:"balance" json:"balance"`
	ExchangeRate *OutsideExchangeRate `codec:"exchangeRate,omitempty" json:"exchangeRate,omitempty"`
	AccountMode  AccountMode          `codec:"accountMode" json:"accountMode"`
}

func (o OwnAccountCLILocal) DeepCopy() OwnAccountCLILocal {
	return OwnAccountCLILocal{
		AccountID: o.AccountID.DeepCopy(),
		IsPrimary: o.IsPrimary,
		Name:      o.Name,
		Balance: (func(x []Balance) []Balance {
			if x == nil {
				return nil
			}
			ret := make([]Balance, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Balance),
		ExchangeRate: (func(x *OutsideExchangeRate) *OutsideExchangeRate {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ExchangeRate),
		AccountMode: o.AccountMode.DeepCopy(),
	}
}

type LookupResultCLILocal struct {
	AccountID AccountID `codec:"accountID" json:"accountID"`
	Username  *string   `codec:"username,omitempty" json:"username,omitempty"`
}

func (o LookupResultCLILocal) DeepCopy() LookupResultCLILocal {
	return LookupResultCLILocal{
		AccountID: o.AccountID.DeepCopy(),
		Username: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Username),
	}
}

type BatchPaymentError struct {
	Message string `codec:"message" json:"message"`
	Code    int    `codec:"code" json:"code"`
}

func (o BatchPaymentError) DeepCopy() BatchPaymentError {
	return BatchPaymentError{
		Message: o.Message,
		Code:    o.Code,
	}
}

type BatchPaymentResult struct {
	Username          string             `codec:"username" json:"username"`
	StartTime         TimeMs             `codec:"startTime" json:"startTime"`
	SubmittedTime     TimeMs             `codec:"submittedTime" json:"submittedTime"`
	EndTime           TimeMs             `codec:"endTime" json:"endTime"`
	TxID              TransactionID      `codec:"txID" json:"txID"`
	Status            PaymentStatus      `codec:"status" json:"status"`
	StatusDescription string             `codec:"statusDescription" json:"statusDescription"`
	Error             *BatchPaymentError `codec:"error,omitempty" json:"error,omitempty"`
}

func (o BatchPaymentResult) DeepCopy() BatchPaymentResult {
	return BatchPaymentResult{
		Username:          o.Username,
		StartTime:         o.StartTime.DeepCopy(),
		SubmittedTime:     o.SubmittedTime.DeepCopy(),
		EndTime:           o.EndTime.DeepCopy(),
		TxID:              o.TxID.DeepCopy(),
		Status:            o.Status.DeepCopy(),
		StatusDescription: o.StatusDescription,
		Error: (func(x *BatchPaymentError) *BatchPaymentError {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Error),
	}
}

type BatchResultLocal struct {
	StartTime              TimeMs               `codec:"startTime" json:"startTime"`
	PreparedTime           TimeMs               `codec:"preparedTime" json:"preparedTime"`
	AllSubmittedTime       TimeMs               `codec:"allSubmittedTime" json:"allSubmittedTime"`
	AllCompleteTime        TimeMs               `codec:"allCompleteTime" json:"allCompleteTime"`
	EndTime                TimeMs               `codec:"endTime" json:"endTime"`
	Payments               []BatchPaymentResult `codec:"payments" json:"payments"`
	OverallDurationMs      TimeMs               `codec:"overallDurationMs" json:"overallDurationMs"`
	PrepareDurationMs      TimeMs               `codec:"prepareDurationMs" json:"prepareDurationMs"`
	SubmitDurationMs       TimeMs               `codec:"submitDurationMs" json:"submitDurationMs"`
	WaitPaymentsDurationMs TimeMs               `codec:"waitPaymentsDurationMs" json:"waitPaymentsDurationMs"`
	WaitChatDurationMs     TimeMs               `codec:"waitChatDurationMs" json:"waitChatDurationMs"`
	CountSuccess           int                  `codec:"countSuccess" json:"countSuccess"`
	CountDirect            int                  `codec:"countDirect" json:"countDirect"`
	CountRelay             int                  `codec:"countRelay" json:"countRelay"`
	CountError             int                  `codec:"countError" json:"countError"`
	CountPending           int                  `codec:"countPending" json:"countPending"`
	AvgDurationMs          TimeMs               `codec:"avgDurationMs" json:"avgDurationMs"`
	AvgSuccessDurationMs   TimeMs               `codec:"avgSuccessDurationMs" json:"avgSuccessDurationMs"`
	AvgDirectDurationMs    TimeMs               `codec:"avgDirectDurationMs" json:"avgDirectDurationMs"`
	AvgRelayDurationMs     TimeMs               `codec:"avgRelayDurationMs" json:"avgRelayDurationMs"`
	AvgErrorDurationMs     TimeMs               `codec:"avgErrorDurationMs" json:"avgErrorDurationMs"`
}

func (o BatchResultLocal) DeepCopy() BatchResultLocal {
	return BatchResultLocal{
		StartTime:        o.StartTime.DeepCopy(),
		PreparedTime:     o.PreparedTime.DeepCopy(),
		AllSubmittedTime: o.AllSubmittedTime.DeepCopy(),
		AllCompleteTime:  o.AllCompleteTime.DeepCopy(),
		EndTime:          o.EndTime.DeepCopy(),
		Payments: (func(x []BatchPaymentResult) []BatchPaymentResult {
			if x == nil {
				return nil
			}
			ret := make([]BatchPaymentResult, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Payments),
		OverallDurationMs:      o.OverallDurationMs.DeepCopy(),
		PrepareDurationMs:      o.PrepareDurationMs.DeepCopy(),
		SubmitDurationMs:       o.SubmitDurationMs.DeepCopy(),
		WaitPaymentsDurationMs: o.WaitPaymentsDurationMs.DeepCopy(),
		WaitChatDurationMs:     o.WaitChatDurationMs.DeepCopy(),
		CountSuccess:           o.CountSuccess,
		CountDirect:            o.CountDirect,
		CountRelay:             o.CountRelay,
		CountError:             o.CountError,
		CountPending:           o.CountPending,
		AvgDurationMs:          o.AvgDurationMs.DeepCopy(),
		AvgSuccessDurationMs:   o.AvgSuccessDurationMs.DeepCopy(),
		AvgDirectDurationMs:    o.AvgDirectDurationMs.DeepCopy(),
		AvgRelayDurationMs:     o.AvgRelayDurationMs.DeepCopy(),
		AvgErrorDurationMs:     o.AvgErrorDurationMs.DeepCopy(),
	}
}

type BatchPaymentArg struct {
	Recipient string `codec:"recipient" json:"recipient"`
	Amount    string `codec:"amount" json:"amount"`
	Message   string `codec:"message" json:"message"`
}

func (o BatchPaymentArg) DeepCopy() BatchPaymentArg {
	return BatchPaymentArg{
		Recipient: o.Recipient,
		Amount:    o.Amount,
		Message:   o.Message,
	}
}

type TxDisplaySummary struct {
	Source     AccountID `codec:"source" json:"source"`
	Fee        int       `codec:"fee" json:"fee"`
	Memo       string    `codec:"memo" json:"memo"`
	MemoType   string    `codec:"memoType" json:"memoType"`
	Operations []string  `codec:"operations" json:"operations"`
}

func (o TxDisplaySummary) DeepCopy() TxDisplaySummary {
	return TxDisplaySummary{
		Source:   o.Source.DeepCopy(),
		Fee:      o.Fee,
		Memo:     o.Memo,
		MemoType: o.MemoType,
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
	}
}

type ValidateStellarURIResultLocal struct {
	Operation             string           `codec:"operation" json:"operation"`
	OriginDomain          string           `codec:"originDomain" json:"originDomain"`
	Message               string           `codec:"message" json:"message"`
	CallbackURL           string           `codec:"callbackURL" json:"callbackURL"`
	Xdr                   string           `codec:"xdr" json:"xdr"`
	Summary               TxDisplaySummary `codec:"summary" json:"summary"`
	Recipient             string           `codec:"recipient" json:"recipient"`
	Amount                string           `codec:"amount" json:"amount"`
	AssetCode             string           `codec:"assetCode" json:"assetCode"`
	AssetIssuer           string           `codec:"assetIssuer" json:"assetIssuer"`
	Memo                  string           `codec:"memo" json:"memo"`
	MemoType              string           `codec:"memoType" json:"memoType"`
	DisplayAmountFiat     string           `codec:"displayAmountFiat" json:"displayAmountFiat"`
	AvailableToSendNative string           `codec:"availableToSendNative" json:"availableToSendNative"`
	AvailableToSendFiat   string           `codec:"availableToSendFiat" json:"availableToSendFiat"`
	Signed                bool             `codec:"signed" json:"signed"`
}

func (o ValidateStellarURIResultLocal) DeepCopy() ValidateStellarURIResultLocal {
	return ValidateStellarURIResultLocal{
		Operation:             o.Operation,
		OriginDomain:          o.OriginDomain,
		Message:               o.Message,
		CallbackURL:           o.CallbackURL,
		Xdr:                   o.Xdr,
		Summary:               o.Summary.DeepCopy(),
		Recipient:             o.Recipient,
		Amount:                o.Amount,
		AssetCode:             o.AssetCode,
		AssetIssuer:           o.AssetIssuer,
		Memo:                  o.Memo,
		MemoType:              o.MemoType,
		DisplayAmountFiat:     o.DisplayAmountFiat,
		AvailableToSendNative: o.AvailableToSendNative,
		AvailableToSendFiat:   o.AvailableToSendFiat,
		Signed:                o.Signed,
	}
}

type PartnerUrl struct {
	Url          string `codec:"url" json:"url"`
	Title        string `codec:"title" json:"title"`
	Description  string `codec:"description" json:"description"`
	IconFilename string `codec:"iconFilename" json:"icon_filename"`
	AdminOnly    bool   `codec:"adminOnly" json:"admin_only"`
	CanPurchase  bool   `codec:"canPurchase" json:"can_purchase"`
	Extra        string `codec:"extra" json:"extra"`
}

func (o PartnerUrl) DeepCopy() PartnerUrl {
	return PartnerUrl{
		Url:          o.Url,
		Title:        o.Title,
		Description:  o.Description,
		IconFilename: o.IconFilename,
		AdminOnly:    o.AdminOnly,
		CanPurchase:  o.CanPurchase,
		Extra:        o.Extra,
	}
}

type SignXdrResult struct {
	SingedTx   string         `codec:"singedTx" json:"singedTx"`
	AccountID  AccountID      `codec:"accountID" json:"accountID"`
	SubmitErr  *string        `codec:"submitErr,omitempty" json:"submitErr,omitempty"`
	SubmitTxID *TransactionID `codec:"submitTxID,omitempty" json:"submitTxID,omitempty"`
}

func (o SignXdrResult) DeepCopy() SignXdrResult {
	return SignXdrResult{
		SingedTx:  o.SingedTx,
		AccountID: o.AccountID.DeepCopy(),
		SubmitErr: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.SubmitErr),
		SubmitTxID: (func(x *TransactionID) *TransactionID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.SubmitTxID),
	}
}

type StaticConfig struct {
	PaymentNoteMaxLength int `codec:"paymentNoteMaxLength" json:"paymentNoteMaxLength"`
	RequestNoteMaxLength int `codec:"requestNoteMaxLength" json:"requestNoteMaxLength"`
	PublicMemoMaxLength  int `codec:"publicMemoMaxLength" json:"publicMemoMaxLength"`
}

func (o StaticConfig) DeepCopy() StaticConfig {
	return StaticConfig{
		PaymentNoteMaxLength: o.PaymentNoteMaxLength,
		RequestNoteMaxLength: o.RequestNoteMaxLength,
		PublicMemoMaxLength:  o.PublicMemoMaxLength,
	}
}

type GetWalletAccountsLocalArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type GetWalletAccountLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	AccountID AccountID `codec:"accountID" json:"accountID"`
}

type GetAccountAssetsLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	AccountID AccountID `codec:"accountID" json:"accountID"`
}

type GetPaymentsLocalArg struct {
	SessionID int         `codec:"sessionID" json:"sessionID"`
	AccountID AccountID   `codec:"accountID" json:"accountID"`
	Cursor    *PageCursor `codec:"cursor,omitempty" json:"cursor,omitempty"`
}

type GetPendingPaymentsLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	AccountID AccountID `codec:"accountID" json:"accountID"`
}

type MarkAsReadLocalArg struct {
	SessionID    int       `codec:"sessionID" json:"sessionID"`
	AccountID    AccountID `codec:"accountID" json:"accountID"`
	MostRecentID PaymentID `codec:"mostRecentID" json:"mostRecentID"`
}

type GetPaymentDetailsLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	AccountID AccountID `codec:"accountID" json:"accountID"`
	Id        PaymentID `codec:"id" json:"id"`
}

type GetGenericPaymentDetailsLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	Id        PaymentID `codec:"id" json:"id"`
}

type GetDisplayCurrenciesLocalArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type ValidateAccountIDLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	AccountID AccountID `codec:"accountID" json:"accountID"`
}

type ValidateSecretKeyLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	SecretKey SecretKey `codec:"secretKey" json:"secretKey"`
}

type ValidateAccountNameLocalArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Name      string `codec:"name" json:"name"`
}

type ChangeWalletAccountNameLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	AccountID AccountID `codec:"accountID" json:"accountID"`
	NewName   string    `codec:"newName" json:"newName"`
}

type SetWalletAccountAsDefaultLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	AccountID AccountID `codec:"accountID" json:"accountID"`
}

type DeleteWalletAccountLocalArg struct {
	SessionID        int       `codec:"sessionID" json:"sessionID"`
	AccountID        AccountID `codec:"accountID" json:"accountID"`
	UserAcknowledged string    `codec:"userAcknowledged" json:"userAcknowledged"`
}

type LinkNewWalletAccountLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	SecretKey SecretKey `codec:"secretKey" json:"secretKey"`
	Name      string    `codec:"name" json:"name"`
}

type CreateWalletAccountLocalArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Name      string `codec:"name" json:"name"`
}

type ChangeDisplayCurrencyLocalArg struct {
	SessionID int                 `codec:"sessionID" json:"sessionID"`
	AccountID AccountID           `codec:"accountID" json:"accountID"`
	Currency  OutsideCurrencyCode `codec:"currency" json:"currency"`
}

type GetDisplayCurrencyLocalArg struct {
	SessionID int        `codec:"sessionID" json:"sessionID"`
	AccountID *AccountID `codec:"accountID,omitempty" json:"accountID,omitempty"`
}

type HasAcceptedDisclaimerLocalArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type AcceptDisclaimerLocalArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type GetWalletAccountPublicKeyLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	AccountID AccountID `codec:"accountID" json:"accountID"`
}

type GetWalletAccountSecretKeyLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	AccountID AccountID `codec:"accountID" json:"accountID"`
}

type GetSendAssetChoicesLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	From      AccountID `codec:"from" json:"from"`
	To        string    `codec:"to" json:"to"`
}

type StartBuildPaymentLocalArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type StopBuildPaymentLocalArg struct {
	SessionID int            `codec:"sessionID" json:"sessionID"`
	Bid       BuildPaymentID `codec:"bid" json:"bid"`
}

type BuildPaymentLocalArg struct {
	SessionID          int                  `codec:"sessionID" json:"sessionID"`
	Bid                BuildPaymentID       `codec:"bid" json:"bid"`
	From               AccountID            `codec:"from" json:"from"`
	FromPrimaryAccount bool                 `codec:"fromPrimaryAccount" json:"fromPrimaryAccount"`
	To                 string               `codec:"to" json:"to"`
	ToIsAccountID      bool                 `codec:"toIsAccountID" json:"toIsAccountID"`
	Amount             string               `codec:"amount" json:"amount"`
	Currency           *OutsideCurrencyCode `codec:"currency,omitempty" json:"currency,omitempty"`
	Asset              *Asset               `codec:"asset,omitempty" json:"asset,omitempty"`
	SecretNote         string               `codec:"secretNote" json:"secretNote"`
	PublicMemo         string               `codec:"publicMemo" json:"publicMemo"`
}

type ReviewPaymentLocalArg struct {
	SessionID int            `codec:"sessionID" json:"sessionID"`
	ReviewID  int            `codec:"reviewID" json:"reviewID"`
	Bid       BuildPaymentID `codec:"bid" json:"bid"`
}

type SendPaymentLocalArg struct {
	SessionID     int                  `codec:"sessionID" json:"sessionID"`
	Bid           BuildPaymentID       `codec:"bid" json:"bid"`
	BypassBid     bool                 `codec:"bypassBid" json:"bypassBid"`
	BypassReview  bool                 `codec:"bypassReview" json:"bypassReview"`
	From          AccountID            `codec:"from" json:"from"`
	To            string               `codec:"to" json:"to"`
	ToIsAccountID bool                 `codec:"toIsAccountID" json:"toIsAccountID"`
	Amount        string               `codec:"amount" json:"amount"`
	Asset         Asset                `codec:"asset" json:"asset"`
	WorthAmount   string               `codec:"worthAmount" json:"worthAmount"`
	WorthCurrency *OutsideCurrencyCode `codec:"worthCurrency,omitempty" json:"worthCurrency,omitempty"`
	SecretNote    string               `codec:"secretNote" json:"secretNote"`
	PublicMemo    string               `codec:"publicMemo" json:"publicMemo"`
	QuickReturn   bool                 `codec:"quickReturn" json:"quickReturn"`
}

type SendPathLocalArg struct {
	Source     AccountID   `codec:"source" json:"source"`
	Recipient  string      `codec:"recipient" json:"recipient"`
	Path       PaymentPath `codec:"path" json:"path"`
	Note       string      `codec:"note" json:"note"`
	PublicNote string      `codec:"publicNote" json:"publicNote"`
}

type BuildRequestLocalArg struct {
	SessionID  int                  `codec:"sessionID" json:"sessionID"`
	To         string               `codec:"to" json:"to"`
	Amount     string               `codec:"amount" json:"amount"`
	Asset      *Asset               `codec:"asset,omitempty" json:"asset,omitempty"`
	Currency   *OutsideCurrencyCode `codec:"currency,omitempty" json:"currency,omitempty"`
	SecretNote string               `codec:"secretNote" json:"secretNote"`
}

type GetRequestDetailsLocalArg struct {
	SessionID int              `codec:"sessionID" json:"sessionID"`
	ReqID     KeybaseRequestID `codec:"reqID" json:"reqID"`
}

type CancelRequestLocalArg struct {
	SessionID int              `codec:"sessionID" json:"sessionID"`
	ReqID     KeybaseRequestID `codec:"reqID" json:"reqID"`
}

type MakeRequestLocalArg struct {
	SessionID int                  `codec:"sessionID" json:"sessionID"`
	Recipient string               `codec:"recipient" json:"recipient"`
	Asset     *Asset               `codec:"asset,omitempty" json:"asset,omitempty"`
	Currency  *OutsideCurrencyCode `codec:"currency,omitempty" json:"currency,omitempty"`
	Amount    string               `codec:"amount" json:"amount"`
	Note      string               `codec:"note" json:"note"`
}

type SetAccountMobileOnlyLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	AccountID AccountID `codec:"accountID" json:"accountID"`
}

type SetAccountAllDevicesLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	AccountID AccountID `codec:"accountID" json:"accountID"`
}

type IsAccountMobileOnlyLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	AccountID AccountID `codec:"accountID" json:"accountID"`
}

type CancelPaymentLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	PaymentID PaymentID `codec:"paymentID" json:"paymentID"`
}

type GetPredefinedInflationDestinationsLocalArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type SetInflationDestinationLocalArg struct {
	SessionID   int       `codec:"sessionID" json:"sessionID"`
	AccountID   AccountID `codec:"accountID" json:"accountID"`
	Destination AccountID `codec:"destination" json:"destination"`
}

type GetInflationDestinationLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	AccountID AccountID `codec:"accountID" json:"accountID"`
}

type AirdropDetailsLocalArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type AirdropStatusLocalArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type AirdropRegisterLocalArg struct {
	SessionID int  `codec:"sessionID" json:"sessionID"`
	Register  bool `codec:"register" json:"register"`
}

type FuzzyAssetSearchLocalArg struct {
	SessionID    int    `codec:"sessionID" json:"sessionID"`
	SearchString string `codec:"searchString" json:"searchString"`
}

type ListPopularAssetsLocalArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type AddTrustlineLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	AccountID AccountID `codec:"accountID" json:"accountID"`
	Trustline Trustline `codec:"trustline" json:"trustline"`
	Limit     string    `codec:"limit" json:"limit"`
}

type DeleteTrustlineLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	AccountID AccountID `codec:"accountID" json:"accountID"`
	Trustline Trustline `codec:"trustline" json:"trustline"`
}

type ChangeTrustlineLimitLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	AccountID AccountID `codec:"accountID" json:"accountID"`
	Trustline Trustline `codec:"trustline" json:"trustline"`
	Limit     string    `codec:"limit" json:"limit"`
}

type GetTrustlinesLocalArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	AccountID AccountID `codec:"accountID" json:"accountID"`
}

type GetTrustlinesForRecipientLocalArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Recipient string `codec:"recipient" json:"recipient"`
}

type FindPaymentPathLocalArg struct {
	From             AccountID `codec:"from" json:"from"`
	To               string    `codec:"to" json:"to"`
	SourceAsset      Asset     `codec:"sourceAsset" json:"sourceAsset"`
	DestinationAsset Asset     `codec:"destinationAsset" json:"destinationAsset"`
	Amount           string    `codec:"amount" json:"amount"`
}

type AssetDepositLocalArg struct {
	AccountID AccountID `codec:"accountID" json:"accountID"`
	Asset     Asset     `codec:"asset" json:"asset"`
}

type AssetWithdrawLocalArg struct {
	AccountID AccountID `codec:"accountID" json:"accountID"`
	Asset     Asset     `codec:"asset" json:"asset"`
}

type BalancesLocalArg struct {
	AccountID AccountID `codec:"accountID" json:"accountID"`
}

type SendCLILocalArg struct {
	Recipient       string         `codec:"recipient" json:"recipient"`
	Amount          string         `codec:"amount" json:"amount"`
	Asset           Asset          `codec:"asset" json:"asset"`
	Note            string         `codec:"note" json:"note"`
	DisplayAmount   string         `codec:"displayAmount" json:"displayAmount"`
	DisplayCurrency string         `codec:"displayCurrency" json:"displayCurrency"`
	ForceRelay      bool           `codec:"forceRelay" json:"forceRelay"`
	PublicNote      string         `codec:"publicNote" json:"publicNote"`
	PublicNoteType  PublicNoteType `codec:"publicNoteType" json:"publicNoteType"`
	FromAccountID   AccountID      `codec:"fromAccountID" json:"fromAccountID"`
}

type SendPathCLILocalArg struct {
	Source         AccountID      `codec:"source" json:"source"`
	Recipient      string         `codec:"recipient" json:"recipient"`
	Path           PaymentPath    `codec:"path" json:"path"`
	Note           string         `codec:"note" json:"note"`
	PublicNote     string         `codec:"publicNote" json:"publicNote"`
	PublicNoteType PublicNoteType `codec:"publicNoteType" json:"publicNoteType"`
}

type AccountMergeCLILocalArg struct {
	FromAccountID AccountID  `codec:"fromAccountID" json:"fromAccountID"`
	FromSecretKey *SecretKey `codec:"fromSecretKey,omitempty" json:"fromSecretKey,omitempty"`
	To            string     `codec:"to" json:"to"`
}

type ClaimCLILocalArg struct {
	TxID string     `codec:"txID" json:"txID"`
	Into *AccountID `codec:"into,omitempty" json:"into,omitempty"`
}

type RecentPaymentsCLILocalArg struct {
	AccountID *AccountID `codec:"accountID,omitempty" json:"accountID,omitempty"`
}

type PaymentDetailCLILocalArg struct {
	TxID string `codec:"txID" json:"txID"`
}

type WalletInitLocalArg struct {
}

type WalletDumpLocalArg struct {
}

type WalletGetAccountsCLILocalArg struct {
}

type OwnAccountLocalArg struct {
	AccountID AccountID `codec:"accountID" json:"accountID"`
}

type ImportSecretKeyLocalArg struct {
	SecretKey   SecretKey `codec:"secretKey" json:"secretKey"`
	MakePrimary bool      `codec:"makePrimary" json:"makePrimary"`
	Name        string    `codec:"name" json:"name"`
}

type ExportSecretKeyLocalArg struct {
	AccountID AccountID `codec:"accountID" json:"accountID"`
}

type SetDisplayCurrencyArg struct {
	AccountID AccountID `codec:"accountID" json:"accountID"`
	Currency  string    `codec:"currency" json:"currency"`
}

type ExchangeRateLocalArg struct {
	Currency OutsideCurrencyCode `codec:"currency" json:"currency"`
}

type GetAvailableLocalCurrenciesArg struct {
}

type FormatLocalCurrencyStringArg struct {
	Amount string              `codec:"amount" json:"amount"`
	Code   OutsideCurrencyCode `codec:"code" json:"code"`
}

type MakeRequestCLILocalArg struct {
	Recipient string               `codec:"recipient" json:"recipient"`
	Asset     *Asset               `codec:"asset,omitempty" json:"asset,omitempty"`
	Currency  *OutsideCurrencyCode `codec:"currency,omitempty" json:"currency,omitempty"`
	Amount    string               `codec:"amount" json:"amount"`
	Note      string               `codec:"note" json:"note"`
}

type LookupCLILocalArg struct {
	Name string `codec:"name" json:"name"`
}

type BatchLocalArg struct {
	BatchID     string            `codec:"batchID" json:"batchID"`
	TimeoutSecs int               `codec:"timeoutSecs" json:"timeoutSecs"`
	Payments    []BatchPaymentArg `codec:"payments" json:"payments"`
	UseMulti    bool              `codec:"useMulti" json:"useMulti"`
}

type ValidateStellarURILocalArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	InputURI  string `codec:"inputURI" json:"inputURI"`
}

type ApproveTxURILocalArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	InputURI  string `codec:"inputURI" json:"inputURI"`
}

type ApprovePayURILocalArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	InputURI  string `codec:"inputURI" json:"inputURI"`
	Amount    string `codec:"amount" json:"amount"`
	FromCLI   bool   `codec:"fromCLI" json:"fromCLI"`
}

type ApprovePathURILocalArg struct {
	SessionID int         `codec:"sessionID" json:"sessionID"`
	InputURI  string      `codec:"inputURI" json:"inputURI"`
	FullPath  PaymentPath `codec:"fullPath" json:"fullPath"`
	FromCLI   bool        `codec:"fromCLI" json:"fromCLI"`
}

type GetPartnerUrlsLocalArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type SignTransactionXdrLocalArg struct {
	EnvelopeXdr string     `codec:"envelopeXdr" json:"envelopeXdr"`
	AccountID   *AccountID `codec:"accountID,omitempty" json:"accountID,omitempty"`
	Submit      bool       `codec:"submit" json:"submit"`
}

type GetStaticConfigLocalArg struct {
}

type LocalInterface interface {
	GetWalletAccountsLocal(context.Context, int) ([]WalletAccountLocal, error)
	GetWalletAccountLocal(context.Context, GetWalletAccountLocalArg) (WalletAccountLocal, error)
	GetAccountAssetsLocal(context.Context, GetAccountAssetsLocalArg) ([]AccountAssetLocal, error)
	GetPaymentsLocal(context.Context, GetPaymentsLocalArg) (PaymentsPageLocal, error)
	GetPendingPaymentsLocal(context.Context, GetPendingPaymentsLocalArg) ([]PaymentOrErrorLocal, error)
	MarkAsReadLocal(context.Context, MarkAsReadLocalArg) error
	GetPaymentDetailsLocal(context.Context, GetPaymentDetailsLocalArg) (PaymentDetailsLocal, error)
	GetGenericPaymentDetailsLocal(context.Context, GetGenericPaymentDetailsLocalArg) (PaymentDetailsLocal, error)
	GetDisplayCurrenciesLocal(context.Context, int) ([]CurrencyLocal, error)
	ValidateAccountIDLocal(context.Context, ValidateAccountIDLocalArg) error
	ValidateSecretKeyLocal(context.Context, ValidateSecretKeyLocalArg) error
	ValidateAccountNameLocal(context.Context, ValidateAccountNameLocalArg) error
	ChangeWalletAccountNameLocal(context.Context, ChangeWalletAccountNameLocalArg) (WalletAccountLocal, error)
	SetWalletAccountAsDefaultLocal(context.Context, SetWalletAccountAsDefaultLocalArg) ([]WalletAccountLocal, error)
	DeleteWalletAccountLocal(context.Context, DeleteWalletAccountLocalArg) error
	LinkNewWalletAccountLocal(context.Context, LinkNewWalletAccountLocalArg) (AccountID, error)
	CreateWalletAccountLocal(context.Context, CreateWalletAccountLocalArg) (AccountID, error)
	ChangeDisplayCurrencyLocal(context.Context, ChangeDisplayCurrencyLocalArg) (CurrencyLocal, error)
	GetDisplayCurrencyLocal(context.Context, GetDisplayCurrencyLocalArg) (CurrencyLocal, error)
	HasAcceptedDisclaimerLocal(context.Context, int) (bool, error)
	AcceptDisclaimerLocal(context.Context, int) error
	GetWalletAccountPublicKeyLocal(context.Context, GetWalletAccountPublicKeyLocalArg) (string, error)
	GetWalletAccountSecretKeyLocal(context.Context, GetWalletAccountSecretKeyLocalArg) (SecretKey, error)
	GetSendAssetChoicesLocal(context.Context, GetSendAssetChoicesLocalArg) ([]SendAssetChoiceLocal, error)
	StartBuildPaymentLocal(context.Context, int) (BuildPaymentID, error)
	StopBuildPaymentLocal(context.Context, StopBuildPaymentLocalArg) error
	BuildPaymentLocal(context.Context, BuildPaymentLocalArg) (BuildPaymentResLocal, error)
	ReviewPaymentLocal(context.Context, ReviewPaymentLocalArg) error
	SendPaymentLocal(context.Context, SendPaymentLocalArg) (SendPaymentResLocal, error)
	SendPathLocal(context.Context, SendPathLocalArg) (SendPaymentResLocal, error)
	BuildRequestLocal(context.Context, BuildRequestLocalArg) (BuildRequestResLocal, error)
	GetRequestDetailsLocal(context.Context, GetRequestDetailsLocalArg) (RequestDetailsLocal, error)
	CancelRequestLocal(context.Context, CancelRequestLocalArg) error
	MakeRequestLocal(context.Context, MakeRequestLocalArg) (KeybaseRequestID, error)
	SetAccountMobileOnlyLocal(context.Context, SetAccountMobileOnlyLocalArg) error
	SetAccountAllDevicesLocal(context.Context, SetAccountAllDevicesLocalArg) error
	IsAccountMobileOnlyLocal(context.Context, IsAccountMobileOnlyLocalArg) (bool, error)
	CancelPaymentLocal(context.Context, CancelPaymentLocalArg) (RelayClaimResult, error)
	GetPredefinedInflationDestinationsLocal(context.Context, int) ([]PredefinedInflationDestination, error)
	SetInflationDestinationLocal(context.Context, SetInflationDestinationLocalArg) error
	GetInflationDestinationLocal(context.Context, GetInflationDestinationLocalArg) (InflationDestinationResultLocal, error)
	AirdropDetailsLocal(context.Context, int) (AirdropDetails, error)
	AirdropStatusLocal(context.Context, int) (AirdropStatus, error)
	AirdropRegisterLocal(context.Context, AirdropRegisterLocalArg) error
	FuzzyAssetSearchLocal(context.Context, FuzzyAssetSearchLocalArg) ([]Asset, error)
	ListPopularAssetsLocal(context.Context, int) (AssetListResult, error)
	AddTrustlineLocal(context.Context, AddTrustlineLocalArg) error
	DeleteTrustlineLocal(context.Context, DeleteTrustlineLocalArg) error
	ChangeTrustlineLimitLocal(context.Context, ChangeTrustlineLimitLocalArg) error
	GetTrustlinesLocal(context.Context, GetTrustlinesLocalArg) ([]Balance, error)
	GetTrustlinesForRecipientLocal(context.Context, GetTrustlinesForRecipientLocalArg) (RecipientTrustlinesLocal, error)
	FindPaymentPathLocal(context.Context, FindPaymentPathLocalArg) (PaymentPathLocal, error)
	AssetDepositLocal(context.Context, AssetDepositLocalArg) (AssetActionResultLocal, error)
	AssetWithdrawLocal(context.Context, AssetWithdrawLocalArg) (AssetActionResultLocal, error)
	BalancesLocal(context.Context, AccountID) ([]Balance, error)
	SendCLILocal(context.Context, SendCLILocalArg) (SendResultCLILocal, error)
	SendPathCLILocal(context.Context, SendPathCLILocalArg) (SendResultCLILocal, error)
	AccountMergeCLILocal(context.Context, AccountMergeCLILocalArg) (TransactionID, error)
	ClaimCLILocal(context.Context, ClaimCLILocalArg) (RelayClaimResult, error)
	RecentPaymentsCLILocal(context.Context, *AccountID) ([]PaymentOrErrorCLILocal, error)
	PaymentDetailCLILocal(context.Context, string) (PaymentCLILocal, error)
	WalletInitLocal(context.Context) error
	WalletDumpLocal(context.Context) (Bundle, error)
	WalletGetAccountsCLILocal(context.Context) ([]OwnAccountCLILocal, error)
	OwnAccountLocal(context.Context, AccountID) (bool, error)
	ImportSecretKeyLocal(context.Context, ImportSecretKeyLocalArg) error
	ExportSecretKeyLocal(context.Context, AccountID) (SecretKey, error)
	SetDisplayCurrency(context.Context, SetDisplayCurrencyArg) error
	ExchangeRateLocal(context.Context, OutsideCurrencyCode) (OutsideExchangeRate, error)
	GetAvailableLocalCurrencies(context.Context) (map[OutsideCurrencyCode]OutsideCurrencyDefinition, error)
	FormatLocalCurrencyString(context.Context, FormatLocalCurrencyStringArg) (string, error)
	MakeRequestCLILocal(context.Context, MakeRequestCLILocalArg) (KeybaseRequestID, error)
	LookupCLILocal(context.Context, string) (LookupResultCLILocal, error)
	BatchLocal(context.Context, BatchLocalArg) (BatchResultLocal, error)
	ValidateStellarURILocal(context.Context, ValidateStellarURILocalArg) (ValidateStellarURIResultLocal, error)
	ApproveTxURILocal(context.Context, ApproveTxURILocalArg) (TransactionID, error)
	ApprovePayURILocal(context.Context, ApprovePayURILocalArg) (TransactionID, error)
	ApprovePathURILocal(context.Context, ApprovePathURILocalArg) (TransactionID, error)
	GetPartnerUrlsLocal(context.Context, int) ([]PartnerUrl, error)
	SignTransactionXdrLocal(context.Context, SignTransactionXdrLocalArg) (SignXdrResult, error)
	GetStaticConfigLocal(context.Context) (StaticConfig, error)
}

func LocalProtocol(i LocalInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "stellar.1.local",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getWalletAccountsLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetWalletAccountsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetWalletAccountsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetWalletAccountsLocalArg)(nil), args)
						return
					}
					ret, err = i.GetWalletAccountsLocal(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"getWalletAccountLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetWalletAccountLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetWalletAccountLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetWalletAccountLocalArg)(nil), args)
						return
					}
					ret, err = i.GetWalletAccountLocal(ctx, typedArgs[0])
					return
				},
			},
			"getAccountAssetsLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetAccountAssetsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetAccountAssetsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetAccountAssetsLocalArg)(nil), args)
						return
					}
					ret, err = i.GetAccountAssetsLocal(ctx, typedArgs[0])
					return
				},
			},
			"getPaymentsLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetPaymentsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetPaymentsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetPaymentsLocalArg)(nil), args)
						return
					}
					ret, err = i.GetPaymentsLocal(ctx, typedArgs[0])
					return
				},
			},
			"getPendingPaymentsLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetPendingPaymentsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetPendingPaymentsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetPendingPaymentsLocalArg)(nil), args)
						return
					}
					ret, err = i.GetPendingPaymentsLocal(ctx, typedArgs[0])
					return
				},
			},
			"markAsReadLocal": {
				MakeArg: func() interface{} {
					var ret [1]MarkAsReadLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]MarkAsReadLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]MarkAsReadLocalArg)(nil), args)
						return
					}
					err = i.MarkAsReadLocal(ctx, typedArgs[0])
					return
				},
			},
			"getPaymentDetailsLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetPaymentDetailsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetPaymentDetailsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetPaymentDetailsLocalArg)(nil), args)
						return
					}
					ret, err = i.GetPaymentDetailsLocal(ctx, typedArgs[0])
					return
				},
			},
			"getGenericPaymentDetailsLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetGenericPaymentDetailsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetGenericPaymentDetailsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetGenericPaymentDetailsLocalArg)(nil), args)
						return
					}
					ret, err = i.GetGenericPaymentDetailsLocal(ctx, typedArgs[0])
					return
				},
			},
			"getDisplayCurrenciesLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetDisplayCurrenciesLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetDisplayCurrenciesLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetDisplayCurrenciesLocalArg)(nil), args)
						return
					}
					ret, err = i.GetDisplayCurrenciesLocal(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"validateAccountIDLocal": {
				MakeArg: func() interface{} {
					var ret [1]ValidateAccountIDLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ValidateAccountIDLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ValidateAccountIDLocalArg)(nil), args)
						return
					}
					err = i.ValidateAccountIDLocal(ctx, typedArgs[0])
					return
				},
			},
			"validateSecretKeyLocal": {
				MakeArg: func() interface{} {
					var ret [1]ValidateSecretKeyLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ValidateSecretKeyLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ValidateSecretKeyLocalArg)(nil), args)
						return
					}
					err = i.ValidateSecretKeyLocal(ctx, typedArgs[0])
					return
				},
			},
			"validateAccountNameLocal": {
				MakeArg: func() interface{} {
					var ret [1]ValidateAccountNameLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ValidateAccountNameLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ValidateAccountNameLocalArg)(nil), args)
						return
					}
					err = i.ValidateAccountNameLocal(ctx, typedArgs[0])
					return
				},
			},
			"changeWalletAccountNameLocal": {
				MakeArg: func() interface{} {
					var ret [1]ChangeWalletAccountNameLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ChangeWalletAccountNameLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ChangeWalletAccountNameLocalArg)(nil), args)
						return
					}
					ret, err = i.ChangeWalletAccountNameLocal(ctx, typedArgs[0])
					return
				},
			},
			"setWalletAccountAsDefaultLocal": {
				MakeArg: func() interface{} {
					var ret [1]SetWalletAccountAsDefaultLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetWalletAccountAsDefaultLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetWalletAccountAsDefaultLocalArg)(nil), args)
						return
					}
					ret, err = i.SetWalletAccountAsDefaultLocal(ctx, typedArgs[0])
					return
				},
			},
			"deleteWalletAccountLocal": {
				MakeArg: func() interface{} {
					var ret [1]DeleteWalletAccountLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DeleteWalletAccountLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DeleteWalletAccountLocalArg)(nil), args)
						return
					}
					err = i.DeleteWalletAccountLocal(ctx, typedArgs[0])
					return
				},
			},
			"linkNewWalletAccountLocal": {
				MakeArg: func() interface{} {
					var ret [1]LinkNewWalletAccountLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LinkNewWalletAccountLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LinkNewWalletAccountLocalArg)(nil), args)
						return
					}
					ret, err = i.LinkNewWalletAccountLocal(ctx, typedArgs[0])
					return
				},
			},
			"createWalletAccountLocal": {
				MakeArg: func() interface{} {
					var ret [1]CreateWalletAccountLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CreateWalletAccountLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CreateWalletAccountLocalArg)(nil), args)
						return
					}
					ret, err = i.CreateWalletAccountLocal(ctx, typedArgs[0])
					return
				},
			},
			"changeDisplayCurrencyLocal": {
				MakeArg: func() interface{} {
					var ret [1]ChangeDisplayCurrencyLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ChangeDisplayCurrencyLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ChangeDisplayCurrencyLocalArg)(nil), args)
						return
					}
					ret, err = i.ChangeDisplayCurrencyLocal(ctx, typedArgs[0])
					return
				},
			},
			"getDisplayCurrencyLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetDisplayCurrencyLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetDisplayCurrencyLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetDisplayCurrencyLocalArg)(nil), args)
						return
					}
					ret, err = i.GetDisplayCurrencyLocal(ctx, typedArgs[0])
					return
				},
			},
			"hasAcceptedDisclaimerLocal": {
				MakeArg: func() interface{} {
					var ret [1]HasAcceptedDisclaimerLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]HasAcceptedDisclaimerLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]HasAcceptedDisclaimerLocalArg)(nil), args)
						return
					}
					ret, err = i.HasAcceptedDisclaimerLocal(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"acceptDisclaimerLocal": {
				MakeArg: func() interface{} {
					var ret [1]AcceptDisclaimerLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AcceptDisclaimerLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AcceptDisclaimerLocalArg)(nil), args)
						return
					}
					err = i.AcceptDisclaimerLocal(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"getWalletAccountPublicKeyLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetWalletAccountPublicKeyLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetWalletAccountPublicKeyLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetWalletAccountPublicKeyLocalArg)(nil), args)
						return
					}
					ret, err = i.GetWalletAccountPublicKeyLocal(ctx, typedArgs[0])
					return
				},
			},
			"getWalletAccountSecretKeyLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetWalletAccountSecretKeyLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetWalletAccountSecretKeyLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetWalletAccountSecretKeyLocalArg)(nil), args)
						return
					}
					ret, err = i.GetWalletAccountSecretKeyLocal(ctx, typedArgs[0])
					return
				},
			},
			"getSendAssetChoicesLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetSendAssetChoicesLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetSendAssetChoicesLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetSendAssetChoicesLocalArg)(nil), args)
						return
					}
					ret, err = i.GetSendAssetChoicesLocal(ctx, typedArgs[0])
					return
				},
			},
			"startBuildPaymentLocal": {
				MakeArg: func() interface{} {
					var ret [1]StartBuildPaymentLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]StartBuildPaymentLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]StartBuildPaymentLocalArg)(nil), args)
						return
					}
					ret, err = i.StartBuildPaymentLocal(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"stopBuildPaymentLocal": {
				MakeArg: func() interface{} {
					var ret [1]StopBuildPaymentLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]StopBuildPaymentLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]StopBuildPaymentLocalArg)(nil), args)
						return
					}
					err = i.StopBuildPaymentLocal(ctx, typedArgs[0])
					return
				},
			},
			"buildPaymentLocal": {
				MakeArg: func() interface{} {
					var ret [1]BuildPaymentLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]BuildPaymentLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]BuildPaymentLocalArg)(nil), args)
						return
					}
					ret, err = i.BuildPaymentLocal(ctx, typedArgs[0])
					return
				},
			},
			"reviewPaymentLocal": {
				MakeArg: func() interface{} {
					var ret [1]ReviewPaymentLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ReviewPaymentLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ReviewPaymentLocalArg)(nil), args)
						return
					}
					err = i.ReviewPaymentLocal(ctx, typedArgs[0])
					return
				},
			},
			"sendPaymentLocal": {
				MakeArg: func() interface{} {
					var ret [1]SendPaymentLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SendPaymentLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SendPaymentLocalArg)(nil), args)
						return
					}
					ret, err = i.SendPaymentLocal(ctx, typedArgs[0])
					return
				},
			},
			"sendPathLocal": {
				MakeArg: func() interface{} {
					var ret [1]SendPathLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SendPathLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SendPathLocalArg)(nil), args)
						return
					}
					ret, err = i.SendPathLocal(ctx, typedArgs[0])
					return
				},
			},
			"buildRequestLocal": {
				MakeArg: func() interface{} {
					var ret [1]BuildRequestLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]BuildRequestLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]BuildRequestLocalArg)(nil), args)
						return
					}
					ret, err = i.BuildRequestLocal(ctx, typedArgs[0])
					return
				},
			},
			"getRequestDetailsLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetRequestDetailsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetRequestDetailsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetRequestDetailsLocalArg)(nil), args)
						return
					}
					ret, err = i.GetRequestDetailsLocal(ctx, typedArgs[0])
					return
				},
			},
			"cancelRequestLocal": {
				MakeArg: func() interface{} {
					var ret [1]CancelRequestLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CancelRequestLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CancelRequestLocalArg)(nil), args)
						return
					}
					err = i.CancelRequestLocal(ctx, typedArgs[0])
					return
				},
			},
			"makeRequestLocal": {
				MakeArg: func() interface{} {
					var ret [1]MakeRequestLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]MakeRequestLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]MakeRequestLocalArg)(nil), args)
						return
					}
					ret, err = i.MakeRequestLocal(ctx, typedArgs[0])
					return
				},
			},
			"setAccountMobileOnlyLocal": {
				MakeArg: func() interface{} {
					var ret [1]SetAccountMobileOnlyLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetAccountMobileOnlyLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetAccountMobileOnlyLocalArg)(nil), args)
						return
					}
					err = i.SetAccountMobileOnlyLocal(ctx, typedArgs[0])
					return
				},
			},
			"setAccountAllDevicesLocal": {
				MakeArg: func() interface{} {
					var ret [1]SetAccountAllDevicesLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetAccountAllDevicesLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetAccountAllDevicesLocalArg)(nil), args)
						return
					}
					err = i.SetAccountAllDevicesLocal(ctx, typedArgs[0])
					return
				},
			},
			"isAccountMobileOnlyLocal": {
				MakeArg: func() interface{} {
					var ret [1]IsAccountMobileOnlyLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]IsAccountMobileOnlyLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]IsAccountMobileOnlyLocalArg)(nil), args)
						return
					}
					ret, err = i.IsAccountMobileOnlyLocal(ctx, typedArgs[0])
					return
				},
			},
			"cancelPaymentLocal": {
				MakeArg: func() interface{} {
					var ret [1]CancelPaymentLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CancelPaymentLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CancelPaymentLocalArg)(nil), args)
						return
					}
					ret, err = i.CancelPaymentLocal(ctx, typedArgs[0])
					return
				},
			},
			"getPredefinedInflationDestinationsLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetPredefinedInflationDestinationsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetPredefinedInflationDestinationsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetPredefinedInflationDestinationsLocalArg)(nil), args)
						return
					}
					ret, err = i.GetPredefinedInflationDestinationsLocal(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"setInflationDestinationLocal": {
				MakeArg: func() interface{} {
					var ret [1]SetInflationDestinationLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetInflationDestinationLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetInflationDestinationLocalArg)(nil), args)
						return
					}
					err = i.SetInflationDestinationLocal(ctx, typedArgs[0])
					return
				},
			},
			"getInflationDestinationLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetInflationDestinationLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetInflationDestinationLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetInflationDestinationLocalArg)(nil), args)
						return
					}
					ret, err = i.GetInflationDestinationLocal(ctx, typedArgs[0])
					return
				},
			},
			"airdropDetailsLocal": {
				MakeArg: func() interface{} {
					var ret [1]AirdropDetailsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AirdropDetailsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AirdropDetailsLocalArg)(nil), args)
						return
					}
					ret, err = i.AirdropDetailsLocal(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"airdropStatusLocal": {
				MakeArg: func() interface{} {
					var ret [1]AirdropStatusLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AirdropStatusLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AirdropStatusLocalArg)(nil), args)
						return
					}
					ret, err = i.AirdropStatusLocal(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"airdropRegisterLocal": {
				MakeArg: func() interface{} {
					var ret [1]AirdropRegisterLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AirdropRegisterLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AirdropRegisterLocalArg)(nil), args)
						return
					}
					err = i.AirdropRegisterLocal(ctx, typedArgs[0])
					return
				},
			},
			"fuzzyAssetSearchLocal": {
				MakeArg: func() interface{} {
					var ret [1]FuzzyAssetSearchLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FuzzyAssetSearchLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FuzzyAssetSearchLocalArg)(nil), args)
						return
					}
					ret, err = i.FuzzyAssetSearchLocal(ctx, typedArgs[0])
					return
				},
			},
			"listPopularAssetsLocal": {
				MakeArg: func() interface{} {
					var ret [1]ListPopularAssetsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ListPopularAssetsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ListPopularAssetsLocalArg)(nil), args)
						return
					}
					ret, err = i.ListPopularAssetsLocal(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"addTrustlineLocal": {
				MakeArg: func() interface{} {
					var ret [1]AddTrustlineLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AddTrustlineLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AddTrustlineLocalArg)(nil), args)
						return
					}
					err = i.AddTrustlineLocal(ctx, typedArgs[0])
					return
				},
			},
			"deleteTrustlineLocal": {
				MakeArg: func() interface{} {
					var ret [1]DeleteTrustlineLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DeleteTrustlineLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DeleteTrustlineLocalArg)(nil), args)
						return
					}
					err = i.DeleteTrustlineLocal(ctx, typedArgs[0])
					return
				},
			},
			"changeTrustlineLimitLocal": {
				MakeArg: func() interface{} {
					var ret [1]ChangeTrustlineLimitLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ChangeTrustlineLimitLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ChangeTrustlineLimitLocalArg)(nil), args)
						return
					}
					err = i.ChangeTrustlineLimitLocal(ctx, typedArgs[0])
					return
				},
			},
			"getTrustlinesLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetTrustlinesLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetTrustlinesLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetTrustlinesLocalArg)(nil), args)
						return
					}
					ret, err = i.GetTrustlinesLocal(ctx, typedArgs[0])
					return
				},
			},
			"getTrustlinesForRecipientLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetTrustlinesForRecipientLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetTrustlinesForRecipientLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetTrustlinesForRecipientLocalArg)(nil), args)
						return
					}
					ret, err = i.GetTrustlinesForRecipientLocal(ctx, typedArgs[0])
					return
				},
			},
			"findPaymentPathLocal": {
				MakeArg: func() interface{} {
					var ret [1]FindPaymentPathLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FindPaymentPathLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FindPaymentPathLocalArg)(nil), args)
						return
					}
					ret, err = i.FindPaymentPathLocal(ctx, typedArgs[0])
					return
				},
			},
			"assetDepositLocal": {
				MakeArg: func() interface{} {
					var ret [1]AssetDepositLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AssetDepositLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AssetDepositLocalArg)(nil), args)
						return
					}
					ret, err = i.AssetDepositLocal(ctx, typedArgs[0])
					return
				},
			},
			"assetWithdrawLocal": {
				MakeArg: func() interface{} {
					var ret [1]AssetWithdrawLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AssetWithdrawLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AssetWithdrawLocalArg)(nil), args)
						return
					}
					ret, err = i.AssetWithdrawLocal(ctx, typedArgs[0])
					return
				},
			},
			"balancesLocal": {
				MakeArg: func() interface{} {
					var ret [1]BalancesLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]BalancesLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]BalancesLocalArg)(nil), args)
						return
					}
					ret, err = i.BalancesLocal(ctx, typedArgs[0].AccountID)
					return
				},
			},
			"sendCLILocal": {
				MakeArg: func() interface{} {
					var ret [1]SendCLILocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SendCLILocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SendCLILocalArg)(nil), args)
						return
					}
					ret, err = i.SendCLILocal(ctx, typedArgs[0])
					return
				},
			},
			"sendPathCLILocal": {
				MakeArg: func() interface{} {
					var ret [1]SendPathCLILocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SendPathCLILocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SendPathCLILocalArg)(nil), args)
						return
					}
					ret, err = i.SendPathCLILocal(ctx, typedArgs[0])
					return
				},
			},
			"accountMergeCLILocal": {
				MakeArg: func() interface{} {
					var ret [1]AccountMergeCLILocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AccountMergeCLILocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AccountMergeCLILocalArg)(nil), args)
						return
					}
					ret, err = i.AccountMergeCLILocal(ctx, typedArgs[0])
					return
				},
			},
			"claimCLILocal": {
				MakeArg: func() interface{} {
					var ret [1]ClaimCLILocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ClaimCLILocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ClaimCLILocalArg)(nil), args)
						return
					}
					ret, err = i.ClaimCLILocal(ctx, typedArgs[0])
					return
				},
			},
			"recentPaymentsCLILocal": {
				MakeArg: func() interface{} {
					var ret [1]RecentPaymentsCLILocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RecentPaymentsCLILocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RecentPaymentsCLILocalArg)(nil), args)
						return
					}
					ret, err = i.RecentPaymentsCLILocal(ctx, typedArgs[0].AccountID)
					return
				},
			},
			"paymentDetailCLILocal": {
				MakeArg: func() interface{} {
					var ret [1]PaymentDetailCLILocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PaymentDetailCLILocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PaymentDetailCLILocalArg)(nil), args)
						return
					}
					ret, err = i.PaymentDetailCLILocal(ctx, typedArgs[0].TxID)
					return
				},
			},
			"walletInitLocal": {
				MakeArg: func() interface{} {
					var ret [1]WalletInitLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.WalletInitLocal(ctx)
					return
				},
			},
			"walletDumpLocal": {
				MakeArg: func() interface{} {
					var ret [1]WalletDumpLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.WalletDumpLocal(ctx)
					return
				},
			},
			"walletGetAccountsCLILocal": {
				MakeArg: func() interface{} {
					var ret [1]WalletGetAccountsCLILocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.WalletGetAccountsCLILocal(ctx)
					return
				},
			},
			"ownAccountLocal": {
				MakeArg: func() interface{} {
					var ret [1]OwnAccountLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]OwnAccountLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]OwnAccountLocalArg)(nil), args)
						return
					}
					ret, err = i.OwnAccountLocal(ctx, typedArgs[0].AccountID)
					return
				},
			},
			"importSecretKeyLocal": {
				MakeArg: func() interface{} {
					var ret [1]ImportSecretKeyLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ImportSecretKeyLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ImportSecretKeyLocalArg)(nil), args)
						return
					}
					err = i.ImportSecretKeyLocal(ctx, typedArgs[0])
					return
				},
			},
			"exportSecretKeyLocal": {
				MakeArg: func() interface{} {
					var ret [1]ExportSecretKeyLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ExportSecretKeyLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ExportSecretKeyLocalArg)(nil), args)
						return
					}
					ret, err = i.ExportSecretKeyLocal(ctx, typedArgs[0].AccountID)
					return
				},
			},
			"setDisplayCurrency": {
				MakeArg: func() interface{} {
					var ret [1]SetDisplayCurrencyArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetDisplayCurrencyArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetDisplayCurrencyArg)(nil), args)
						return
					}
					err = i.SetDisplayCurrency(ctx, typedArgs[0])
					return
				},
			},
			"exchangeRateLocal": {
				MakeArg: func() interface{} {
					var ret [1]ExchangeRateLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ExchangeRateLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ExchangeRateLocalArg)(nil), args)
						return
					}
					ret, err = i.ExchangeRateLocal(ctx, typedArgs[0].Currency)
					return
				},
			},
			"getAvailableLocalCurrencies": {
				MakeArg: func() interface{} {
					var ret [1]GetAvailableLocalCurrenciesArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetAvailableLocalCurrencies(ctx)
					return
				},
			},
			"formatLocalCurrencyString": {
				MakeArg: func() interface{} {
					var ret [1]FormatLocalCurrencyStringArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FormatLocalCurrencyStringArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FormatLocalCurrencyStringArg)(nil), args)
						return
					}
					ret, err = i.FormatLocalCurrencyString(ctx, typedArgs[0])
					return
				},
			},
			"makeRequestCLILocal": {
				MakeArg: func() interface{} {
					var ret [1]MakeRequestCLILocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]MakeRequestCLILocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]MakeRequestCLILocalArg)(nil), args)
						return
					}
					ret, err = i.MakeRequestCLILocal(ctx, typedArgs[0])
					return
				},
			},
			"lookupCLILocal": {
				MakeArg: func() interface{} {
					var ret [1]LookupCLILocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LookupCLILocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LookupCLILocalArg)(nil), args)
						return
					}
					ret, err = i.LookupCLILocal(ctx, typedArgs[0].Name)
					return
				},
			},
			"batchLocal": {
				MakeArg: func() interface{} {
					var ret [1]BatchLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]BatchLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]BatchLocalArg)(nil), args)
						return
					}
					ret, err = i.BatchLocal(ctx, typedArgs[0])
					return
				},
			},
			"validateStellarURILocal": {
				MakeArg: func() interface{} {
					var ret [1]ValidateStellarURILocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ValidateStellarURILocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ValidateStellarURILocalArg)(nil), args)
						return
					}
					ret, err = i.ValidateStellarURILocal(ctx, typedArgs[0])
					return
				},
			},
			"approveTxURILocal": {
				MakeArg: func() interface{} {
					var ret [1]ApproveTxURILocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ApproveTxURILocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ApproveTxURILocalArg)(nil), args)
						return
					}
					ret, err = i.ApproveTxURILocal(ctx, typedArgs[0])
					return
				},
			},
			"approvePayURILocal": {
				MakeArg: func() interface{} {
					var ret [1]ApprovePayURILocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ApprovePayURILocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ApprovePayURILocalArg)(nil), args)
						return
					}
					ret, err = i.ApprovePayURILocal(ctx, typedArgs[0])
					return
				},
			},
			"approvePathURILocal": {
				MakeArg: func() interface{} {
					var ret [1]ApprovePathURILocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ApprovePathURILocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ApprovePathURILocalArg)(nil), args)
						return
					}
					ret, err = i.ApprovePathURILocal(ctx, typedArgs[0])
					return
				},
			},
			"getPartnerUrlsLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetPartnerUrlsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetPartnerUrlsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetPartnerUrlsLocalArg)(nil), args)
						return
					}
					ret, err = i.GetPartnerUrlsLocal(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"signTransactionXdrLocal": {
				MakeArg: func() interface{} {
					var ret [1]SignTransactionXdrLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SignTransactionXdrLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SignTransactionXdrLocalArg)(nil), args)
						return
					}
					ret, err = i.SignTransactionXdrLocal(ctx, typedArgs[0])
					return
				},
			},
			"getStaticConfigLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetStaticConfigLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetStaticConfigLocal(ctx)
					return
				},
			},
		},
	}
}

type LocalClient struct {
	Cli rpc.GenericClient
}

func (c LocalClient) GetWalletAccountsLocal(ctx context.Context, sessionID int) (res []WalletAccountLocal, err error) {
	__arg := GetWalletAccountsLocalArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "stellar.1.local.getWalletAccountsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetWalletAccountLocal(ctx context.Context, __arg GetWalletAccountLocalArg) (res WalletAccountLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.getWalletAccountLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetAccountAssetsLocal(ctx context.Context, __arg GetAccountAssetsLocalArg) (res []AccountAssetLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.getAccountAssetsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetPaymentsLocal(ctx context.Context, __arg GetPaymentsLocalArg) (res PaymentsPageLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.getPaymentsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetPendingPaymentsLocal(ctx context.Context, __arg GetPendingPaymentsLocalArg) (res []PaymentOrErrorLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.getPendingPaymentsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) MarkAsReadLocal(ctx context.Context, __arg MarkAsReadLocalArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.markAsReadLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) GetPaymentDetailsLocal(ctx context.Context, __arg GetPaymentDetailsLocalArg) (res PaymentDetailsLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.getPaymentDetailsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetGenericPaymentDetailsLocal(ctx context.Context, __arg GetGenericPaymentDetailsLocalArg) (res PaymentDetailsLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.getGenericPaymentDetailsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetDisplayCurrenciesLocal(ctx context.Context, sessionID int) (res []CurrencyLocal, err error) {
	__arg := GetDisplayCurrenciesLocalArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "stellar.1.local.getDisplayCurrenciesLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) ValidateAccountIDLocal(ctx context.Context, __arg ValidateAccountIDLocalArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.validateAccountIDLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) ValidateSecretKeyLocal(ctx context.Context, __arg ValidateSecretKeyLocalArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.validateSecretKeyLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) ValidateAccountNameLocal(ctx context.Context, __arg ValidateAccountNameLocalArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.validateAccountNameLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) ChangeWalletAccountNameLocal(ctx context.Context, __arg ChangeWalletAccountNameLocalArg) (res WalletAccountLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.changeWalletAccountNameLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) SetWalletAccountAsDefaultLocal(ctx context.Context, __arg SetWalletAccountAsDefaultLocalArg) (res []WalletAccountLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.setWalletAccountAsDefaultLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) DeleteWalletAccountLocal(ctx context.Context, __arg DeleteWalletAccountLocalArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.deleteWalletAccountLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) LinkNewWalletAccountLocal(ctx context.Context, __arg LinkNewWalletAccountLocalArg) (res AccountID, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.linkNewWalletAccountLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) CreateWalletAccountLocal(ctx context.Context, __arg CreateWalletAccountLocalArg) (res AccountID, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.createWalletAccountLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) ChangeDisplayCurrencyLocal(ctx context.Context, __arg ChangeDisplayCurrencyLocalArg) (res CurrencyLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.changeDisplayCurrencyLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetDisplayCurrencyLocal(ctx context.Context, __arg GetDisplayCurrencyLocalArg) (res CurrencyLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.getDisplayCurrencyLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) HasAcceptedDisclaimerLocal(ctx context.Context, sessionID int) (res bool, err error) {
	__arg := HasAcceptedDisclaimerLocalArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "stellar.1.local.hasAcceptedDisclaimerLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) AcceptDisclaimerLocal(ctx context.Context, sessionID int) (err error) {
	__arg := AcceptDisclaimerLocalArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "stellar.1.local.acceptDisclaimerLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) GetWalletAccountPublicKeyLocal(ctx context.Context, __arg GetWalletAccountPublicKeyLocalArg) (res string, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.getWalletAccountPublicKeyLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetWalletAccountSecretKeyLocal(ctx context.Context, __arg GetWalletAccountSecretKeyLocalArg) (res SecretKey, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.getWalletAccountSecretKeyLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetSendAssetChoicesLocal(ctx context.Context, __arg GetSendAssetChoicesLocalArg) (res []SendAssetChoiceLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.getSendAssetChoicesLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) StartBuildPaymentLocal(ctx context.Context, sessionID int) (res BuildPaymentID, err error) {
	__arg := StartBuildPaymentLocalArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "stellar.1.local.startBuildPaymentLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) StopBuildPaymentLocal(ctx context.Context, __arg StopBuildPaymentLocalArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.stopBuildPaymentLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) BuildPaymentLocal(ctx context.Context, __arg BuildPaymentLocalArg) (res BuildPaymentResLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.buildPaymentLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) ReviewPaymentLocal(ctx context.Context, __arg ReviewPaymentLocalArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.reviewPaymentLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) SendPaymentLocal(ctx context.Context, __arg SendPaymentLocalArg) (res SendPaymentResLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.sendPaymentLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) SendPathLocal(ctx context.Context, __arg SendPathLocalArg) (res SendPaymentResLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.sendPathLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) BuildRequestLocal(ctx context.Context, __arg BuildRequestLocalArg) (res BuildRequestResLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.buildRequestLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetRequestDetailsLocal(ctx context.Context, __arg GetRequestDetailsLocalArg) (res RequestDetailsLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.getRequestDetailsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) CancelRequestLocal(ctx context.Context, __arg CancelRequestLocalArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.cancelRequestLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) MakeRequestLocal(ctx context.Context, __arg MakeRequestLocalArg) (res KeybaseRequestID, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.makeRequestLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) SetAccountMobileOnlyLocal(ctx context.Context, __arg SetAccountMobileOnlyLocalArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.setAccountMobileOnlyLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) SetAccountAllDevicesLocal(ctx context.Context, __arg SetAccountAllDevicesLocalArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.setAccountAllDevicesLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) IsAccountMobileOnlyLocal(ctx context.Context, __arg IsAccountMobileOnlyLocalArg) (res bool, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.isAccountMobileOnlyLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) CancelPaymentLocal(ctx context.Context, __arg CancelPaymentLocalArg) (res RelayClaimResult, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.cancelPaymentLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetPredefinedInflationDestinationsLocal(ctx context.Context, sessionID int) (res []PredefinedInflationDestination, err error) {
	__arg := GetPredefinedInflationDestinationsLocalArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "stellar.1.local.getPredefinedInflationDestinationsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) SetInflationDestinationLocal(ctx context.Context, __arg SetInflationDestinationLocalArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.setInflationDestinationLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) GetInflationDestinationLocal(ctx context.Context, __arg GetInflationDestinationLocalArg) (res InflationDestinationResultLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.getInflationDestinationLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) AirdropDetailsLocal(ctx context.Context, sessionID int) (res AirdropDetails, err error) {
	__arg := AirdropDetailsLocalArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "stellar.1.local.airdropDetailsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) AirdropStatusLocal(ctx context.Context, sessionID int) (res AirdropStatus, err error) {
	__arg := AirdropStatusLocalArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "stellar.1.local.airdropStatusLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) AirdropRegisterLocal(ctx context.Context, __arg AirdropRegisterLocalArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.airdropRegisterLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) FuzzyAssetSearchLocal(ctx context.Context, __arg FuzzyAssetSearchLocalArg) (res []Asset, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.fuzzyAssetSearchLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) ListPopularAssetsLocal(ctx context.Context, sessionID int) (res AssetListResult, err error) {
	__arg := ListPopularAssetsLocalArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "stellar.1.local.listPopularAssetsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) AddTrustlineLocal(ctx context.Context, __arg AddTrustlineLocalArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.addTrustlineLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) DeleteTrustlineLocal(ctx context.Context, __arg DeleteTrustlineLocalArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.deleteTrustlineLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) ChangeTrustlineLimitLocal(ctx context.Context, __arg ChangeTrustlineLimitLocalArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.changeTrustlineLimitLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) GetTrustlinesLocal(ctx context.Context, __arg GetTrustlinesLocalArg) (res []Balance, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.getTrustlinesLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetTrustlinesForRecipientLocal(ctx context.Context, __arg GetTrustlinesForRecipientLocalArg) (res RecipientTrustlinesLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.getTrustlinesForRecipientLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) FindPaymentPathLocal(ctx context.Context, __arg FindPaymentPathLocalArg) (res PaymentPathLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.findPaymentPathLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) AssetDepositLocal(ctx context.Context, __arg AssetDepositLocalArg) (res AssetActionResultLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.assetDepositLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) AssetWithdrawLocal(ctx context.Context, __arg AssetWithdrawLocalArg) (res AssetActionResultLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.assetWithdrawLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) BalancesLocal(ctx context.Context, accountID AccountID) (res []Balance, err error) {
	__arg := BalancesLocalArg{AccountID: accountID}
	err = c.Cli.Call(ctx, "stellar.1.local.balancesLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) SendCLILocal(ctx context.Context, __arg SendCLILocalArg) (res SendResultCLILocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.sendCLILocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) SendPathCLILocal(ctx context.Context, __arg SendPathCLILocalArg) (res SendResultCLILocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.sendPathCLILocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) AccountMergeCLILocal(ctx context.Context, __arg AccountMergeCLILocalArg) (res TransactionID, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.accountMergeCLILocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) ClaimCLILocal(ctx context.Context, __arg ClaimCLILocalArg) (res RelayClaimResult, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.claimCLILocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) RecentPaymentsCLILocal(ctx context.Context, accountID *AccountID) (res []PaymentOrErrorCLILocal, err error) {
	__arg := RecentPaymentsCLILocalArg{AccountID: accountID}
	err = c.Cli.Call(ctx, "stellar.1.local.recentPaymentsCLILocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) PaymentDetailCLILocal(ctx context.Context, txID string) (res PaymentCLILocal, err error) {
	__arg := PaymentDetailCLILocalArg{TxID: txID}
	err = c.Cli.Call(ctx, "stellar.1.local.paymentDetailCLILocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) WalletInitLocal(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.walletInitLocal", []interface{}{WalletInitLocalArg{}}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) WalletDumpLocal(ctx context.Context) (res Bundle, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.walletDumpLocal", []interface{}{WalletDumpLocalArg{}}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) WalletGetAccountsCLILocal(ctx context.Context) (res []OwnAccountCLILocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.walletGetAccountsCLILocal", []interface{}{WalletGetAccountsCLILocalArg{}}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) OwnAccountLocal(ctx context.Context, accountID AccountID) (res bool, err error) {
	__arg := OwnAccountLocalArg{AccountID: accountID}
	err = c.Cli.Call(ctx, "stellar.1.local.ownAccountLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) ImportSecretKeyLocal(ctx context.Context, __arg ImportSecretKeyLocalArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.importSecretKeyLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) ExportSecretKeyLocal(ctx context.Context, accountID AccountID) (res SecretKey, err error) {
	__arg := ExportSecretKeyLocalArg{AccountID: accountID}
	err = c.Cli.Call(ctx, "stellar.1.local.exportSecretKeyLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) SetDisplayCurrency(ctx context.Context, __arg SetDisplayCurrencyArg) (err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.setDisplayCurrency", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) ExchangeRateLocal(ctx context.Context, currency OutsideCurrencyCode) (res OutsideExchangeRate, err error) {
	__arg := ExchangeRateLocalArg{Currency: currency}
	err = c.Cli.Call(ctx, "stellar.1.local.exchangeRateLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetAvailableLocalCurrencies(ctx context.Context) (res map[OutsideCurrencyCode]OutsideCurrencyDefinition, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.getAvailableLocalCurrencies", []interface{}{GetAvailableLocalCurrenciesArg{}}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) FormatLocalCurrencyString(ctx context.Context, __arg FormatLocalCurrencyStringArg) (res string, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.formatLocalCurrencyString", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) MakeRequestCLILocal(ctx context.Context, __arg MakeRequestCLILocalArg) (res KeybaseRequestID, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.makeRequestCLILocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) LookupCLILocal(ctx context.Context, name string) (res LookupResultCLILocal, err error) {
	__arg := LookupCLILocalArg{Name: name}
	err = c.Cli.Call(ctx, "stellar.1.local.lookupCLILocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) BatchLocal(ctx context.Context, __arg BatchLocalArg) (res BatchResultLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.batchLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) ValidateStellarURILocal(ctx context.Context, __arg ValidateStellarURILocalArg) (res ValidateStellarURIResultLocal, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.validateStellarURILocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) ApproveTxURILocal(ctx context.Context, __arg ApproveTxURILocalArg) (res TransactionID, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.approveTxURILocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) ApprovePayURILocal(ctx context.Context, __arg ApprovePayURILocalArg) (res TransactionID, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.approvePayURILocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) ApprovePathURILocal(ctx context.Context, __arg ApprovePathURILocalArg) (res TransactionID, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.approvePathURILocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetPartnerUrlsLocal(ctx context.Context, sessionID int) (res []PartnerUrl, err error) {
	__arg := GetPartnerUrlsLocalArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "stellar.1.local.getPartnerUrlsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) SignTransactionXdrLocal(ctx context.Context, __arg SignTransactionXdrLocalArg) (res SignXdrResult, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.signTransactionXdrLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetStaticConfigLocal(ctx context.Context) (res StaticConfig, err error) {
	err = c.Cli.Call(ctx, "stellar.1.local.getStaticConfigLocal", []interface{}{GetStaticConfigLocalArg{}}, &res, 0*time.Millisecond)
	return
}
