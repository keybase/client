/*
Package horizonclient provides client access to a Horizon server, allowing an application to post transactions and look up ledger information.

This library provides an interface to the Stellar Horizon service. It supports the building of Go applications on
top of the Stellar network (https://www.stellar.org/). Transactions may be constructed using the sister package to
this one, txnbuild (https://github.com/stellar/go/tree/master/txnbuild), and then submitted with this client to any
Horizon instance for processing onto the ledger. Together, these two libraries provide a complete Stellar SDK.

For more information and further examples, see https://www.stellar.org/developers/go/reference/index.html.
*/
package horizonclient

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"sync"
	"time"

	hProtocol "github.com/stellar/go/protocols/horizon"
	"github.com/stellar/go/protocols/horizon/effects"
	"github.com/stellar/go/protocols/horizon/operations"
	"github.com/stellar/go/support/render/problem"
	"github.com/stellar/go/txnbuild"
)

// cursor represents `cursor` param in queries
type cursor string

// limit represents `limit` param in queries
type limit uint

// Order represents `order` param in queries
type Order string

// assetCode represets `asset_code` param in queries
type assetCode string

// assetIssuer represents `asset_issuer` param in queries
type assetIssuer string

// includeFailed represents `include_failed` param in queries
type includeFailed bool

// AssetType represents `asset_type` param in queries
type AssetType string

// join represents `join` param in queries
type join string

const (
	// OrderAsc represents an ascending order parameter
	OrderAsc Order = "asc"
	// OrderDesc represents an descending order parameter
	OrderDesc Order = "desc"
	// AssetType4 represents an asset type that is 4 characters long
	AssetType4 AssetType = "credit_alphanum4"
	// AssetType12 represents an asset type that is 12 characters long
	AssetType12 AssetType = "credit_alphanum12"
	// AssetTypeNative represents the asset type for Stellar Lumens (XLM)
	AssetTypeNative AssetType = "native"
)

// Error struct contains the problem returned by Horizon
type Error struct {
	Response *http.Response
	Problem  problem.P
}

var (
	// ErrResultCodesNotPopulated is the error returned from a call to
	// ResultCodes() against a `Problem` value that doesn't have the
	// "result_codes" extra field populated when it is expected to be.
	ErrResultCodesNotPopulated = errors.New("result_codes not populated")

	// ErrEnvelopeNotPopulated is the error returned from a call to
	// Envelope() against a `Problem` value that doesn't have the
	// "envelope_xdr" extra field populated when it is expected to be.
	ErrEnvelopeNotPopulated = errors.New("envelope_xdr not populated")

	// ErrResultNotPopulated is the error returned from a call to
	// Result() against a `Problem` value that doesn't have the
	// "result_xdr" extra field populated when it is expected to be.
	ErrResultNotPopulated = errors.New("result_xdr not populated")

	// HorizonTimeOut is the default number of seconds before a request to horizon times out.
	HorizonTimeOut = time.Duration(60)

	// MinuteResolution represents 1 minute used as `resolution` parameter in trade aggregation
	MinuteResolution = time.Duration(1 * time.Minute)

	// FiveMinuteResolution represents 5 minutes used as `resolution` parameter in trade aggregation
	FiveMinuteResolution = time.Duration(5 * time.Minute)

	// FifteenMinuteResolution represents 15 minutes used as `resolution` parameter in trade aggregation
	FifteenMinuteResolution = time.Duration(15 * time.Minute)

	// HourResolution represents 1 hour used as `resolution` parameter in trade aggregation
	HourResolution = time.Duration(1 * time.Hour)

	// DayResolution represents 1 day used as `resolution` parameter in trade aggregation
	DayResolution = time.Duration(24 * time.Hour)

	// WeekResolution represents 1 week used as `resolution` parameter in trade aggregation
	WeekResolution = time.Duration(168 * time.Hour)
)

// HTTP represents the HTTP client that a horizon client uses to communicate
type HTTP interface {
	Do(req *http.Request) (resp *http.Response, err error)
	Get(url string) (resp *http.Response, err error)
	PostForm(url string, data url.Values) (resp *http.Response, err error)
}

// UniversalTimeHandler is a function that is called to return the UTC unix time in seconds.
// This handler is used when getting the time from a horizon server, which can be used to calculate
// transaction timebounds.
type UniversalTimeHandler func() int64

// Client struct contains data for creating a horizon client that connects to the stellar network.
type Client struct {
	// URL of Horizon server to connect
	HorizonURL string

	// HTTP client to make requests with
	HTTP HTTP

	// AppName is the name of the application using the horizonclient package
	AppName string

	// AppVersion is the version of the application using the horizonclient package
	AppVersion     string
	horizonTimeOut time.Duration
	isTestNet      bool

	// currentUniversalTime is a function that returns the current UTC unix time in seconds.
	currentUniversalTime UniversalTimeHandler
}

