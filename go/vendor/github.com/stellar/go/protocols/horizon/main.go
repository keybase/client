// Package horizon contains the type definitions for all of horizon's
// response resources.
package horizon

import (
	"fmt"
	"strconv"
	"time"

	"encoding/base64"
	"encoding/json"

	"github.com/stellar/go/protocols/horizon/base"
	"github.com/stellar/go/strkey"
	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/support/render/hal"
	"github.com/stellar/go/xdr"
)

// KeyTypeNames maps from strkey version bytes into json string values to use in
// horizon responses.
var KeyTypeNames = map[strkey.VersionByte]string{
	strkey.VersionByteAccountID: "ed25519_public_key",
	strkey.VersionByteSeed:      "ed25519_secret_seed",
	strkey.VersionByteHashX:     "sha256_hash",
	strkey.VersionByteHashTx:    "preauth_tx",
}

// Account is the summary of an account
type Account struct {
	Links struct {
		Self         hal.Link `json:"self"`
		Transactions hal.Link `json:"transactions"`
		Operations   hal.Link `json:"operations"`
		Payments     hal.Link `json:"payments"`
		Effects      hal.Link `json:"effects"`
		Offers       hal.Link `json:"offers"`
		Trades       hal.Link `json:"trades"`
		Data         hal.Link `json:"data"`
	} `json:"_links"`

	ID                   string            `json:"id"`
	AccountID            string            `json:"account_id"`
	Sequence             string            `json:"sequence"`
	SubentryCount        int32             `json:"subentry_count"`
	InflationDestination string            `json:"inflation_destination,omitempty"`
	HomeDomain           string            `json:"home_domain,omitempty"`
	LastModifiedLedger   uint32            `json:"last_modified_ledger"`
	Thresholds           AccountThresholds `json:"thresholds"`
	Flags                AccountFlags      `json:"flags"`
	Balances             []Balance         `json:"balances"`
	Signers              []Signer          `json:"signers"`
	Data                 map[string]string `json:"data"`
}

// GetAccountID returns the Stellar account ID. This is to satisfy the
// Account interface of txnbuild.
func (a Account) GetAccountID() string {
	return a.AccountID
}

// GetNativeBalance returns the native balance of the account
func (a Account) GetNativeBalance() (string, error) {
	for _, balance := range a.Balances {
		if balance.Asset.Type == "native" {
			return balance.Balance, nil
		}
	}

	return "0", errors.New("account does not have a native balance")
}

// GetCreditBalance returns the balance for given code and issuer
func (a Account) GetCreditBalance(code string, issuer string) string {
	for _, balance := range a.Balances {
		if balance.Asset.Code == code && balance.Asset.Issuer == issuer {
			return balance.Balance
		}
	}

	return "0"
}

// GetSequenceNumber returns the sequence number of the account,
// and returns it as a 64-bit integer.
func (a Account) GetSequenceNumber() (xdr.SequenceNumber, error) {
	seqNum, err := strconv.ParseUint(a.Sequence, 10, 64)

	if err != nil {
		return 0, errors.Wrap(err, "Failed to parse account sequence number")
	}

	return xdr.SequenceNumber(seqNum), nil
}

// IncrementSequenceNumber increments the internal record of the account's sequence
// number by 1. This is typically used after a transaction build so that the next
// transaction to be built will be valid.
func (a *Account) IncrementSequenceNumber() (xdr.SequenceNumber, error) {
	seqNum, err := a.GetSequenceNumber()
	if err != nil {
		return xdr.SequenceNumber(0), err
	}
	seqNum++
	a.Sequence = strconv.FormatInt(int64(seqNum), 10)
	return a.GetSequenceNumber()
}

// MustGetData returns decoded value for a given key. If the key does
// not exist, empty slice will be returned. If there is an error
// decoding a value, it will panic.
func (a *Account) MustGetData(key string) []byte {
	bytes, err := a.GetData(key)
	if err != nil {
		panic(err)
	}
	return bytes
}

