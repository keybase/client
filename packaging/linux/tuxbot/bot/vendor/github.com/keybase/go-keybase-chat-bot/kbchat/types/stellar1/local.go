// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/stellar1/local.avdl

package stellar1

import (
	"fmt"
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