// ClientInterface contains methods implemented by the horizon client
type ClientInterface interface {
	AccountDetail(request AccountRequest) (hProtocol.Account, error)
	AccountData(request AccountRequest) (hProtocol.AccountData, error)
	Effects(request EffectRequest) (effects.EffectsPage, error)
	Assets(request AssetRequest) (hProtocol.AssetsPage, error)
	Ledgers(request LedgerRequest) (hProtocol.LedgersPage, error)
	LedgerDetail(sequence uint32) (hProtocol.Ledger, error)
	Metrics() (hProtocol.Metrics, error)
	FeeStats() (hProtocol.FeeStats, error)
	Offers(request OfferRequest) (hProtocol.OffersPage, error)
	Operations(request OperationRequest) (operations.OperationsPage, error)
	OperationDetail(id string) (operations.Operation, error)
	SubmitTransactionXDR(transactionXdr string) (hProtocol.TransactionSuccess, error)
	SubmitTransaction(transactionXdr txnbuild.Transaction) (hProtocol.TransactionSuccess, error)
	Transactions(request TransactionRequest) (hProtocol.TransactionsPage, error)
	TransactionDetail(txHash string) (hProtocol.Transaction, error)
	OrderBook(request OrderBookRequest) (hProtocol.OrderBookSummary, error)
	Paths(request PathsRequest) (hProtocol.PathsPage, error)
	Payments(request OperationRequest) (operations.OperationsPage, error)
	TradeAggregations(request TradeAggregationRequest) (hProtocol.TradeAggregationsPage, error)
	Trades(request TradeRequest) (hProtocol.TradesPage, error)
	Fund(addr string) (hProtocol.TransactionSuccess, error)
	StreamTransactions(ctx context.Context, request TransactionRequest, handler TransactionHandler) error
	StreamTrades(ctx context.Context, request TradeRequest, handler TradeHandler) error
	StreamEffects(ctx context.Context, request EffectRequest, handler EffectHandler) error
	StreamOperations(ctx context.Context, request OperationRequest, handler OperationHandler) error
	StreamPayments(ctx context.Context, request OperationRequest, handler OperationHandler) error
	StreamOffers(ctx context.Context, request OfferRequest, handler OfferHandler) error
	StreamLedgers(ctx context.Context, request LedgerRequest, handler LedgerHandler) error
	StreamOrderBooks(ctx context.Context, request OrderBookRequest, handler OrderBookHandler) error
	Root() (hProtocol.Root, error)
	NextAssetsPage(hProtocol.AssetsPage) (hProtocol.AssetsPage, error)
	PrevAssetsPage(hProtocol.AssetsPage) (hProtocol.AssetsPage, error)
	NextLedgersPage(hProtocol.LedgersPage) (hProtocol.LedgersPage, error)
	PrevLedgersPage(hProtocol.LedgersPage) (hProtocol.LedgersPage, error)
	NextEffectsPage(effects.EffectsPage) (effects.EffectsPage, error)
	PrevEffectsPage(effects.EffectsPage) (effects.EffectsPage, error)
	NextTransactionsPage(hProtocol.TransactionsPage) (hProtocol.TransactionsPage, error)
	PrevTransactionsPage(hProtocol.TransactionsPage) (hProtocol.TransactionsPage, error)
	NextOperationsPage(operations.OperationsPage) (operations.OperationsPage, error)
	PrevOperationsPage(operations.OperationsPage) (operations.OperationsPage, error)
	NextPaymentsPage(operations.OperationsPage) (operations.OperationsPage, error)
	PrevPaymentsPage(operations.OperationsPage) (operations.OperationsPage, error)
	NextOffersPage(hProtocol.OffersPage) (hProtocol.OffersPage, error)
	PrevOffersPage(hProtocol.OffersPage) (hProtocol.OffersPage, error)
	NextTradesPage(hProtocol.TradesPage) (hProtocol.TradesPage, error)
	PrevTradesPage(hProtocol.TradesPage) (hProtocol.TradesPage, error)
	HomeDomainForAccount(aid string) (string, error)
	NextTradeAggregationsPage(hProtocol.TradeAggregationsPage) (hProtocol.TradeAggregationsPage, error)
	PrevTradeAggregationsPage(hProtocol.TradeAggregationsPage) (hProtocol.TradeAggregationsPage, error)
}

// DefaultTestNetClient is a default client to connect to test network.
var DefaultTestNetClient = &Client{
	HorizonURL:           "https://horizon-testnet.stellar.org/",
	HTTP:                 http.DefaultClient,
	horizonTimeOut:       HorizonTimeOut,
	isTestNet:            true,
	currentUniversalTime: universalTimeFunc,
}

// DefaultPublicNetClient is a default client to connect to public network.
var DefaultPublicNetClient = &Client{
	HorizonURL:           "https://horizon.stellar.org/",
	HTTP:                 http.DefaultClient,
	horizonTimeOut:       HorizonTimeOut,
	currentUniversalTime: universalTimeFunc,
}

// HorizonRequest contains methods implemented by request structs for horizon endpoints.
type HorizonRequest interface {
	BuildURL() (string, error)
}