// GetData returns decoded value for a given key. If the key does
// not exist, empty slice will be returned.
func (a *Account) GetData(key string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(a.Data[key])
}

// AccountFlags represents the state of an account's flags
type AccountFlags struct {
	AuthRequired  bool `json:"auth_required"`
	AuthRevocable bool `json:"auth_revocable"`
	AuthImmutable bool `json:"auth_immutable"`
}

// AccountThresholds represents an accounts "thresholds", the numerical values
// needed to satisfy the authorization of a given operation.
type AccountThresholds struct {
	LowThreshold  byte `json:"low_threshold"`
	MedThreshold  byte `json:"med_threshold"`
	HighThreshold byte `json:"high_threshold"`
}

// Asset represents a single asset
type Asset base.Asset

// AssetStat represents the statistics for a single Asset
type AssetStat struct {
	Links struct {
		Toml hal.Link `json:"toml"`
	} `json:"_links"`

	base.Asset
	PT          string       `json:"paging_token"`
	Amount      string       `json:"amount"`
	NumAccounts int32        `json:"num_accounts"`
	Flags       AccountFlags `json:"flags"`
}

// PagingToken implementation for hal.Pageable
func (res AssetStat) PagingToken() string {
	return res.PT
}

// Balance represents an account's holdings for a single currency type
type Balance struct {
	Balance            string `json:"balance"`
	Limit              string `json:"limit,omitempty"`
	BuyingLiabilities  string `json:"buying_liabilities"`
	SellingLiabilities string `json:"selling_liabilities"`
	LastModifiedLedger uint32 `json:"last_modified_ledger,omitempty"`
	IsAuthorized       *bool  `json:"is_authorized,omitempty"`
	base.Asset
}

// Ledger represents a single closed ledger
type Ledger struct {
	Links struct {
		Self         hal.Link `json:"self"`
		Transactions hal.Link `json:"transactions"`
		Operations   hal.Link `json:"operations"`
		Payments     hal.Link `json:"payments"`
		Effects      hal.Link `json:"effects"`
	} `json:"_links"`
	ID                         string    `json:"id"`
	PT                         string    `json:"paging_token"`
	Hash                       string    `json:"hash"`
	PrevHash                   string    `json:"prev_hash,omitempty"`
	Sequence                   int32     `json:"sequence"`
	SuccessfulTransactionCount int32     `json:"successful_transaction_count"`
	FailedTransactionCount     *int32    `json:"failed_transaction_count"`
	OperationCount             int32     `json:"operation_count"`
	ClosedAt                   time.Time `json:"closed_at"`
	TotalCoins                 string    `json:"total_coins"`
	FeePool                    string    `json:"fee_pool"`
	BaseFee                    int32     `json:"base_fee_in_stroops"`
	BaseReserve                int32     `json:"base_reserve_in_stroops"`
	MaxTxSetSize               int32     `json:"max_tx_set_size"`
	ProtocolVersion            int32     `json:"protocol_version"`
	HeaderXDR                  string    `json:"header_xdr"`
}

func (l Ledger) PagingToken() string {
	return l.PT
}

// Offer is the display form of an offer to trade currency.
type Offer struct {
	Links struct {
		Self       hal.Link `json:"self"`
		OfferMaker hal.Link `json:"offer_maker"`
	} `json:"_links"`

	ID                 int64      `json:"id"`
	PT                 string     `json:"paging_token"`
	Seller             string     `json:"seller"`
	Selling            Asset      `json:"selling"`
	Buying             Asset      `json:"buying"`
	Amount             string     `json:"amount"`
	PriceR             Price      `json:"price_r"`
	Price              string     `json:"price"`
	LastModifiedLedger int32      `json:"last_modified_ledger"`
	LastModifiedTime   *time.Time `json:"last_modified_time"`
}

func (o Offer) PagingToken() string {
	return o.PT
}

// OrderBookSummary represents a snapshot summary of a given order book
type OrderBookSummary struct {
	Bids    []PriceLevel `json:"bids"`
	Asks    []PriceLevel `json:"asks"`
	Selling Asset        `json:"base"`
	Buying  Asset        `json:"counter"`
}

