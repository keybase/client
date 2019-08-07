package stellarnet

import (
	"bytes"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"time"

	perrors "github.com/pkg/errors"
	"github.com/stellar/go/build"
	"github.com/stellar/go/clients/horizon"
	"github.com/stellar/go/keypair"
	snetwork "github.com/stellar/go/network"
	horizonProtocol "github.com/stellar/go/protocols/horizon"
	"github.com/stellar/go/protocols/horizon/base"
	horizonProtocolBase "github.com/stellar/go/protocols/horizon/base"
	"github.com/stellar/go/xdr"
)

var configLock sync.Mutex
var gclient = horizon.DefaultPublicNetClient
var gnetwork = build.PublicNetwork

const defaultMemo = "via keybase"
const baseReserve = 5000000
const submitAttempts = 3

// SetClientAndNetwork sets the horizon client and network. Used by stellarnet/testclient.
func SetClientAndNetwork(c *horizon.Client, n build.Network) {
	configLock.Lock()
	defer configLock.Unlock()
	gclient = c
	gnetwork = n
}

// SetClientURLAndNetwork sets the horizon client URL and network.
func SetClientURLAndNetwork(url string, n build.Network) {
	configLock.Lock()
	defer configLock.Unlock()
	gclient = MakeClient(url)
	gnetwork = n
}

// SetClient sets the horizon client.
func SetClient(c *horizon.Client) {
	configLock.Lock()
	defer configLock.Unlock()
	gclient = c
}

// MakeClient makes a horizon client.
// It is used internally for gclient but can be used when the default
// one in gclient isn't sufficient.
// For example, stellard uses this func to make clients to check the state
// of the primary and backup horizon servers.
// But in general, the gclient one should be used.
func MakeClient(url string) *horizon.Client {
	// Note: we are experimenting with a longer timeout here
	// while we investigate the cause of these horizon timeouts
	hc := &http.Client{Timeout: 30 * time.Second}
	return &horizon.Client{
		URL:  url,
		HTTP: hc,
	}
}

// SetClientURL sets the url for the horizon server this client
// connects to.
func SetClientURL(url string) {
	configLock.Lock()
	defer configLock.Unlock()
	gclient = MakeClient(url)
}

// SetNetwork sets the horizon network.
func SetNetwork(n build.Network) {
	configLock.Lock()
	defer configLock.Unlock()
	gnetwork = n
}

// Client returns the horizon client.
func Client() *horizon.Client {
	configLock.Lock()
	defer configLock.Unlock()
	return gclient
}

// Network returns the horizon network
func Network() build.Network {
	configLock.Lock()
	defer configLock.Unlock()
	return gnetwork
}

// NetworkPassphrase returns the horizon network "passphrase"
func NetworkPassphrase() string {
	configLock.Lock()
	defer configLock.Unlock()
	return gnetwork.Passphrase
}

// Account represents a Stellar account.
type Account struct {
	address  AddressStr
	internal *horizonProtocol.Account
}

// NewAccount makes a new Account item for address.
func NewAccount(address AddressStr) *Account {
	return &Account{address: address}
}

// load uses the horizon client to get the current account
// information.
func (a *Account) load() error {
	internal, err := Client().LoadAccount(a.address.String())
	if err != nil {
		return errMapAccount(err)
	}

	a.internal = &internal

	return nil
}

// BalanceXLM returns the account's lumen balance.
func (a *Account) BalanceXLM() (string, error) {
	if err := a.load(); err != nil {
		return "", err
	}

	return a.internalNativeBalance(), nil
}

func (a *Account) internalNativeBalance() string {
	if a.internal == nil {
		return "0"
	}

	balance, err := a.internal.GetNativeBalance()
	if err != nil {
		return "0"
	}
	if balance == "" {
		// There seem to be situations where this returns an
		// empty string instead of "0", so this will fix that.
		// (Perhaps in relation to relay payments when claimed, but not
		// 100% sure)
		// It could be a bug that has since been fixed, we will upgrade
		// horizon libraries in the future, but this should patch it up
		// for now.  (CORE-10043)
		balance = "0"
	}
	return balance
}

// Balances returns all the balances for an account.
func (a *Account) Balances() ([]horizonProtocol.Balance, error) {
	if err := a.load(); err != nil {
		return nil, err
	}

	return a.internal.Balances, nil
}

// Assets returns the assets issued by the account.
// `complete` is false if there may be more assets.
func (a *Account) Assets() (res []horizonProtocolBase.Asset, complete bool, err error) {
	const limit = 100
	link := fmt.Sprintf("%s/assets?asset_issuer=%s&limit=%v&order=asc", Client().URL, a.address.String(), limit)
	var page horizonProtocol.AssetsPage
	err = getDecodeJSONStrict(link, Client().HTTP.Get, &page)
	if err != nil {
		return nil, false, errMap(err)
	}
	for _, record := range page.Embedded.Records {
		res = append(res, record.Asset)
	}
	return res, len(page.Embedded.Records) < limit, nil
}

