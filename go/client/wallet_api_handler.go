package client

import (
	"encoding/hex"
	"errors"
	"io"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/keybase/stellarnet"
	"github.com/stellar/go/strkey"
	"golang.org/x/net/context"
)

// ErrInvalidAccountID is for invalid account IDs.
var ErrInvalidAccountID = errors.New("invalid stellar account ID")

// ErrInvalidTxID is for invalid transaction IDs.
var ErrInvalidTxID = errors.New("invalid stellar transaction ID")

// ErrNameMissing is for missing name options.
var ErrNameMissing = errors.New("'name' option is required")

// ErrDestinationMissing is for missing destination options.
var ErrDestinationMissing = errors.New("'destination' option is required")

// ErrRecipientMissing is for missing recipient options.
var ErrRecipientMissing = errors.New("'recipient' option is required")

// ErrAmountMissing is for missing amount options.
var ErrAmountMissing = errors.New("'amount' option is required")

// ErrMessageTooLong is for lengthy payment messages.
var ErrMessageTooLong = errors.New("message is too long")

// walletAPIHandler is a type that can handle all the json api
// methods for the wallet API.
type walletAPIHandler struct {
	libkb.Contextified
	cli    stellar1.LocalClient
	indent bool
}

// newWalletAPIHandler makes a walletAPIHandler.
func newWalletAPIHandler(g *libkb.GlobalContext, indentOutput bool) *walletAPIHandler {
	return &walletAPIHandler{Contextified: libkb.NewContextified(g), indent: indentOutput}
}

// handle processes the Call based on the version.
func (w *walletAPIHandler) handle(ctx context.Context, c Call, wr io.Writer) error {
	switch c.Params.Version {
	case 0, 1:
		return w.handleV1(ctx, c, wr)
	default:
		return ErrInvalidVersion{version: c.Params.Version}
	}
}

// list of all supported methods:
const (
	balancesMethod     = "balances"
	cancelMethod       = "cancel"
	detailsMethod      = "details"
	getInflationMethod = "get-inflation"
	historyMethod      = "history"
	initializeMethod   = "setup-wallet"
	lookupMethod       = "lookup"
	sendMethod         = "send"
	setInflationMethod = "set-inflation"
)

// validWalletMethodsV1 is a map of the valid V1 methods for quick lookup.
var validWalletMethodsV1 = map[string]bool{
	balancesMethod:     true,
	cancelMethod:       true,
	detailsMethod:      true,
	getInflationMethod: true,
	historyMethod:      true,
	initializeMethod:   true,
	lookupMethod:       true,
	sendMethod:         true,
	setInflationMethod: true,
}

// handleV1 processes Call for version 1 of the wallet JSON API.
func (w *walletAPIHandler) handleV1(ctx context.Context, c Call, wr io.Writer) error {
	if !validWalletMethodsV1[c.Method] {
		return ErrInvalidMethod{name: c.Method, version: 1}
	}

	cli, err := GetWalletClient(w.G())
	if err != nil {
		return err
	}
	w.cli = cli

	switch c.Method {
	case balancesMethod:
		return w.balances(ctx, c, wr)
	case cancelMethod:
		return w.cancelPayment(ctx, c, wr)
	case detailsMethod:
		return w.details(ctx, c, wr)
	case getInflationMethod:
		return w.getInflation(ctx, c, wr)
	case historyMethod:
		return w.history(ctx, c, wr)
	case initializeMethod:
		return w.initializeWallet(ctx, c, wr)
	case lookupMethod:
		return w.lookup(ctx, c, wr)
	case sendMethod:
		return w.send(ctx, c, wr)
	case setInflationMethod:
		return w.setInflation(ctx, c, wr)
	default:
		return ErrInvalidMethod{name: c.Method, version: 1}
	}
}

// balances returns the account balances for all accounts owned by the current user.
func (w *walletAPIHandler) balances(ctx context.Context, c Call, wr io.Writer) error {
	accounts, err := w.cli.WalletGetAccountsCLILocal(ctx)
	if err != nil {
		return w.encodeErr(c, err, wr)
	}
	return w.encodeResult(c, accounts, wr)
}

// cancelPayment cancels a pending relay payment and yanks back the funds.
func (w *walletAPIHandler) cancelPayment(ctx context.Context, c Call, wr io.Writer) error {
	var opts txIDOptions
	if err := unmarshalOptions(c, &opts); err != nil {
		return w.encodeErr(c, err, wr)
	}
	result, err := w.cli.ClaimCLILocal(ctx, stellar1.ClaimCLILocalArg{TxID: opts.TxID})
	if err != nil {
		return w.encodeErr(c, err, wr)
	}
	return w.encodeResult(c, result, wr)
}