// Path represents a single payment path.
type Path struct {
	SourceAssetType        string  `json:"source_asset_type"`
	SourceAssetCode        string  `json:"source_asset_code,omitempty"`
	SourceAssetIssuer      string  `json:"source_asset_issuer,omitempty"`
	SourceAmount           string  `json:"source_amount"`
	DestinationAssetType   string  `json:"destination_asset_type"`
	DestinationAssetCode   string  `json:"destination_asset_code,omitempty"`
	DestinationAssetIssuer string  `json:"destination_asset_issuer,omitempty"`
	DestinationAmount      string  `json:"destination_amount"`
	Path                   []Asset `json:"path"`
}

// stub implementation to satisfy pageable interface
func (p Path) PagingToken() string {
	return ""
}

// Price represents a price
type Price base.Price

// PriceLevel represents an aggregation of offers that share a given price
type PriceLevel struct {
	PriceR Price  `json:"price_r"`
	Price  string `json:"price"`
	Amount string `json:"amount"`
}

// Root is the initial map of links into the api.
type Root struct {
	Links struct {
		Account             hal.Link  `json:"account"`
		AccountTransactions hal.Link  `json:"account_transactions"`
		Assets              hal.Link  `json:"assets"`
		Friendbot           *hal.Link `json:"friendbot,omitempty"`
		Metrics             hal.Link  `json:"metrics"`
		OrderBook           hal.Link  `json:"order_book"`
		Self                hal.Link  `json:"self"`
		Transaction         hal.Link  `json:"transaction"`
		Transactions        hal.Link  `json:"transactions"`
	} `json:"_links"`

	HorizonVersion               string `json:"horizon_version"`
	StellarCoreVersion           string `json:"core_version"`
	HorizonSequence              int32  `json:"history_latest_ledger"`
	HistoryElderSequence         int32  `json:"history_elder_ledger"`
	CoreSequence                 int32  `json:"core_latest_ledger"`
	NetworkPassphrase            string `json:"network_passphrase"`
	CurrentProtocolVersion       int32  `json:"current_protocol_version"`
	CoreSupportedProtocolVersion int32  `json:"core_supported_protocol_version"`
}

// Signer represents one of an account's signers.
type Signer struct {
	Weight int32  `json:"weight"`
	Key    string `json:"key"`
	Type   string `json:"type"`
}

// Trade represents a horizon digested trade
type Trade struct {
	Links struct {
		Self      hal.Link `json:"self"`
		Base      hal.Link `json:"base"`
		Counter   hal.Link `json:"counter"`
		Operation hal.Link `json:"operation"`
	} `json:"_links"`

	ID                 string    `json:"id"`
	PT                 string    `json:"paging_token"`
	LedgerCloseTime    time.Time `json:"ledger_close_time"`
	OfferID            string    `json:"offer_id"`
	BaseOfferID        string    `json:"base_offer_id"`
	BaseAccount        string    `json:"base_account"`
	BaseAmount         string    `json:"base_amount"`
	BaseAssetType      string    `json:"base_asset_type"`
	BaseAssetCode      string    `json:"base_asset_code,omitempty"`
	BaseAssetIssuer    string    `json:"base_asset_issuer,omitempty"`
	CounterOfferID     string    `json:"counter_offer_id"`
	CounterAccount     string    `json:"counter_account"`
	CounterAmount      string    `json:"counter_amount"`
	CounterAssetType   string    `json:"counter_asset_type"`
	CounterAssetCode   string    `json:"counter_asset_code,omitempty"`
	CounterAssetIssuer string    `json:"counter_asset_issuer,omitempty"`
	BaseIsSeller       bool      `json:"base_is_seller"`
	Price              *Price    `json:"price"`
}

// PagingToken implementation for hal.Pageable
func (res Trade) PagingToken() string {
	return res.PT
}