// Trustline describes a stellar trustline.  It contains an asset and a limit.
type Trustline struct {
	base.Asset
	Limit string
}

// Trustlines returns all the trustlines for an account.
func (a *Account) Trustlines() ([]Trustline, error) {
	balances, err := a.Balances()
	if err != nil {
		return nil, err
	}
	tlines := make([]Trustline, len(balances))
	for i, b := range balances {
		tlines[i] = Trustline{
			Asset: b.Asset,
			Limit: b.Limit,
		}
	}
	return tlines, nil
}

// SubentryCount returns the number of subentries in the account's ledger.
// Subentries affect the minimum balance.
func (a *Account) SubentryCount() (int, error) {
	if err := a.load(); err != nil {
		return 0, err
	}

	return int(a.internal.SubentryCount), nil
}

// AvailableBalanceXLM returns the native lumen balance minus any
// required minimum balance.
func (a *Account) AvailableBalanceXLM() (string, error) {
	if err := a.load(); err != nil {
		return "", err
	}

	return a.availableBalanceXLMLoaded()
}

// availableBalanceXLMLoaded must be called after a.load().
func (a *Account) availableBalanceXLMLoaded() (string, error) {
	return AvailableBalance(a.internalNativeBalance(), int(a.internal.SubentryCount))
}

// AvailableBalance determines the amount of the balance that could
// be sent to another account (leaving enough XLM in the sender's
// account to maintain the minimum balance).
func AvailableBalance(balance string, subentryCount int) (string, error) {
	balanceInt, err := ParseStellarAmount(balance)
	if err != nil {
		return "", err
	}

	minimum := baseReserve * (2 + int64(subentryCount))

	available := balanceInt - minimum
	if available < 0 {
		available = 0
	}

	return StringFromStellarAmount(available), nil
}

// AccountDetails contains basic details about a stellar account.
type AccountDetails struct {
	Seqno                string
	SubentryCount        int
	Available            string
	Balances             []horizonProtocol.Balance
	InflationDestination string
}

// Details returns AccountDetails for this account (minimizing horizon calls).
func (a *Account) Details() (*AccountDetails, error) {
	if err := a.load(); err != nil {
		return nil, err
	}

	available, err := a.availableBalanceXLMLoaded()
	if err != nil {
		return nil, err
	}

	details := AccountDetails{
		Seqno:                a.internal.Sequence,
		SubentryCount:        int(a.internal.SubentryCount),
		Balances:             a.internal.Balances,
		Available:            available,
		InflationDestination: a.internal.InflationDestination,
	}

	return &details, nil
}

// IsMasterKeyActive returns whether the account's master key can sign transactions.
// The return value is true for normal accounts and multi-sig setups.
// The return value is false for explicitly disabled accounts.
// The master key is considered active if both:
// - The master key signing weight is non-zero.
// - The combined weight of all signers satisfies
//   the minimum signing weight required to sign an operation.
//   (Any operation at all, not necessarily payment)
func IsMasterKeyActive(accountID AddressStr) (bool, error) {
	a := NewAccount(accountID)
	err := a.load()
	if err != nil {
		if err == ErrSourceAccountNotFound {
			// Accounts with no entries have active master keys.
			return true, nil
		}
		return false, err
	}
	minThreshold := int32(minBytes([]byte{a.internal.Thresholds.LowThreshold,
		a.internal.Thresholds.MedThreshold, a.internal.Thresholds.HighThreshold}, 0))
	foundMaster := false
	var masterWeight int32
	var availableWeight int32
	for _, signer := range a.internal.Signers {
		if a.internal.AccountID == signer.Key {
			masterWeight = signer.Weight
			foundMaster = true
		}
		availableWeight += signer.Weight
	}
	if !foundMaster {
		return false, fmt.Errorf("master key entry not found")
	}
	if masterWeight <= 0 {
		return false, nil
	}
	return availableWeight >= minThreshold, nil
}

// AccountSeqno returns the account sequence number.
func AccountSeqno(address AddressStr) (uint64, error) {
	seqno, err := Client().SequenceForAccount(address.String())
	if err != nil {
		return 0, errMapAccount(err)
	}
	return uint64(seqno), nil
}

// RecentPayments returns the account's recent payments.
// This is a summary of any recent payment transactions (payment, create_account, or account_merge).
// It does not contain as much information as RecentTransactionsAndOps.
// It is faster as it is only one request to horizon.
// cursor is optional.  if specified, it is used for pagination.
// limit is optional.  if not specified, default is 10.  max limit is 100.
func (a *Account) RecentPayments(cursor string, limit int) ([]horizon.Payment, error) {
	if limit <= 0 {
		limit = 10
	} else if limit > 100 {
		limit = 100
	}

	link := a.paymentsLink(cursor, limit)

	var page PaymentsPage
	err := getDecodeJSONStrict(link, Client().HTTP.Get, &page)
	if err != nil {
		return nil, errMap(err)
	}
	return page.Embedded.Records, nil
}