// details outputs details for a single transaction.
func (w *walletAPIHandler) details(ctx context.Context, c Call, wr io.Writer) error {
	var opts txIDOptions
	if err := unmarshalOptions(c, &opts); err != nil {
		return w.encodeErr(c, err, wr)
	}
	detail, err := w.cli.PaymentDetailCLILocal(ctx, opts.TxID)
	if err != nil {
		return w.encodeErr(c, err, wr)
	}
	return w.encodeResult(c, detail, wr)
}

// getInflation gets the inflation destination for an account.
func (w *walletAPIHandler) getInflation(ctx context.Context, c Call, wr io.Writer) error {
	var opts accountIDOptions
	if err := unmarshalOptions(c, &opts); err != nil {
		return w.encodeErr(c, err, wr)
	}

	inflation, err := w.getInflationLocal(ctx, opts.Convert())
	if err != nil {
		return w.encodeErr(c, err, wr)
	}

	return w.encodeResult(c, inflation, wr)
}

// history outputs recent payment history for the specified account ID.
func (w *walletAPIHandler) history(ctx context.Context, c Call, wr io.Writer) error {
	var opts accountIDOptions
	if err := unmarshalOptions(c, &opts); err != nil {
		return w.encodeErr(c, err, wr)
	}
	a := opts.Convert()
	payments, err := w.cli.RecentPaymentsCLILocal(ctx, &a)
	if err != nil {
		return w.encodeErr(c, err, wr)
	}
	return w.encodeResult(c, payments, wr)
}

// initializeWallet creates the initial wallet for an account
// (by "accepting" the disclaimer).
func (w *walletAPIHandler) initializeWallet(ctx context.Context, c Call, wr io.Writer) error {
	if err := w.cli.AcceptDisclaimerLocal(ctx, 0); err != nil {
		return w.encodeErr(c, err, wr)
	}
	result := map[string]string{"disclaimer": disclaimerText}
	return w.encodeResult(c, result, wr)
}

// lookup outputs an account ID for a keybase username or federation address.
func (w *walletAPIHandler) lookup(ctx context.Context, c Call, wr io.Writer) error {
	var opts nameOptions
	if err := unmarshalOptions(c, &opts); err != nil {
		return w.encodeErr(c, err, wr)
	}
	if err := w.registerIdentifyUI(); err != nil {
		return w.encodeErr(c, err, wr)
	}

	result, err := w.cli.LookupCLILocal(ctx, opts.Name)
	if err != nil {
		return w.encodeErr(c, err, wr)
	}
	return w.encodeResult(c, result, wr)
}

// send sends XLM to an account.
func (w *walletAPIHandler) send(ctx context.Context, c Call, wr io.Writer) error {
	var opts sendOptions
	if err := unmarshalOptions(c, &opts); err != nil {
		return w.encodeErr(c, err, wr)
	}

	if err := w.registerIdentifyUI(); err != nil {
		return w.encodeErr(c, err, wr)
	}

	// convert the amount if necessary
	amount := opts.Amount
	var displayAmount, displayCurrency string
	if opts.Currency != "" && strings.ToUpper(opts.Currency) != "XLM" {
		exchangeRate, err := w.cli.ExchangeRateLocal(ctx, stellar1.OutsideCurrencyCode(opts.Currency))
		if err != nil {
			return w.encodeErr(c, err, wr)
		}

		amount, err = stellarnet.ConvertOutsideToXLM(opts.Amount, exchangeRate.Rate)
		if err != nil {
			return w.encodeErr(c, err, wr)
		}

		displayAmount = opts.Amount
		displayCurrency = opts.Currency
	}

	arg := stellar1.SendCLILocalArg{
		Recipient:       opts.Recipient,
		Amount:          amount,
		Asset:           stellar1.AssetNative(),
		Note:            opts.Message,
		DisplayAmount:   displayAmount,
		DisplayCurrency: displayCurrency,
		FromAccountID:   stellar1.AccountID(opts.FromAccountID),
	}
	result, err := w.cli.SendCLILocal(ctx, arg)
	if err != nil {
		return w.encodeErr(c, err, wr)
	}

	detail, err := w.cli.PaymentDetailCLILocal(ctx, string(result.TxID))
	if err != nil {
		return w.encodeErr(c, err, wr)
	}
	return w.encodeResult(c, detail, wr)
}

// setInflation sets the inflation destination for an account.
func (w *walletAPIHandler) setInflation(ctx context.Context, c Call, wr io.Writer) error {
	var opts inflationOptions
	if err := unmarshalOptions(c, &opts); err != nil {
		return w.encodeErr(c, err, wr)
	}

	arg := stellar1.SetInflationDestinationLocalArg{
		AccountID:   opts.AccountIDConvert(),
		Destination: opts.DestinationConvert(),
	}
	if err := w.cli.SetInflationDestinationLocal(ctx, arg); err != nil {
		return w.encodeErr(c, err, wr)
	}

	// get it for display
	inflation, err := w.getInflationLocal(ctx, opts.AccountIDConvert())
	if err != nil {
		return w.encodeErr(c, err, wr)
	}

	return w.encodeResult(c, inflation, wr)
}