// TradeEffect represents a trade effect resource.  NOTE (scott, 2017-12-08):
// this resource is being added back in temporarily to deal with a deploy snafu.
// I didn't properly message the community that we were changing the response
// format, and so we're adding this back in to allow transition.
type TradeEffect struct {
	Links struct {
		Self      hal.Link `json:"self"`
		Seller    hal.Link `json:"seller"`
		Buyer     hal.Link `json:"buyer"`
		Operation hal.Link `json:"operation"`
	} `json:"_links"`

	ID                string    `json:"id"`
	PT                string    `json:"paging_token"`
	OfferID           string    `json:"offer_id"`
	Seller            string    `json:"seller"`
	SoldAmount        string    `json:"sold_amount"`
	SoldAssetType     string    `json:"sold_asset_type"`
	SoldAssetCode     string    `json:"sold_asset_code,omitempty"`
	SoldAssetIssuer   string    `json:"sold_asset_issuer,omitempty"`
	Buyer             string    `json:"buyer"`
	BoughtAmount      string    `json:"bought_amount"`
	BoughtAssetType   string    `json:"bought_asset_type"`
	BoughtAssetCode   string    `json:"bought_asset_code,omitempty"`
	BoughtAssetIssuer string    `json:"bought_asset_issuer,omitempty"`
	LedgerCloseTime   time.Time `json:"created_at"`
}

// TradeAggregation represents trade data aggregation over a period of time
type TradeAggregation struct {
	Timestamp     int64     `json:"timestamp"`
	TradeCount    int64     `json:"trade_count"`
	BaseVolume    string    `json:"base_volume"`
	CounterVolume string    `json:"counter_volume"`
	Average       string    `json:"avg"`
	High          string    `json:"high"`
	HighR         xdr.Price `json:"high_r"`
	Low           string    `json:"low"`
	LowR          xdr.Price `json:"low_r"`
	Open          string    `json:"open"`
	OpenR         xdr.Price `json:"open_r"`
	Close         string    `json:"close"`
	CloseR        xdr.Price `json:"close_r"`
}

// PagingToken implementation for hal.Pageable. Not actually used
func (res TradeAggregation) PagingToken() string {
	return string(res.Timestamp)
}

// Transaction represents a single, successful transaction
type Transaction struct {
	Links struct {
		Self       hal.Link `json:"self"`
		Account    hal.Link `json:"account"`
		Ledger     hal.Link `json:"ledger"`
		Operations hal.Link `json:"operations"`
		Effects    hal.Link `json:"effects"`
		Precedes   hal.Link `json:"precedes"`
		Succeeds   hal.Link `json:"succeeds"`
	} `json:"_links"`
	ID              string    `json:"id"`
	PT              string    `json:"paging_token"`
	Successful      bool      `json:"successful"`
	Hash            string    `json:"hash"`
	Ledger          int32     `json:"ledger"`
	LedgerCloseTime time.Time `json:"created_at"`
	Account         string    `json:"source_account"`
	AccountSequence string    `json:"source_account_sequence"`
	// Action needed in release: horizon-v0.19.0
	// Action needed in release: horizonclient-v2.0.0
	// Remove this field.
	FeePaid        int32    `json:"fee_paid"`
	FeeCharged     int32    `json:"fee_charged"`
	MaxFee         int32    `json:"max_fee"`
	OperationCount int32    `json:"operation_count"`
	EnvelopeXdr    string   `json:"envelope_xdr"`
	ResultXdr      string   `json:"result_xdr"`
	ResultMetaXdr  string   `json:"result_meta_xdr"`
	FeeMetaXdr     string   `json:"fee_meta_xdr"`
	MemoType       string   `json:"memo_type"`
	Memo           string   `json:"memo,omitempty"`
	Signatures     []string `json:"signatures"`
	ValidAfter     string   `json:"valid_after,omitempty"`
	ValidBefore    string   `json:"valid_before,omitempty"`
}

// MarshalJSON implements a custom marshaler for Transaction.
// The memo field should be omitted if and only if the
// memo_type is "none".
func (t Transaction) MarshalJSON() ([]byte, error) {
	type Alias Transaction
	v := &struct {
		Memo *string `json:"memo,omitempty"`
		*Alias
	}{
		Alias: (*Alias)(&t),
	}
	if t.MemoType != "none" {
		v.Memo = &t.Memo
	}
	return json.Marshal(v)
}