// Transactions returns some of the account's transactions.
// cursor is optional. if specified, it is used for pagination.
// limit is optional. if not specified, default is 10.  max limit is 100.
func (a *Account) Transactions(cursor string, limit int) (res []horizonProtocol.Transaction, finalPage bool, err error) {
	if limit <= 0 {
		limit = 10
	} else if limit > 100 {
		limit = 100
	}

	link := a.transactionsLink(cursor, limit)

	var page TransactionsPage
	err = getDecodeJSONStrict(link, Client().HTTP.Get, &page)
	if err != nil {
		return nil, false, errMap(err)
	}

	finalPage = len(page.Embedded.Records) < limit
	res = make([]horizonProtocol.Transaction, len(page.Embedded.Records))
	for i, record := range page.Embedded.Records {
		res[i] = record.Transaction
	}
	return res, finalPage, nil
}

// RecentTransactionsAndOps returns the account's recent transactions, for
// all types of transactions.
func (a *Account) RecentTransactionsAndOps() ([]Transaction, error) {
	link := Client().URL + "/accounts/" + a.address.String() + "/transactions"
	var page TransactionsPage
	err := getDecodeJSONStrict(link+"?order=desc&limit=10", Client().HTTP.Get, &page)
	if err != nil {
		return nil, errMap(err)
	}

	transactions := make([]Transaction, len(page.Embedded.Records))
	// unfortunately, the operations are not included, so for each
	// transaction, we need to make an additional request to get
	// the operations.
	for i := 0; i < len(page.Embedded.Records); i++ {
		transactions[i] = Transaction{Internal: page.Embedded.Records[i]}
		ops, err := a.loadOperations(transactions[i])
		if err != nil {
			return nil, err
		}
		transactions[i].Operations = ops
	}

	return transactions, nil
}

func (a *Account) loadOperations(tx Transaction) ([]Operation, error) {
	link := Client().URL + "/transactions/" + tx.Internal.ID + "/operations"
	var page OperationsPage
	err := getDecodeJSONStrict(link, Client().HTTP.Get, &page)
	if err != nil {
		return nil, errMap(err)
	}
	return page.Embedded.Records, nil
}

// TxPayments returns payment operations in a transaction.
// Note: may not return all payments as the backing response is paginated.
func TxPayments(txID string) ([]horizon.Payment, error) {
	txID, err := CheckTxID(txID)
	if err != nil {
		return nil, err
	}
	var page PaymentsPage
	err = getDecodeJSONStrict(Client().URL+"/transactions/"+txID+"/payments", Client().HTTP.Get, &page)
	if err != nil {
		return nil, errMap(err)
	}
	return page.Embedded.Records, nil
}

// TxDetails gets a horizonProtocol.Transaction for txID.
func TxDetails(txID string) (horizonProtocol.Transaction, error) {
	var embed TransactionEmbed
	if err := getDecodeJSONStrict(Client().URL+"/transactions/"+txID, Client().HTTP.Get, &embed); err != nil {
		return horizonProtocol.Transaction{}, errMap(err)
	}
	return embed.Transaction, nil
}

// AccountMergeAmount returns the amount involved in a merge operation.
// If operationID does not point to a merge operation, the results are undefined.
func AccountMergeAmount(operationID string) (amount string, err error) {
	var page EffectsPage
	if err := getDecodeJSONStrict(Client().URL+"/operations/"+operationID+"/effects", Client().HTTP.Get, &page); err != nil {
		return "", err
	}
	var creditAmount, debitAmount string
	for _, effect := range page.Embedded.Records {
		switch effect.Type {
		case "account_credited":
			if creditAmount != "" {
				return "", fmt.Errorf("unexpected multitude of credit effects")
			}
			creditAmount = effect.Amount
		case "account_debited":
			if debitAmount != "" {
				return "", fmt.Errorf("unexpected multitude of debit effects")
			}
			debitAmount = effect.Amount
		}
	}
	if creditAmount == "" {
		return "", fmt.Errorf("credit effect not found")
	}
	if debitAmount == "" {
		return "", fmt.Errorf("debit effect not found")
	}
	if creditAmount != debitAmount {
		return "", fmt.Errorf("inequal debit and credit amounts: %v != %v", debitAmount, creditAmount)
	}
	return creditAmount, nil
}

// HashTx returns the hex transaction ID using the active network passphrase.
func HashTx(tx xdr.Transaction) (string, error) {
	bs, err := snetwork.HashTransaction(&tx, Network().Passphrase)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(bs[:]), nil
}

