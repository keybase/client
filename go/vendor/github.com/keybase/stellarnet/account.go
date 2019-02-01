package stellarnet

import (
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
	snetwork "github.com/stellar/go/network"
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

// Account represents a Stellar account.
type Account struct {
	address  AddressStr
	internal *horizon.Account
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

	return a.internal.GetNativeBalance(), nil
}

// Balances returns all the balances for an account.
func (a *Account) Balances() ([]horizon.Balance, error) {
	if err := a.load(); err != nil {
		return nil, err
	}

	return a.internal.Balances, nil
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
	return AvailableBalance(a.internal.GetNativeBalance(), int(a.internal.SubentryCount))
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
	Balances             []horizon.Balance
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
		if a.internal.AccountID == signer.PublicKey {
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
func (a *Account) Transactions(cursor string, limit int) (res []horizon.Transaction, finalPage bool, err error) {
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
	res = make([]horizon.Transaction, len(page.Embedded.Records))
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

// TxDetails gets a horizon.Transaction for txID.
func TxDetails(txID string) (horizon.Transaction, error) {
	var embed TransactionEmbed
	if err := getDecodeJSONStrict(Client().URL+"/transactions/"+txID, Client().HTTP.Get, &embed); err != nil {
		return horizon.Transaction{}, errMap(err)
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
	sig, err := PaymentXLMTransaction(from, to, amount, memoText, Client(), nil /* timeBounds */)
	if err != nil {
		return 0, "", 0, errMap(err)
	}
	return Submit(sig.Signed)
}

// PaymentXLMTransaction creates a signed transaction to send a payment from 'from' to 'to' for 'amount' lumens.
func PaymentXLMTransaction(from SeedStr, to AddressStr, amount, memoText string,
	seqnoProvider build.SequenceProvider, timeBounds *build.Timebounds) (res SignResult, err error) {
	muts := []build.TransactionMutator{
		build.SourceAccount{AddressOrSeed: from.SecureNoLogString()},
		Network(),
		build.AutoSequence{SequenceProvider: seqnoProvider},
		build.Payment(
			build.Destination{AddressOrSeed: to.String()},
			build.NativeAmount{Amount: amount},
		),
		build.MemoText{Value: memoText},
	}
	if timeBounds != nil {
		muts = append(muts, timeBounds)
	}
	tx, err := build.Transaction(muts...)
	if err != nil {
		return res, errMap(err)
	}
	return sign(from, tx)
}

// createAccountXLM funds an new account 'to' from 'from' with a starting balance of 'amount'.
// memoText is a public memo.
func createAccountXLM(from SeedStr, to AddressStr, amount, memoText string) (ledger int32, txid string, attempt int, err error) {
	sig, err := CreateAccountXLMTransaction(from, to, amount, memoText, Client(), nil /* timeBounds */)
	if err != nil {
		return 0, "", 0, errMap(err)
	}
	return Submit(sig.Signed)
}

// CreateAccountXLMTransaction creates a signed transaction to fund an new account 'to' from 'from'
// with a starting balance of 'amount'.
func CreateAccountXLMTransaction(from SeedStr, to AddressStr, amount, memoText string,
	seqnoProvider build.SequenceProvider, timeBounds *build.Timebounds) (res SignResult, err error) {
	muts := []build.TransactionMutator{
		build.SourceAccount{AddressOrSeed: from.SecureNoLogString()},
		Network(),
		build.AutoSequence{SequenceProvider: seqnoProvider},
		build.CreateAccount(
			build.Destination{AddressOrSeed: to.String()},
			build.NativeAmount{Amount: amount},
		),
		build.MemoText{Value: memoText},
	}
	if timeBounds != nil {
		muts = append(muts, timeBounds)
	}
	tx, err := build.Transaction(muts...)
	if err != nil {
		return res, errMap(err)
	}
	return sign(from, tx)
}

// AccountMergeTransaction creates a signed transaction to merge the account `from` into `to`.
func AccountMergeTransaction(from SeedStr, to AddressStr,
	seqnoProvider build.SequenceProvider) (res SignResult, err error) {
	tx, err := build.Transaction(
		build.SourceAccount{AddressOrSeed: from.SecureNoLogString()},
		Network(),
		build.AutoSequence{SequenceProvider: seqnoProvider},
		build.AccountMerge(
			build.Destination{AddressOrSeed: to.String()},
		),
		build.MemoText{Value: defaultMemo},
	)
	if err != nil {
		return res, errMap(err)
	}
	return sign(from, tx)
}

// SetInflationDestinationTransaction creates a "set options" transaction that will set the
// inflation destination for the `from` account to the `to` account.
func SetInflationDestinationTransaction(from SeedStr, to AddressStr,
	seqnoProvider build.SequenceProvider, timeBounds *build.Timebounds) (SignResult, error) {
	muts := []build.TransactionMutator{
		build.SourceAccount{AddressOrSeed: from.SecureNoLogString()},
		Network(),
		build.AutoSequence{SequenceProvider: seqnoProvider},
		build.SetOptions(
			build.InflationDest(to.String()),
		),
	}
	if timeBounds != nil {
		muts = append(muts, timeBounds)
	}
	tx, err := build.Transaction(muts...)
	if err != nil {
		return SignResult{}, errMap(err)
	}
	return sign(from, tx)
}

func setInflationDestination(from SeedStr, to AddressStr) (ledger int32, txid string, attempt int, err error) {
	sig, err := SetInflationDestinationTransaction(from, to, Client(), nil /* timeBounds */)
	if err != nil {
		return 0, "", 0, errMap(err)
	}
	return Submit(sig.Signed)
}

// RelocateTransaction creates a signed transaction to merge the account `from` into `to`.
// Works even if `to` is not funded but in that case requires 2 XLM temporary reserve.
// If `toIsFunded` then this is just an account merge transaction.
// Otherwise the transaction is two operations: [create_account, account_merge].
func RelocateTransaction(from SeedStr, to AddressStr, toIsFunded bool,
	memoID *uint64, seqnoProvider build.SequenceProvider, timeBounds *build.Timebounds) (res SignResult, err error) {
	muts := []build.TransactionMutator{
		build.SourceAccount{AddressOrSeed: from.SecureNoLogString()},
		Network(),
		build.AutoSequence{SequenceProvider: seqnoProvider},
	}
	if !toIsFunded {
		muts = append(muts, build.CreateAccount(
			build.Destination{AddressOrSeed: to.String()},
			build.NativeAmount{Amount: "1"},
		))
	}
	muts = append(muts, build.AccountMerge(
		build.Destination{AddressOrSeed: to.String()},
	))
	if memoID != nil {
		muts = append(muts, build.MemoID{Value: *memoID})
	}
	if timeBounds != nil {
		muts = append(muts, timeBounds)
	}
	tx, err := build.Transaction(muts...)
	if err != nil {
		return res, errMap(err)
	}
	return sign(from, tx)
}

// SignResult contains the result of signing a transaction.
type SignResult struct {
	Seqno  uint64
	Signed string // signed transaction (base64)
	TxHash string // transaction hash (hex)
}

// sign signs and base64-encodes a transaction.
func sign(from SeedStr, tx *build.TransactionBuilder) (res SignResult, err error) {
	txe, err := tx.Sign(from.SecureNoLogString())
	if err != nil {
		return res, errMap(err)
	}
	seqno := uint64(txe.E.Tx.SeqNum)
	signed, err := txe.Base64()
	if err != nil {
		return res, errMap(err)
	}
	txHashHex, err := tx.HashHex()
	if err != nil {
		return res, errMap(err)
	}
	return SignResult{
		Seqno:  seqno,
		Signed: signed,
		TxHash: txHashHex,
	}, nil
}

// Submit submits a signed transaction to horizon.
func Submit(signed string) (ledger int32, txid string, attempt int, err error) {
	var resp horizon.TransactionSuccess
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

			return 0, "", i, errMap(err)
		}

		return resp.Ledger, resp.Hash, i, nil
	}

	return 0, "", submitAttempts, errMap(err)
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