// PagingToken implementation for hal.Pageable
func (res Transaction) PagingToken() string {
	return res.PT
}

// TransactionResultCodes represent a summary of result codes returned from
// a single xdr TransactionResult
type TransactionResultCodes struct {
	TransactionCode string   `json:"transaction"`
	OperationCodes  []string `json:"operations,omitempty"`
}

// TransactionSuccess represents the result of a successful transaction
// submission.
type TransactionSuccess struct {
	Links struct {
		Transaction hal.Link `json:"transaction"`
	} `json:"_links"`
	Hash   string `json:"hash"`
	Ledger int32  `json:"ledger"`
	Env    string `json:"envelope_xdr"`
	Result string `json:"result_xdr"`
	Meta   string `json:"result_meta_xdr"`
}

// PrintTransactionSuccess prints the fields of a Horizon response.
func (resp TransactionSuccess) TransactionSuccessToString() (s string) {
	s += fmt.Sprintln("***TransactionSuccess dump***")
	s += fmt.Sprintln("    Links:", resp.Links)
	s += fmt.Sprintln("    Hash:", resp.Hash)
	s += fmt.Sprintln("    Ledger:", resp.Ledger)
	s += fmt.Sprintln("    Env:", resp.Env)
	s += fmt.Sprintln("    Result:", resp.Result)
	s += fmt.Sprintln("    Meta:", resp.Meta)

	return
}

// KeyTypeFromAddress converts the version byte of the provided strkey encoded
// value (for example an account id or a signer key) and returns the appropriate
// horizon-specific type name.
func KeyTypeFromAddress(address string) (string, error) {
	vb, err := strkey.Version(address)
	if err != nil {
		return "", errors.Wrap(err, "invalid address")
	}

	result, ok := KeyTypeNames[vb]
	if !ok {
		result = "unknown"
	}

	return result, nil
}

// MustKeyTypeFromAddress is the panicking variant of KeyTypeFromAddress.
func MustKeyTypeFromAddress(address string) string {
	ret, err := KeyTypeFromAddress(address)
	if err != nil {
		panic(err)
	}

	return ret
}

// AccountData represents a single data object stored on by an account
type AccountData struct {
	Value string `json:"value"`
}

// TradeAggregationsPage returns a list of aggregated trade records, aggregated by resolution
type TradeAggregationsPage struct {
	Links    hal.Links `json:"_links"`
	Embedded struct {
		Records []TradeAggregation `json:"records"`
	} `json:"_embedded"`
}

// TradesPage returns a list of trade records
type TradesPage struct {
	Links    hal.Links `json:"_links"`
	Embedded struct {
		Records []Trade `json:"records"`
	} `json:"_embedded"`
}

// OffersPage returns a list of offers
type OffersPage struct {
	Links    hal.Links `json:"_links"`
	Embedded struct {
		Records []Offer `json:"records"`
	} `json:"_embedded"`
}

// AssetsPage contains page of assets returned by Horizon.
type AssetsPage struct {
	Links    hal.Links `json:"_links"`
	Embedded struct {
		Records []AssetStat
	} `json:"_embedded"`
}

// LedgersPage contains page of ledger information returned by Horizon
type LedgersPage struct {
	Links    hal.Links `json:"_links"`
	Embedded struct {
		Records []Ledger
	} `json:"_embedded"`
}

// SingleMetric represents a metric with a single value
type SingleMetric struct {
	Value int `json:"value"`
}

// LogMetric represents metrics that are logged by horizon for each log level
type LogMetric struct {
	Rate15m  float64 `json:"15m.rate"`
	Rate1m   float64 `json:"1m.rate"`
	Rate5m   float64 `json:"5m.rate"`
	Count    int     `json:"count"`
	MeanRate float64 `json:"mean.rate"`
}