// CheckTxID validates and canonicalizes a transaction ID
// Transaction IDs are lowercase hex-encoded 32-byte strings.
func CheckTxID(txID string) (string, error) {
	bs, err := hex.DecodeString(txID)
	if err != nil {
		return "", Error{Display: "invalid transaction ID", Details: fmt.Sprintf("error decoding transaction ID: %v", err)}
	}
	if len(bs) != 32 {
		return "", Error{Display: "invalid transaction ID", Details: fmt.Sprintf("unexpected transaction ID length: %v bytes", len(bs))}
	}
	return hex.EncodeToString(bs), nil
}

// SendXLM sends 'amount' lumens from 'from' account to 'to' account.
// If the recipient has no account yet, this will create it.
// memoText is a public memo.
func SendXLM(from SeedStr, to AddressStr, amount, memoText string) (ledger int32, txid string, attempt int, err error) {
	if len(memoText) > 28 {
		return 0, "", 0, errors.New("public memo is too long")
	}
	// this is checked in build.Transaction, but can't hurt to break out early
	if _, err = ParseStellarAmount(amount); err != nil {
		return 0, "", 0, err
	}

	// try payment first
	ledger, txid, attempt, err = paymentXLM(from, to, amount, memoText)

	if err != nil {
		if err != ErrDestinationAccountNotFound {
			return 0, "", 0, err
		}

		// if payment failed due to op_no_destination, then
		// should try createAccount instead
		return createAccountXLM(from, to, amount, memoText)
	}

	return ledger, txid, attempt, nil
}

// MakeTimeboundsFromTime creates Timebounds from time.Time values.
func MakeTimeboundsFromTime(minTime time.Time, maxTime time.Time) build.Timebounds {
	return build.Timebounds{
		MinTime: uint64(minTime.Unix()),
		MaxTime: uint64(maxTime.Unix()),
	}
}

// MakeTimeboundsWithMaxTime creates Timebounds with maxTime of type time.Time.
func MakeTimeboundsWithMaxTime(maxTime time.Time) build.Timebounds {
	return build.Timebounds{
		MaxTime: uint64(maxTime.Unix()),
	}
}

// paymentXLM creates a payment transaction from 'from' to 'to' for 'amount' lumens.
func paymentXLM(from SeedStr, to AddressStr, amount, memoText string) (ledger int32, txid string, attempt int, err error) {
	sig, err := PaymentXLMTransaction(from, to, amount, memoText, Client(), nil /* timeBounds */, build.DefaultBaseFee)
	if err != nil {
		return 0, "", 0, errMap(err)
	}
	return submitNoResultXDR(sig.Signed)
}

// PaymentXLMTransaction creates a signed transaction to send a payment from 'from' to 'to' for 'amount' lumens.
func PaymentXLMTransaction(from SeedStr, to AddressStr, amount, memoText string,
	seqnoProvider build.SequenceProvider, timeBounds *build.Timebounds, baseFee uint64) (res SignResult, err error) {
	memo := NewMemoText(memoText)
	return PaymentXLMTransactionWithMemo(from, to, amount, memo, seqnoProvider, timeBounds, baseFee)
}

// PaymentXLMTransactionWithMemo creates a signed transaction to send a payment
// from 'from' to 'to' for 'amount' lumens.  It supports all the memo types.
func PaymentXLMTransactionWithMemo(from SeedStr, to AddressStr, amount string, memo *Memo,
	seqnoProvider build.SequenceProvider, timeBounds *build.Timebounds, baseFee uint64) (res SignResult, err error) {
	t, err := newBaseTxSeed(from, seqnoProvider, baseFee)
	if err != nil {
		return res, err
	}
	t.AddPaymentOp(to, amount)
	t.AddMemo(memo)
	t.AddBuiltTimeBounds(timeBounds)
	return t.Sign(from)
}

// payment creates a payment transaction for a custom asset and sends it to the network.
func payment(from SeedStr, to AddressStr, asset AssetBase, amount, memoText string) (ledger int32, txid string, attempt int, err error) {
	sig, err := PaymentTransaction(from, to, asset, amount, memoText, Client(), nil /* timeBounds */, build.DefaultBaseFee)
	if err != nil {
		return 0, "", 0, errMap(err)
	}
	return submitNoResultXDR(sig.Signed)
}

// PaymentTransaction creates a signed transaction to send a payment from 'from' to 'to' for a custom asset.
func PaymentTransaction(from SeedStr, to AddressStr, asset AssetBase, amount, memoText string,
	seqnoProvider build.SequenceProvider, timeBounds *build.Timebounds, baseFee uint64) (res SignResult, err error) {
	t, err := newBaseTxSeed(from, seqnoProvider, baseFee)
	if err != nil {
		return res, err
	}
	assetXDR, err := assetBaseToXDR(asset)
	if err != nil {
		return res, err
	}
	t.AddAssetPaymentOp(to, assetXDR, amount)
	t.AddMemoText(memoText)
	t.AddBuiltTimeBounds(timeBounds)
	return t.Sign(from)
}

