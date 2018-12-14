package horizon

import (
	"encoding/json"
	hProtocol "github.com/stellar/go/protocols/horizon"
	"github.com/stellar/go/support/render/hal"
)

// Deprecated: use protocols/horizon instead
type Problem struct {
	Type     string                     `json:"type"`
	Title    string                     `json:"title"`
	Status   int                        `json:"status"`
	Detail   string                     `json:"detail,omitempty"`
	Instance string                     `json:"instance,omitempty"`
	Extras   map[string]json.RawMessage `json:"extras,omitempty"`
}

// Deprecated: use protocols/horizon instead
type Root = hProtocol.Root

// Deprecated: use protocols/horizon instead
type Account = hProtocol.Account

// Deprecated: use protocols/horizon instead
type AccountFlags = hProtocol.AccountFlags

// Deprecated: use protocols/horizon instead
type AccountThresholds = hProtocol.AccountThresholds

// Deprecated: use protocols/horizon instead
type Asset = hProtocol.Asset

// Deprecated: use protocols/horizon instead
type Balance = hProtocol.Balance

// Deprecated: use protocols/horizon instead
type HistoryAccount = hProtocol.HistoryAccount

// Deprecated: use protocols/horizon instead
type Ledger = hProtocol.Ledger

// Deprecated: use render/hal instead
type Link = hal.Link

// Deprecated: use protocols/horizon instead
type Offer = hProtocol.Offer

// EffectsPageResponse contains page of effects returned by Horizon.
// Currently used by LoadAccountMergeAmount only.
type EffectsPage struct {
	Embedded struct {
		Records []Effect
	} `json:"_embedded"`
}

// EffectResponse contains effect data returned by Horizon.
// Currently used by LoadAccountMergeAmount only.
type Effect struct {
	Type   string `json:"type"`
	Amount string `json:"amount"`
}

// TradeAggregationsPage returns a list of aggregated trade records, aggregated by resolution
type TradeAggregationsPage struct {
	Links hal.Links `json:"_links"`
	Embedded struct {
		Records []TradeAggregation `json:"records"`
	} `json:"_embedded"`
}

// Deprecated: use protocols/horizon instead
type TradeAggregation = hProtocol.TradeAggregation

// TradesPage returns a list of trade records
type TradesPage struct {
	Links hal.Links `json:"_links"`
	Embedded struct {
		Records []Trade `json:"records"`
	} `json:"_embedded"`
}

// Deprecated: use protocols/horizon instead
type Trade = hProtocol.Trade

// Deprecated: use protocols/horizon instead
type OrderBookSummary = hProtocol.OrderBookSummary

// Deprecated: use protocols/horizon instead
type TransactionSuccess = hProtocol.TransactionSuccess

// Deprecated: use protocols/horizon instead
type TransactionResultCodes = hProtocol.TransactionResultCodes

// Deprecated: use protocols/horizon instead
type Signer = hProtocol.Signer

// OffersPage returns a list of offers
type OffersPage struct {
	Links hal.Links `json:"_links"`
	Embedded struct {
		Records []Offer `json:"records"`
	} `json:"_embedded"`
}

type Payment struct {
	ID          string `json:"id"`
	Type        string `json:"type"`
	PagingToken string `json:"paging_token"`

	Links struct {
		Effects struct {
			Href string `json:"href"`
		} `json:"effects"`
		Transaction struct {
			Href string `json:"href"`
		} `json:"transaction"`
	} `json:"_links"`

	SourceAccount string `json:"source_account"`
	CreatedAt     string `json:"created_at"`

	// create_account and account_merge field
	Account string `json:"account"`

	// create_account fields
	Funder          string `json:"funder"`
	StartingBalance string `json:"starting_balance"`

	// account_merge fields
	Into string `json:into"`

	// payment/path_payment fields
	From        string `json:"from"`
	To          string `json:"to"`
	AssetType   string `json:"asset_type"`
	AssetCode   string `json:"asset_code"`
	AssetIssuer string `json:"asset_issuer"`
	Amount      string `json:"amount"`

	// transaction fields
	TransactionHash string `json:"transaction_hash"`
	Memo            struct {
		Type  string `json:"memo_type"`
		Value string `json:"memo"`
	}
}

// Deprecated: use protocols/horizon instead
type Price = hProtocol.Price

// Deprecated: use protocols/horizon instead
type PriceLevel = hProtocol.PriceLevel

// Deprecated: use protocols/horizon instead
type Transaction = hProtocol.Transaction