// LogTotalMetric represents total metrics logged for ingester, requests and submitted transactions
type LogTotalMetric struct {
	LogMetric
	Percent75   float64 `json:"75%"`
	Percent95   float64 `json:"95%"`
	Percent99   float64 `json:"99%"`
	Percent99_9 float64 `json:"99.9%"`
	Max         float64 `json:"max"`
	Mean        float64 `json:"mean"`
	Median      float64 `json:"median"`
	Min         float64 `json:"min"`
	StdDev      float64 `json:"stddev"`
}

// Metrics represents a response of metrics from horizon
type Metrics struct {
	Links                  hal.Links      `json:"_links"`
	GoRoutines             SingleMetric   `json:"goroutines"`
	HistoryElderLedger     SingleMetric   `json:"history.elder_ledger"`
	HistoryLatestLedger    SingleMetric   `json:"history.latest_ledger"`
	HistoryOpenConnections SingleMetric   `json:"history.open_connections"`
	IngesterIngestLedger   LogTotalMetric `json:"ingester.ingest_ledger"`
	IngesterClearLedger    LogTotalMetric `json:"ingester.clear_ledger"`
	LoggingDebug           LogMetric      `json:"logging.debug"`
	LoggingError           LogMetric      `json:"logging.error"`
	LoggingInfo            LogMetric      `json:"logging.info"`
	LoggingPanic           LogMetric      `json:"logging.panic"`
	LoggingWarning         LogMetric      `json:"logging.warning"`
	RequestsFailed         LogMetric      `json:"requests.failed"`
	RequestsSucceeded      LogMetric      `json:"requests.succeeded"`
	RequestsTotal          LogTotalMetric `json:"requests.total"`
	CoreLatestLedger       SingleMetric   `json:"stellar_core.latest_ledger"`
	CoreOpenConnections    SingleMetric   `json:"stellar_core.open_connections"`
	TxsubBuffered          SingleMetric   `json:"txsub.buffered"`
	TxsubFailed            LogMetric      `json:"txsub.failed"`
	TxsubOpen              SingleMetric   `json:"txsub.open"`
	TxsubSucceeded         LogMetric      `json:"txsub.succeeded"`
	TxsubTotal             LogTotalMetric `json:"txsub.total"`
}

// FeeStats represents a response of fees from horizon
// To do: implement fee suggestions if agreement is reached in https://github.com/stellar/go/issues/926
type FeeStats struct {
	LastLedger          int     `json:"last_ledger,string"`
	LastLedgerBaseFee   int     `json:"last_ledger_base_fee,string"`
	LedgerCapacityUsage float64 `json:"ledger_capacity_usage,string"`
	MinAcceptedFee      int     `json:"min_accepted_fee,string"`
	ModeAcceptedFee     int     `json:"mode_accepted_fee,string"`
	P10AcceptedFee      int     `json:"p10_accepted_fee,string"`
	P20AcceptedFee      int     `json:"p20_accepted_fee,string"`
	P30AcceptedFee      int     `json:"p30_accepted_fee,string"`
	P40AcceptedFee      int     `json:"p40_accepted_fee,string"`
	P50AcceptedFee      int     `json:"p50_accepted_fee,string"`
	P60AcceptedFee      int     `json:"p60_accepted_fee,string"`
	P70AcceptedFee      int     `json:"p70_accepted_fee,string"`
	P80AcceptedFee      int     `json:"p80_accepted_fee,string"`
	P90AcceptedFee      int     `json:"p90_accepted_fee,string"`
	P95AcceptedFee      int     `json:"p95_accepted_fee,string"`
	P99AcceptedFee      int     `json:"p99_accepted_fee,string"`
}

// TransactionsPage contains records of transaction information returned by Horizon
type TransactionsPage struct {
	Links    hal.Links `json:"_links"`
	Embedded struct {
		Records []Transaction
	} `json:"_embedded"`
}

// PathsPage contains records of payment paths found by horizon
type PathsPage struct {
	Links    hal.Links `json:"_links"`
	Embedded struct {
		Records []Path
	} `json:"_embedded"`
}