// pathPayment creates a transaction with a path payment operation in it and submits it to the network.
func pathPayment(from SeedStr, to AddressStr, sendAsset AssetBase, sendAmountMax string, destAsset AssetBase, destAmount string, path []AssetBase, memoText string) (ledger int32, txid string, attempt int, err error) {
	sig, err := PathPaymentTransaction(from, to, sendAsset, sendAmountMax, destAsset, destAmount, path, memoText, Client(), nil /* timeBounds */, build.DefaultBaseFee)
	if err != nil {
		return 0, "", 0, errMap(err)
	}
	return submitNoResultXDR(sig.Signed)
}

// PathPaymentTransaction creates a signed transaction for a path payment.
func PathPaymentTransaction(from SeedStr, to AddressStr, sendAsset AssetBase, sendAmountMax string, destAsset AssetBase, destAmount string, path []AssetBase, memoText string, seqnoProvider build.SequenceProvider, timeBounds *build.Timebounds, baseFee uint64) (SignResult, error) {
	memo := NewMemoText(memoText)
	return PathPaymentTransactionWithMemo(from, to, sendAsset, sendAmountMax, destAsset, destAmount, path, memo, seqnoProvider, timeBounds, baseFee)
}

// PathPaymentTransactionWithMemo creates a signed transaction for a path payment.
// It supports all memo types.
func PathPaymentTransactionWithMemo(from SeedStr, to AddressStr, sendAsset AssetBase, sendAmountMax string, destAsset AssetBase, destAmount string, path []AssetBase, memo *Memo, seqnoProvider build.SequenceProvider, timeBounds *build.Timebounds, baseFee uint64) (SignResult, error) {
	t, err := newBaseTxSeed(from, seqnoProvider, baseFee)
	if err != nil {
		return SignResult{}, err
	}

	t.AddPathPaymentOp(to, sendAsset, sendAmountMax, destAsset, destAmount, path)
	t.AddMemo(memo)
	t.AddBuiltTimeBounds(timeBounds)

	return t.Sign(from)
}

// createAccountXLM funds an new account 'to' from 'from' with a starting balance of 'amount'.
// memoText is a public memo.
func createAccountXLM(from SeedStr, to AddressStr, amount, memoText string) (ledger int32, txid string, attempt int, err error) {
	sig, err := CreateAccountXLMTransaction(from, to, amount, memoText, Client(), nil /* timeBounds */, build.DefaultBaseFee)
	if err != nil {
		return 0, "", 0, errMap(err)
	}
	return submitNoResultXDR(sig.Signed)
}

// CreateAccountXLMTransaction creates a signed transaction to fund an new account 'to' from 'from'
// with a starting balance of 'amount'.
func CreateAccountXLMTransaction(from SeedStr, to AddressStr, amount, memoText string,
	seqnoProvider build.SequenceProvider, timeBounds *build.Timebounds, baseFee uint64) (res SignResult, err error) {
	memo := NewMemoText(memoText)
	return CreateAccountXLMTransactionWithMemo(from, to, amount, memo, seqnoProvider, timeBounds, baseFee)
}

// CreateAccountXLMTransactionWithMemo creates a signed transaction to fund an new
// account 'to' from 'from' with a starting balance of 'amount'.  It supports all
// memo types.
func CreateAccountXLMTransactionWithMemo(from SeedStr, to AddressStr, amount string, memo *Memo, seqnoProvider build.SequenceProvider, timeBounds *build.Timebounds, baseFee uint64) (res SignResult, err error) {
	t, err := newBaseTxSeed(from, seqnoProvider, baseFee)
	if err != nil {
		return res, err
	}
	t.AddCreateAccountOp(to, amount)
	t.AddMemo(memo)
	t.AddBuiltTimeBounds(timeBounds)
	return t.Sign(from)
}

// AccountMergeTransaction creates a signed transaction to merge the account `from` into `to`.
func AccountMergeTransaction(from SeedStr, to AddressStr,
	seqnoProvider build.SequenceProvider, baseFee uint64) (res SignResult, err error) {
	t, err := newBaseTxSeed(from, seqnoProvider, baseFee)
	if err != nil {
		return res, err
	}
	t.AddAccountMergeOp(to)
	t.AddMemoText(defaultMemo)

	return t.Sign(from)
}