// AccountRequest struct contains data for making requests to the accounts endpoint of a horizon server.
// "AccountID" and "DataKey" fields should both be set when retrieving AccountData.
// When getting the AccountDetail, only "AccountID" needs to be set.
type AccountRequest struct {
	AccountID string
	DataKey   string
}

// EffectRequest struct contains data for getting effects from a horizon server.
// "ForAccount", "ForLedger", "ForOperation" and "ForTransaction": Not more than one of these
//  can be set at a time. If none are set, the default is to return all effects.
// The query parameters (Order, Cursor and Limit) are optional. All or none can be set.
type EffectRequest struct {
	ForAccount     string
	ForLedger      string
	ForOperation   string
	ForTransaction string
	Order          Order
	Cursor         string
	Limit          uint
}

// AssetRequest struct contains data for getting asset details from a horizon server.
// If "ForAssetCode" and "ForAssetIssuer" are not set, it returns all assets.
// The query parameters (Order, Cursor and Limit) are optional. All or none can be set.
type AssetRequest struct {
	ForAssetCode   string
	ForAssetIssuer string
	Order          Order
	Cursor         string
	Limit          uint
}

// LedgerRequest struct contains data for getting ledger details from a horizon server.
// The query parameters (Order, Cursor and Limit) are optional. All or none can be set.
type LedgerRequest struct {
	Order       Order
	Cursor      string
	Limit       uint
	forSequence uint32
}

type metricsRequest struct {
	endpoint string
}

type feeStatsRequest struct {
	endpoint string
}

// OfferRequest struct contains data for getting offers made by an account from a horizon server.
// "ForAccount" is required.
// The query parameters (Order, Cursor and Limit) are optional. All or none can be set.
type OfferRequest struct {
	ForAccount string
	Order      Order
	Cursor     string
	Limit      uint
}

// OperationRequest struct contains data for getting operation details from a horizon server.
// "ForAccount", "ForLedger", "ForTransaction": Only one of these can be set at a time. If none
// are provided, the default is to return all operations.
// The query parameters (Order, Cursor, Limit and IncludeFailed) are optional. All or none can be set.
type OperationRequest struct {
	ForAccount     string
	ForLedger      uint
	ForTransaction string
	forOperationID string
	Order          Order
	Cursor         string
	Limit          uint
	IncludeFailed  bool
	Join           string
	endpoint       string
}

type submitRequest struct {
	endpoint       string
	transactionXdr string
}

// TransactionRequest struct contains data for getting transaction details from a horizon server.
// "ForAccount", "ForLedger": Only one of these can be set at a time. If none are provided, the
// default is to return all transactions.
// The query parameters (Order, Cursor, Limit and IncludeFailed) are optional. All or none can be set.
type TransactionRequest struct {
	ForAccount         string
	ForLedger          uint
	forTransactionHash string
	Order              Order
	Cursor             string
	Limit              uint
	IncludeFailed      bool
}

// OrderBookRequest struct contains data for getting the orderbook for an asset pair from a horizon server.
// Limit is optional. All other parameters are required.
type OrderBookRequest struct {
	SellingAssetType   AssetType
	SellingAssetCode   string
	SellingAssetIssuer string
	BuyingAssetType    AssetType
	BuyingAssetCode    string
	BuyingAssetIssuer  string
	Limit              uint
}

// PathsRequest struct contains data for getting available payment paths from a horizon server.
// All parameters are required.
type PathsRequest struct {
	DestinationAccount     string
	DestinationAssetType   AssetType
	DestinationAssetCode   string
	DestinationAssetIssuer string
	DestinationAmount      string
	SourceAccount          string
}

// TradeRequest struct contains data for getting trade details from a horizon server.
// "ForAccount", "ForOfferID": Only one of these can be set at a time. If none are provided, the
// default is to return all trades.
// All other query parameters are optional. All or none can be set.
type TradeRequest struct {
	ForOfferID         string
	ForAccount         string
	BaseAssetType      AssetType
	BaseAssetCode      string
	BaseAssetIssuer    string
	CounterAssetType   AssetType
	CounterAssetCode   string
	CounterAssetIssuer string
	Order              Order
	Cursor             string
	Limit              uint
}

// TradeAggregationRequest struct contains data for getting trade aggregations from a horizon server.
// The query parameters (Order and Limit) are optional. All or none can be set.
// All other parameters are required.
type TradeAggregationRequest struct {
	StartTime          time.Time
	EndTime            time.Time
	Resolution         time.Duration
	Offset             time.Duration
	BaseAssetType      AssetType
	BaseAssetCode      string
	BaseAssetIssuer    string
	CounterAssetType   AssetType
	CounterAssetCode   string
	CounterAssetIssuer string
	Order              Order
	Limit              uint
}

// ServerTimeRecord contains data for the current unix time of a horizon server instance, and the local time when it was recorded.
type ServerTimeRecord struct {
	ServerTime        int64
	LocalTimeRecorded int64
}

// ServerTimeMap holds the ServerTimeRecord for different horizon instances.
var ServerTimeMap = make(map[string]ServerTimeRecord)
var serverTimeMapMutex = &sync.Mutex{}
