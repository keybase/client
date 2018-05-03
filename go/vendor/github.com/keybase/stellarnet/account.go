package stellarnet

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/pkg/errors"
	samount "github.com/stellar/go/amount"
	"github.com/stellar/go/build"
	"github.com/stellar/go/clients/horizon"
	snetwork "github.com/stellar/go/network"
	"github.com/stellar/go/xdr"
)

var client = horizon.DefaultPublicNetClient
var network = build.PublicNetwork

// SetClientURL sets the url for the horizon server this client
// connects to.
func SetClientURL(url string) {
	client.URL = url
}

// SetClient sets the horizon client and network. Used by stellarnet/testclient.
func SetClient(c *horizon.Client, n build.Network) {
	client = c
	network = n
}

// Client returns the horizon client.
func Client() *horizon.Client {
	return client
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
	internal, err := client.LoadAccount(a.address.String())
	if err != nil {
		return errMap(err)
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
		if err == ErrAccountNotFound {
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
	seqno, err := client.SequenceForAccount(address.String())
	if err != nil {
		return 0, errMap(err)
	}
	return uint64(seqno), nil
}

// RecentPayments returns the account's recent payments.
// This is a summary of any recent payment transactions (payment, create_account, or account_merge).
// It does not contain as much information as RecentTransactions.
// It is faster as it is only one request to horizon.
func (a *Account) RecentPayments() ([]horizon.Payment, error) {
	link, err := a.paymentsLink()
	if err != nil {
		return nil, err
	}
	var page PaymentsPage
	err = getDecodeJSONStrict(link+"?order=desc&limit=10", client.HTTP.Get, &page)
	if err != nil {
		return nil, err
	}
	return page.Embedded.Records, nil
}

// RecentTransactions returns the account's recent transactions, for
// all types of transactions.
func (a *Account) RecentTransactions() ([]Transaction, error) {
	link, err := a.transactionsLink()
	if err != nil {
		return nil, err
	}
	var page TransactionsPage
	err = getDecodeJSONStrict(link+"?order=desc&limit=10", client.HTTP.Get, &page)
	if err != nil {
		return nil, err
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
	link := a.linkHref(tx.Internal.Links.Operations)
	var page OperationsPage
	err := getDecodeJSONStrict(link, client.HTTP.Get, &page)
	if err != nil {
		return nil, err
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
	err = getDecodeJSONStrict(client.URL+"/transactions/"+txID+"/payments", client.HTTP.Get, &page)
	if err != nil {
		return nil, err
	}
	return page.Embedded.Records, nil
}

// HashTx returns the hex transaction ID using the active network passphrase.
func HashTx(tx xdr.Transaction) (string, error) {
	bs, err := snetwork.HashTransaction(&tx, network.Passphrase)
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
		return "", fmt.Errorf("error decoding transaction ID: %v", err)
	}
	if len(bs) != 32 {
		return "", fmt.Errorf("unexpected transaction ID length: %v bytes", len(bs))
	}
	return hex.EncodeToString(bs), nil
}

func isOpNoDestination(inErr error) bool {
	herr, ok := inErr.(*horizon.Error)
	if !ok {
		return false
	}
	resultCodes, err := herr.ResultCodes()
	if err != nil {
		return false
	}
	if resultCodes.TransactionCode != "tx_failed" {
		return false
	}
	if len(resultCodes.OperationCodes) != 1 {
		// only handle one operation now
		return false
	}
	return resultCodes.OperationCodes[0] == "op_no_destination"
}

// SendXLM sends 'amount' lumens from 'from' account to 'to' account.
// If the recipient has no account yet, this will create it.
func SendXLM(from SeedStr, to AddressStr, amount string) (ledger int32, txid string, err error) {
	// this is checked in build.Transaction, but can't hurt to break out early
	if _, err = samount.Parse(amount); err != nil {
		return 0, "", err
	}

	// try payment first
	ledger, txid, err = paymentXLM(from, to, amount)

	if err != nil {
		if err != ErrAccountNotFound {
			return 0, "", err
		}

		// if payment failed due to op_no_destination, then
		// should try createAccount instead
		return createAccountXLM(from, to, amount)
	}

	return ledger, txid, nil
}

// paymentXLM creates a payment transaction from 'from' to 'to' for 'amount' lumens.
func paymentXLM(from SeedStr, to AddressStr, amount string) (ledger int32, txid string, err error) {
	sig, err := PaymentXLMTransaction(from, to, amount, client)
	if err != nil {
		return 0, "", err
	}
	return Submit(sig.Signed)
}

// PaymentXLMTransaction creates a signed transaction to send a payment from 'from' to 'to' for 'amount' lumens.
func PaymentXLMTransaction(from SeedStr, to AddressStr, amount string,
	seqnoProvider build.SequenceProvider) (res SignResult, err error) {
	tx, err := build.Transaction(
		build.SourceAccount{AddressOrSeed: from.SecureNoLogString()},
		network,
		build.AutoSequence{SequenceProvider: seqnoProvider},
		build.Payment(
			build.Destination{AddressOrSeed: to.String()},
			build.NativeAmount{Amount: amount},
		),
		build.MemoText{Value: "via keybase"},
	)
	if err != nil {
		return res, err
	}
	return sign(from, tx)
}

// createAccountXLM funds an new account 'to' from 'from' with a starting balance of 'amount'.
func createAccountXLM(from SeedStr, to AddressStr, amount string) (ledger int32, txid string, err error) {
	sig, err := CreateAccountXLMTransaction(from, to, amount, client)
	if err != nil {
		return 0, "", err
	}
	return Submit(sig.Signed)
}

// CreateAccountXLMTransaction creates a signed transaction to fund an new account 'to' from 'from'
// with a starting balance of 'amount'.
func CreateAccountXLMTransaction(from SeedStr, to AddressStr, amount string,
	seqnoProvider build.SequenceProvider) (res SignResult, err error) {
	tx, err := build.Transaction(
		build.SourceAccount{AddressOrSeed: from.SecureNoLogString()},
		network,
		build.AutoSequence{SequenceProvider: seqnoProvider},
		build.CreateAccount(
			build.Destination{AddressOrSeed: to.String()},
			build.NativeAmount{Amount: amount},
		),
		build.MemoText{Value: "via keybase"},
	)
	if err != nil {
		return res, err
	}
	return sign(from, tx)
}

type SignResult struct {
	Seqno  uint64
	Signed string // signed transaction (base64)
	TxHash string // transaction hash (hex)
}

// sign signs and base64-encodes a transaction.
func sign(from SeedStr, tx *build.TransactionBuilder) (res SignResult, err error) {
	txe, err := tx.Sign(from.SecureNoLogString())
	if err != nil {
		return res, err
	}
	seqno := uint64(txe.E.Tx.SeqNum)
	signed, err := txe.Base64()
	if err != nil {
		return res, err
	}
	txHashHex, err := tx.HashHex()
	if err != nil {
		return res, err
	}
	return SignResult{
		Seqno:  seqno,
		Signed: signed,
		TxHash: txHashHex,
	}, nil
}

// Submit submits a signed transaction to horizon.
func Submit(signed string) (ledger int32, txid string, err error) {
	resp, err := client.SubmitTransaction(signed)
	if err != nil {
		return 0, "", errMap(err)
	}

	return resp.Ledger, resp.Hash, nil
}

// paymentsLink returns the horizon endpoint to get payment information.
func (a *Account) paymentsLink() (string, error) {
	if a.internal == nil {
		if err := a.load(); err != nil {
			return "", err
		}
	}

	return a.linkHref(a.internal.Links.Payments), nil
}

// transactionsLink returns the horizon endpoint to get transaction information.
func (a *Account) transactionsLink() (string, error) {
	if a.internal == nil {
		if err := a.load(); err != nil {
			return "", err
		}
	}

	return a.linkHref(a.internal.Links.Transactions), nil
}

// linkHref gets a usable href out of a horizon.Link.
func (a *Account) linkHref(link horizon.Link) string {
	if link.Templated {
		return strings.Split(link.Href, "{")[0]
	}
	return link.Href

}

// errMap maps some horizon errors to stellarnet errors.
func errMap(err error) error {
	if err == nil {
		return nil
	}

	// the error might be wrapped, so get the unwrapped error
	xerr := errors.Cause(err)

	if isOpNoDestination(xerr) {
		return ErrAccountNotFound
	}

	if herr, ok := xerr.(*horizon.Error); ok {
		if herr.Problem.Status == 404 {
			return ErrAccountNotFound
		}
	}

	return err
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
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		horizonError := &horizon.Error{
			Response: resp,
		}
		err := json.NewDecoder(resp.Body).Decode(&horizonError.Problem)
		if err != nil {
			return fmt.Errorf("horizon http error: %v %v", resp.StatusCode, resp.Status)
		}
		return horizonError
	}
	err = json.NewDecoder(resp.Body).Decode(dest)
	return err
}