// SetInflationDestinationTransaction creates a "set options" transaction that will set the
// inflation destination for the `from` account to the `to` account.
func SetInflationDestinationTransaction(from SeedStr, to AddressStr, seqnoProvider build.SequenceProvider,
	timeBounds *build.Timebounds, baseFee uint64) (SignResult, error) {
	t, err := newBaseTxSeed(from, seqnoProvider, baseFee)
	if err != nil {
		return SignResult{}, err
	}
	t.AddInflationDestinationOp(to)
	t.AddBuiltTimeBounds(timeBounds)

	return t.Sign(from)
}

func setInflationDestination(from SeedStr, to AddressStr) (ledger int32, txid string, attempt int, err error) {
	sig, err := SetInflationDestinationTransaction(from, to, Client(), nil /* timeBounds */, build.DefaultBaseFee)
	if err != nil {
		return 0, "", 0, errMap(err)
	}
	return submitNoResultXDR(sig.Signed)
}

// SetHomeDomainTransaction creates a "set options" transaction that will set the
// home domain for the `from` account.
func SetHomeDomainTransaction(from SeedStr, domain string, seqnoProvider build.SequenceProvider, timeBounds *build.Timebounds, baseFee uint64) (SignResult, error) {
	t, err := newBaseTxSeed(from, seqnoProvider, baseFee)
	if err != nil {
		return SignResult{}, err
	}
	t.AddHomeDomainOp(domain)
	t.AddBuiltTimeBounds(timeBounds)

	return t.Sign(from)
}

func setHomeDomain(from SeedStr, domain string) (ledger int32, txid string, attempt int, err error) {
	sig, err := SetHomeDomainTransaction(from, domain, Client(), nil /* timeBounds */, build.DefaultBaseFee)
	if err != nil {
		return 0, "", 0, errMap(err)
	}
	return submitNoResultXDR(sig.Signed)
}

// MakeOfferTransaction creates a new offer transaction.
func MakeOfferTransaction(from SeedStr, selling, buying xdr.Asset, amountToSell, price string, seqnoProvider build.SequenceProvider, timeBounds *build.Timebounds, baseFee uint64) (SignResult, error) {
	t, err := newBaseTxSeed(from, seqnoProvider, baseFee)
	if err != nil {
		return SignResult{}, err
	}
	t.AddOfferOp(selling, buying, amountToSell, price)
	t.AddBuiltTimeBounds(timeBounds)

	return t.Sign(from)
}

func makeOffer(from SeedStr, selling, buying xdr.Asset, amountToSell, price string) (ledger int32, txid string, attempt int, err error) {
	sig, err := MakeOfferTransaction(from, selling, buying, amountToSell, price, Client(), nil /* timeBounds */, build.DefaultBaseFee)
	if err != nil {
		return 0, "", 0, errMap(err)
	}
	return submitNoResultXDR(sig.Signed)
}

// RelocateTransaction creates a signed transaction to merge the account `from` into `to`.
// Works even if `to` is not funded but in that case requires 2 XLM temporary reserve.
// If `toIsFunded` then this is just an account merge transaction.
// Otherwise the transaction is two operations: [create_account, account_merge].
func RelocateTransaction(from SeedStr, to AddressStr, toIsFunded bool,
	memoID *uint64, seqnoProvider build.SequenceProvider, timeBounds *build.Timebounds, baseFee uint64) (res SignResult, err error) {
	t, err := newBaseTxSeed(from, seqnoProvider, baseFee)
	if err != nil {
		return SignResult{}, err
	}
	if !toIsFunded {
		t.AddCreateAccountOp(to, "1")
	}
	t.AddAccountMergeOp(to)
	t.AddMemoID(memoID)
	t.AddBuiltTimeBounds(timeBounds)
	return t.Sign(from)
}

// CreateTrustline submits a transaction to the stellar network to establish a trustline
// from an account to an asset.
func CreateTrustline(from SeedStr, assetCode string, assetIssuer AddressStr, limit string, baseFee uint64) (txID string, err error) {
	sig, err := CreateTrustlineTransaction(from, assetCode, assetIssuer, limit, Client(), nil /* timeBounds */, baseFee)
	if err != nil {
		return "", err
	}
	res, err := Submit(sig.Signed)
	return res.TxID, err
}

// CreateTrustlineTransaction create a signed transaction to establish a trustline from
// the `from` account to assetCode/assetIssuer.
func CreateTrustlineTransaction(from SeedStr, assetCode string, assetIssuer AddressStr, limit string, seqnoProvider build.SequenceProvider, timeBounds *build.Timebounds, baseFee uint64) (SignResult, error) {
	t, err := newBaseTxSeed(from, seqnoProvider, baseFee)
	if err != nil {
		return SignResult{}, err
	}
	t.AddCreateTrustlineOp(assetCode, assetIssuer, limit)
	return t.Sign(from)
}

