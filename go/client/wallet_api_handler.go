package client

import (
	"encoding/hex"
	"errors"
	"fmt"
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

// ErrInvalidAmount is for invalid payment amounts.
var ErrInvalidAmount = errors.New("invalid amount")

// ErrInvalidSourceMax is for invalid source asset maximum amounts
var ErrInvalidSourceMax = errors.New("invalid source asset maximum amount")

// ErrInvalidSourceMax is for when a payment path would exceed the source asset maximum
var ErrPathMaxExceeded = errors.New("payment path could exceed source asset limit")

// ErrMemoTextTooLong is for lengthy memos.
var ErrMemoTextTooLong = errors.New("memo text is too long (max 28 characters)")

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
	batchMethod        = "batch"
	cancelMethod       = "cancel"
	detailsMethod      = "details"
	getInflationMethod = "get-inflation"
	historyMethod      = "history"
	initializeMethod   = "setup-wallet"
	lookupMethod       = "lookup"
	sendMethod         = "send"
	setInflationMethod = "set-inflation"
	findPaymentPath    = "find-payment-path"
	sendPathPayment    = "send-path-payment"
)

// validWalletMethodsV1 is a map of the valid V1 methods for quick lookup.
var validWalletMethodsV1 = map[string]bool{
	balancesMethod:     true,
	batchMethod:        true,
	cancelMethod:       true,
	detailsMethod:      true,
	getInflationMethod: true,
	historyMethod:      true,
	initializeMethod:   true,
	lookupMethod:       true,
	sendMethod:         true,
	setInflationMethod: true,
	findPaymentPath:    true,
	sendPathPayment:    true,
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
	case batchMethod:
		return w.batch(ctx, c, wr)
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
	case findPaymentPath:
		return w.findPaymentPath(ctx, c, wr)
	case sendPathPayment:
		return w.sendPathPayment(ctx, c, wr)
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

// batch submits a batch of payments as fast as it can.
func (w *walletAPIHandler) batch(ctx context.Context, c Call, wr io.Writer) error {
	var opts batchOptions
	if err := unmarshalOptions(c, &opts); err != nil {
		return w.encodeErr(c, err, wr)
	}

	arg := stellar1.BatchLocalArg{
		BatchID:     opts.BatchID,
		TimeoutSecs: opts.Timeout,
		UseMulti:    false,
	}
	for _, p := range opts.Payments {
		arg.Payments = append(arg.Payments, stellar1.BatchPaymentArg{Recipient: p.Recipient, Amount: p.Amount, Message: p.Message})
	}

	result, err := w.cli.BatchLocal(ctx, arg)
	if err != nil {
		return w.encodeErr(c, err, wr)
	}

	return w.encodeResult(c, result, wr)
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
		PublicNote:      opts.MemoText,
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

	destination, err := getInflationDestinationAddrFromString(w.cli, opts.AccountIDConvert(), opts.Destination)
	if err != nil {
		return w.encodeErr(c, err, wr)
	}

	arg := stellar1.SetInflationDestinationLocalArg{
		AccountID:   opts.AccountIDConvert(),
		Destination: destination,
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

func (w *walletAPIHandler) findPaymentPath(ctx context.Context, c Call, wr io.Writer) error {
	var opts findPaymentPathOptions
	if err := unmarshalOptions(c, &opts); err != nil {
		return w.encodeErr(c, err, wr)
	}

	sourceAsset, err := parseAssetString(opts.SourceAsset)
	if err != nil {
		return w.encodeErr(c, err, wr)
	}
	destinationAsset, err := parseAssetString(opts.DestinationAsset)
	if err != nil {
		return w.encodeErr(c, err, wr)
	}
	from := stellar1.AccountID(opts.FromAccountID)

	if err := w.registerIdentifyUI(); err != nil {
		return w.encodeErr(c, err, wr)
	}

	findArg := stellar1.FindPaymentPathLocalArg{
		From:             from,
		To:               opts.Recipient,
		SourceAsset:      sourceAsset,
		DestinationAsset: destinationAsset,
		Amount:           opts.Amount,
	}
	path, err := w.cli.FindPaymentPathLocal(ctx, findArg)
	if err != nil {
		return w.encodeErr(c, err, wr)
	}
	return w.encodeResult(c, path.FullPath, wr)
}

func (w *walletAPIHandler) sendPathPayment(ctx context.Context, c Call, wr io.Writer) error {
	var opts sendPathPaymentOptions
	if err := unmarshalOptions(c, &opts); err != nil {
		return w.encodeErr(c, err, wr)
	}

	sourceAsset, err := parseAssetString(opts.SourceAsset)
	if err != nil {
		return w.encodeErr(c, err, wr)
	}
	destinationAsset, err := parseAssetString(opts.DestinationAsset)
	if err != nil {
		return w.encodeErr(c, err, wr)
	}
	from := stellar1.AccountID(opts.FromAccountID)

	if err := w.registerIdentifyUI(); err != nil {
		return w.encodeErr(c, err, wr)
	}

	findArg := stellar1.FindPaymentPathLocalArg{
		From:             from,
		To:               opts.Recipient,
		SourceAsset:      sourceAsset,
		DestinationAsset: destinationAsset,
		Amount:           opts.Amount,
	}
	path, err := w.cli.FindPaymentPathLocal(ctx, findArg)
	if err != nil {
		return w.encodeErr(c, err, wr)
	}

	if path.FullPath.SourceAmountMax > opts.SourceMaxAmount {
		return w.encodeErr(c, ErrPathMaxExceeded, wr)
	}

	sendArg := stellar1.SendPathCLILocalArg{
		Source:     from,
		Recipient:  opts.Recipient,
		Path:       path.FullPath,
		Note:       opts.Message,
		PublicNote: opts.MemoText,
	}
	res, err := w.cli.SendPathCLILocal(ctx, sendArg)
	if err != nil {
		return w.encodeErr(c, err, wr)
	}

	detail, err := w.cli.PaymentDetailCLILocal(ctx, string(res.TxID))
	if err != nil {
		return w.encodeErr(c, err, wr)
	}
	return w.encodeResult(c, detail, wr)
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

// sendOptions are the options for the send payment method.
type sendOptions struct {
	Recipient     string `json:"recipient"`
	Amount        string `json:"amount"`
	Currency      string `json:"currency"`
	Message       string `json:"message"`
	FromAccountID string `json:"from-account-id"`
	MemoText      string `json:"memo-text"`
}

// Check makes sure that the send options are valid.
func (c *sendOptions) Check() error {
	if strings.TrimSpace(c.Recipient) == "" {
		return ErrRecipientMissing
	}
	if strings.TrimSpace(c.Amount) == "" {
		return ErrAmountMissing
	}
	namt, err := stellarnet.ParseStellarAmount(c.Amount)
	if err != nil {
		return ErrInvalidAmount
	}
	if namt < 0 {
		return ErrInvalidAmount
	}

	if c.FromAccountID != "" {
		_, err := strkey.Decode(strkey.VersionByteAccountID, c.FromAccountID)
		if err != nil {
			return ErrInvalidAccountID
		}
	}
	if len(c.Message) > libkb.MaxStellarPaymentNoteLength {
		return ErrMessageTooLong
	}
	if len(c.MemoText) > libkb.MaxStellarPaymentPublicNoteLength {
		return ErrMemoTextTooLong
	}

	return nil
}

type batchPayment struct {
	Recipient string `json:"recipient"`
	Amount    string `json:"amount"`
	Message   string `json:"message"`
}

// batchOptions are the options for the batch payment method.
type batchOptions struct {
	BatchID  string         `json:"batch-id"`
	Timeout  int            `json:"timeout"`
	Payments []batchPayment `json:"payments"`
}

// Check makes sure that the batch options are valid.
func (c *batchOptions) Check() error {
	for i, p := range c.Payments {
		if strings.TrimSpace(p.Recipient) == "" {
			return fmt.Errorf("payment %d: %s", i, ErrRecipientMissing)
		}
		if strings.TrimSpace(p.Amount) == "" {
			return fmt.Errorf("payment %d: %s", i, ErrAmountMissing)
		}
		namt, err := stellarnet.ParseStellarAmount(p.Amount)
		if err != nil {
			return fmt.Errorf("payment %d: %s", i, ErrInvalidAmount)
		}
		if namt < 0 {
			return fmt.Errorf("payment %d: %s", i, ErrInvalidAmount)
		}
		if len(p.Message) > libkb.MaxStellarPaymentNoteLength {
			return fmt.Errorf("payment %d: %s", i, ErrMessageTooLong)
		}
	}

	if c.Timeout <= 0 {
		c.Timeout = 15 * len(c.Payments)
	}

	return nil
}

type findPaymentPathOptions struct {
	Recipient        string `json:"recipient"`
	Amount           string `json:"amount"`
	SourceAsset      string `json:"source-asset"`
	DestinationAsset string `json:"destination-asset"`
	FromAccountID    string `json:"from-account-id"`
}

func (c *findPaymentPathOptions) Check() error {
	// Note: we don't validate assets in here, since we need the parsed asset values in `sendPathPayment`

	if strings.TrimSpace(c.Recipient) == "" {
		return ErrRecipientMissing
	}
	if strings.TrimSpace(c.Amount) == "" {
		return ErrAmountMissing
	}

	namt, err := stellarnet.ParseStellarAmount(c.Amount)
	if err != nil {
		return ErrInvalidAmount
	}
	if namt < 0 {
		return ErrInvalidAmount
	}

	if c.FromAccountID != "" {
		_, err := strkey.Decode(strkey.VersionByteAccountID, c.FromAccountID)
		if err != nil {
			return ErrInvalidAccountID
		}
	}

	return nil
}

type sendPathPaymentOptions struct {
	Recipient        string `json:"recipient"`
	Amount           string `json:"amount"`
	SourceAsset      string `json:"source-asset"`
	SourceMaxAmount  string `json:"source-max-amount"`
	DestinationAsset string `json:"destination-asset"`
	FromAccountID    string `json:"from-account-id"`
	Message          string `json:"message"`
	MemoText         string `json:"memo-text"`
}

func (c *sendPathPaymentOptions) Check() error {
	// Note: we don't validate assets in here, since we need the parsed asset values in `sendPathPayment`

	if strings.TrimSpace(c.Recipient) == "" {
		return ErrRecipientMissing
	}
	if strings.TrimSpace(c.Amount) == "" {
		return ErrAmountMissing
	}

	amt, err := stellarnet.ParseStellarAmount(c.Amount)
	if err != nil {
		return ErrInvalidAmount
	}
	if amt < 0 {
		return ErrInvalidAmount
	}

	sourceMax, err := stellarnet.ParseStellarAmount(c.SourceMaxAmount)
	if err != nil {
		return ErrInvalidSourceMax
	}
	if sourceMax < 0 {
		return ErrInvalidSourceMax
	}

	if c.FromAccountID != "" {
		_, err := strkey.Decode(strkey.VersionByteAccountID, c.FromAccountID)
		if err != nil {
			return ErrInvalidAccountID
		}
	}
	if len(c.Message) > libkb.MaxStellarPaymentNoteLength {
		return ErrMessageTooLong
	}
	if len(c.MemoText) > libkb.MaxStellarPaymentPublicNoteLength {
		return ErrMemoTextTooLong
	}

	return nil
}