// encodeResult JSON encodes a successful result to the wr writer.
func (w *walletAPIHandler) encodeResult(call Call, result interface{}, wr io.Writer) error {
	return encodeResult(call, result, wr, w.indent)
}

// encodeErr JSON encodes an error.
func (w *walletAPIHandler) encodeErr(call Call, err error, wr io.Writer) error {
	return encodeErr(call, err, wr, w.indent)
}

func (w *walletAPIHandler) getInflationLocal(ctx context.Context, accountID stellar1.AccountID) (stellar1.InflationDestinationResultLocal, error) {
	arg := stellar1.GetInflationDestinationLocalArg{
		AccountID: accountID,
	}
	inflation, err := w.cli.GetInflationDestinationLocal(ctx, arg)
	if err != nil {
		return stellar1.InflationDestinationResultLocal{}, err
	}
	if inflation.Destination == nil {
		var empty stellar1.AccountID
		inflation.Destination = &empty
		inflation.Comment = "no inflation destination set"
	}
	return inflation, nil
}

func (w *walletAPIHandler) registerIdentifyUI() error {
	protocols := []rpc.Protocol{
		NewNullIdentifyUIProtocol(),
	}

	return RegisterProtocolsWithContext(protocols, w.G())
}

// accountIDOptions is for a command where an account-id is required.
type accountIDOptions struct {
	AccountID string `json:"account-id"`
}

// Check makes sure that AccountID exists and is valid.
func (c *accountIDOptions) Check() error {
	_, err := strkey.Decode(strkey.VersionByteAccountID, c.AccountID)
	if err != nil {
		return ErrInvalidAccountID
	}
	return nil
}

func (c *accountIDOptions) Convert() stellar1.AccountID {
	return stellar1.AccountID(c.AccountID)
}

// txIDOptions is for a command where a txid is required.
type txIDOptions struct {
	TxID string `json:"txid"`
}

// Check makes sure that TxID exists and is valid.
func (c *txIDOptions) Check() error {
	if len(c.TxID) != 64 {
		return ErrInvalidTxID
	}
	if _, err := hex.DecodeString(c.TxID); err != nil {
		return ErrInvalidTxID
	}
	return nil
}

// nameOptions is for a command where a name is required.
type nameOptions struct {
	Name string `json:"name"`
}

// Check makes sure that name exists.
func (c *nameOptions) Check() error {
	if c.Name == "" {
		return ErrNameMissing
	}
	return nil
}

// inflationOptions are the options for the set-inflation command.
type inflationOptions struct {
	AccountID   string `json:"account-id"`
	Destination string `json:"destination"`
}

// Check makes sure that AccountID is valid and that Destination isn't empty.
func (c *inflationOptions) Check() error {
	_, err := strkey.Decode(strkey.VersionByteAccountID, c.AccountID)
	if err != nil {
		return ErrInvalidAccountID
	}
	if c.Destination == "" {
		return ErrDestinationMissing
	}

	return nil
}

// AccountIDConvert converts the AccountID string into a stellar1.AccountID.
func (c *inflationOptions) AccountIDConvert() stellar1.AccountID {
	return stellar1.AccountID(c.AccountID)
}

// DestinationConvert converts the Destination string into a stellar1.InflationDestination.
func (c *inflationOptions) DestinationConvert() stellar1.InflationDestination {
	switch c.Destination {
	case "self":
		return stellar1.NewInflationDestinationWithSelf()
	case "lumenaut":
		return stellar1.NewInflationDestinationWithLumenaut()
	default:
		return stellar1.NewInflationDestinationWithAccountid(stellar1.AccountID(c.Destination))
	}
}

// sendOptions are the options for the send payment method.
type sendOptions struct {
	Recipient     string `json:"recipient"`
	Amount        string `json:"amount"`
	Currency      string `json:"currency"`
	Message       string `json:"message"`
	FromAccountID string `json:"from-account-id"`
}

// Check makes sure that the send options are valid.
func (c *sendOptions) Check() error {
	if strings.TrimSpace(c.Recipient) == "" {
		return ErrRecipientMissing
	}
	if strings.TrimSpace(c.Amount) == "" {
		return ErrAmountMissing
	}
	if c.FromAccountID != "" {
		_, err := strkey.Decode(strkey.VersionByteAccountID, c.FromAccountID)
		if err != nil {
			return ErrInvalidAccountID
		}
	}
	if len(c.Message) > 400 {
		return ErrMessageTooLong
	}

	return nil
}