// DeleteTrustline submits a transaction to the stellar network to remove a trustline
// from an account.
func DeleteTrustline(from SeedStr, assetCode string, assetIssuer AddressStr, baseFee uint64) (txID string, err error) {
	sig, err := DeleteTrustlineTransaction(from, assetCode, assetIssuer, Client(), nil /* timeBounds */, baseFee)
	if err != nil {
		return "", err
	}
	res, err := Submit(sig.Signed)
	return res.TxID, err
}

// DeleteTrustlineTransaction create a signed transaction to remove a trustline from
// the `from` account to assetCode/assetIssuer.
func DeleteTrustlineTransaction(from SeedStr, assetCode string, assetIssuer AddressStr, seqnoProvider build.SequenceProvider, timeBounds *build.Timebounds, baseFee uint64) (SignResult, error) {
	t, err := newBaseTxSeed(from, seqnoProvider, baseFee)
	if err != nil {
		return SignResult{}, err
	}
	t.AddDeleteTrustlineOp(assetCode, assetIssuer)
	return t.Sign(from)
}

// SignEnvelope signs an xdr.TransactionEnvelope.
func SignEnvelope(from SeedStr, txEnv xdr.TransactionEnvelope) (SignResult, error) {
	hash, err := snetwork.HashTransaction(&txEnv.Tx, NetworkPassphrase())
	if err != nil {
		return SignResult{}, err
	}

	kp, err := keypair.Parse(from.SecureNoLogString())
	if err != nil {
		return SignResult{}, err
	}
	sig, err := kp.SignDecorated(hash[:])
	if err != nil {
		return SignResult{}, err
	}

	txEnv.Signatures = append(txEnv.Signatures, sig)

	var buf bytes.Buffer
	_, err = xdr.Marshal(&buf, txEnv)
	if err != nil {
		return SignResult{}, err
	}
	signed := base64.StdEncoding.EncodeToString(buf.Bytes())
	txHashHex := hex.EncodeToString(hash[:])

	return SignResult{
		Seqno:  uint64(txEnv.Tx.SeqNum),
		Signed: signed,
		TxHash: txHashHex,
	}, nil
}

func submitNoResultXDR(signed string) (ledger int32, txid string, attempt int, err error) {
	res, err := Submit(signed)
	return res.Ledger, res.TxID, res.Attempt, err
}

// SubmitResult contains information about a tx after submission to the stellar network.
type SubmitResult struct {
	Ledger    int32
	TxID      string
	Attempt   int
	ResultXDR string
}

// Submit submits a signed transaction to horizon.
func Submit(signed string) (res SubmitResult, err error) {
	var resp horizonProtocol.TransactionSuccess
	for i := 0; i < submitAttempts; i++ {
		resp, err = Client().SubmitTransaction(signed)
		if err != nil {
			// the error might be wrapped, so get the unwrapped error
			xerr := perrors.Cause(err)

			// if error was a timeout, then keep trying
			urlErr, ok := xerr.(*url.Error)
			if ok && urlErr.Timeout() {
				continue
			}

			// try resubmitting when seqno err
			hznErr, ok := xerr.(*horizon.Error)
			if ok {
				resultCodes, zerr := hznErr.ResultCodes()
				if zerr == nil && resultCodes.TransactionCode == "tx_bad_seq" {
					continue
				}
			}

			return SubmitResult{Attempt: i}, errMap(err)
		}

		return SubmitResult{Ledger: resp.Ledger, TxID: resp.Hash, Attempt: i, ResultXDR: resp.Result}, nil
	}

	return SubmitResult{Attempt: submitAttempts}, errMap(err)
}

// FindPaymentPaths searches for path payments from the account object ownere and `to`, for a specific
// destination asset.
// It will return an error if the `to` recipient does not have a trustline for the destination asset.
// It will return paths using any of the `from` account's assets as the source asset.
func (a *Account) FindPaymentPaths(to AddressStr, assetCode string, assetIssuer AddressStr, amount string) ([]FullPath, error) {
	assetType, err := assetCodeToType(assetCode)
	if err != nil {
		return nil, err
	}
	values := fmt.Sprintf("source_account=%s&destination_account=%s&destination_asset_type=%s&destination_asset_code=%s&destination_asset_issuer=%s&destination_amount=%s", a.address, to, assetType, assetCode, assetIssuer, amount)
	link := Client().URL + "/paths?" + values

	var page PathsPage
	if err := getDecodeJSONStrict(link, Client().HTTP.Get, &page); err != nil {
		return nil, errMap(err)
	}
	return page.Embedded.Records, nil
}

// CreateCustomAsset will create a new asset on the network.  It will
// return two new account seeds:  one for the issuing account, one for
// the distribution account.
//
// If an error occurs after the issuer and distributor are funded,
// the issuer and distributor seeds will be returned along with any
// error so you can reclaim your funds.
func CreateCustomAsset(source SeedStr, assetCode, limit, homeDomain string, xlmPrice string, baseFee uint64) (issuer, distributor SeedStr, err error) {
	issuerPair, err := NewKeyPair()
	if err != nil {
		return "", "", err
	}
	distPair, err := NewKeyPair()
	if err != nil {
		return "", "", err
	}

	return CreateCustomAssetWithKPs(source, issuerPair, distPair, assetCode, limit, homeDomain, xlmPrice, baseFee)
}

// CreateCustomAssetWithKPs will create a new asset on the network using the specified
// issuerPair as the issuing account and distPair as the distribution account.
//
// You should probably use CreateCustomAsset as it will make new issuer, dist for you,
// but this one can be handy in tests where you want to specify the issuer, dist keys.
func CreateCustomAssetWithKPs(source SeedStr, issuerPair, distPair *keypair.Full, assetCode, limit, homeDomain string, xlmPrice string, baseFee uint64) (issuer, distributor SeedStr, err error) {
	// 1. create issuer
	issuer, err = NewSeedStr(issuerPair.Seed())
	if err != nil {
		return "", "", err
	}
	issuerAddr, err := NewAddressStr(issuerPair.Address())
	if err != nil {
		return "", "", err
	}
	_, _, _, err = createAccountXLM(source, issuerAddr, "5", "")
	if err != nil {
		return "", "", err
	}

	// 2. create distributor
	distributor, err = NewSeedStr(distPair.Seed())
	if err != nil {
		return issuer, "", err
	}
	distributorAddr, err := NewAddressStr(distPair.Address())
	if err != nil {
		return issuer, "", err
	}
	_, _, _, err = createAccountXLM(source, distributorAddr, "5", "")
	if err != nil {
		return issuer, "", err
	}

	// 3. create distributor trustline
	_, err = CreateTrustline(distributor, assetCode, issuerAddr, limit, baseFee)
	if err != nil {
		return issuer, distributor, err
	}

	// 4. create the asset by paying the distributor
	asset, err := NewAssetMinimal(assetCode, issuerAddr.String())
	if err != nil {
		return issuer, distributor, err
	}
	_, _, _, err = payment(issuer, distributorAddr, asset, limit, "")
	if err != nil {
		return issuer, distributor, err
	}

	// 5. set the home domain
	_, _, _, err = setHomeDomain(issuer, homeDomain)
	if err != nil {
		return issuer, distributor, err
	}

	// 6. make an offer to sell the new asset
	selling, err := makeXDRAsset(assetCode, issuerAddr)
	if err != nil {
		return issuer, distributor, err
	}
	buying := xdr.Asset{
		Type: xdr.AssetTypeAssetTypeNative,
	}
	_, _, _, err = makeOffer(distributor, selling, buying, limit, xlmPrice)
	if err != nil {
		return issuer, distributor, err
	}

	// 7. everything good...asset created.

	return issuer, distributor, nil
}

// paymentsLink returns the horizon endpoint to get payment information.
func (a *Account) paymentsLink(cursor string, limit int) string {
	link := Client().URL + "/accounts/" + a.address.String() + "/payments"
	if cursor != "" {
		return fmt.Sprintf("%s?cursor=%s&order=desc&limit=%d", link, cursor, limit)
	}
	return fmt.Sprintf("%s?order=desc&limit=%d", link, limit)
}

// transactionsLink returns the horizon endpoint to get payment information.
func (a *Account) transactionsLink(cursor string, limit int) string {
	link := Client().URL + "/accounts/" + a.address.String() + "/transactions"
	if cursor != "" {
		return fmt.Sprintf("%s?cursor=%s&order=desc&limit=%d", link, cursor, limit)
	}
	return fmt.Sprintf("%s?order=desc&limit=%d", link, limit)
}

func minBytes(bs []byte, deflt byte) byte {
	if len(bs) == 0 {
		return deflt
	}
	res := bs[0]
	for _, b := range bs[1:] {
		if b < res {
			res = b
		}
	}
	return res
}

// getDecodeJSONStrict gets from a url and decodes the response.
// Returns errors on non-200 response codes.
// Inspired by: https://github.com/stellar/go/blob/4c8cfd0/clients/horizon/internal.go#L16
func getDecodeJSONStrict(url string, getter func(string) (*http.Response, error), dest interface{}) error {
	resp, err := getter(url)
	if err != nil {
		return errMap(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		horizonError := &horizon.Error{
			Response: resp,
		}
		err := json.NewDecoder(resp.Body).Decode(&horizonError.Problem)
		if err != nil {
			return Error{
				Display:      "stellar network error",
				Details:      fmt.Sprintf("horizon http error: %v %v, decode body error: %s", resp.StatusCode, resp.Status, err),
				HorizonError: horizonError,
			}
		}
		return errMap(horizonError)
	}
	if err := json.NewDecoder(resp.Body).Decode(dest); err != nil {
		return errMap(err)
	}

	return nil
}
