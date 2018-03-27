package stellarnet

import (
	"encoding/json"
	"strings"

	samount "github.com/stellar/go/amount"
	"github.com/stellar/go/build"
	"github.com/stellar/go/clients/horizon"
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
		if herr, ok := err.(*horizon.Error); ok {
			if herr.Problem.Status == 404 {
				return ErrAccountNotFound
			}
		}
		return err
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

// RecentPayments returns the account's recent payments.
// This is a summary of any recent payment transactions (payment or create_account).
// It does not contain as much information as RecentTransactions.
// It is faster as it is only one request to horizon.
func (a *Account) RecentPayments() ([]horizon.Payment, error) {
	link, err := a.paymentsLink()
	if err != nil {
		return nil, err
	}
	res, err := client.HTTP.Get(link + "?order=desc&limit=10")
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	var page PaymentsPage
	if err := json.NewDecoder(res.Body).Decode(&page); err != nil {
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
	res, err := client.HTTP.Get(link + "?order=desc&limit=10")
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	var page TransactionsPage
	if err := json.NewDecoder(res.Body).Decode(&page); err != nil {
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
	res, err := client.HTTP.Get(link)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	var page OperationsPage
	if err := json.NewDecoder(res.Body).Decode(&page); err != nil {
		return nil, err
	}
	return page.Embedded.Records, nil
}

func (a *Account) isOpNoDestination(inErr error) bool {
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
func (a *Account) SendXLM(from SeedStr, to AddressStr, amount string) (ledger int32, txid string, err error) {
	// this is checked in build.Transaction, but can't hurt to break out early
	if _, err = samount.Parse(amount); err != nil {
		return 0, "", err
	}

	// try payment first
	ledger, txid, err = a.paymentXLM(from, to, amount)

	if err != nil {
		if !a.isOpNoDestination(err) {
			return 0, "", err
		}

		// if payment failed due to op_no_destination, then
		// should try createAccount instead
		return a.createAccountXLM(from, to, amount)
	}

	return ledger, txid, nil
}

// paymentXLM creates a payment transaction from 'from' to 'to' for 'amount' lumens.
func (a *Account) paymentXLM(from SeedStr, to AddressStr, amount string) (ledger int32, txid string, err error) {
	_, signed, err := a.PaymentXLMTransaction(from, to, amount)
	if err != nil {
		return 0, "", err
	}

	return Submit(signed)
}

func (a *Account) PaymentXLMTransaction(from SeedStr, to AddressStr, amount string) (seqno uint64, signed string, err error) {
	tx, err := build.Transaction(
		build.SourceAccount{AddressOrSeed: from.SecureNoLogString()},
		network,
		build.AutoSequence{SequenceProvider: client},
		build.Payment(
			build.Destination{AddressOrSeed: to.String()},
			build.NativeAmount{Amount: amount},
		),
		build.MemoText{Value: "via keybase"},
	)
	if err != nil {
		return 0, "", err
	}

	return a.sign(from, tx)
}

// createAccountXLM funds an new account 'to' from 'from' with a starting balance of 'amount'.
func (a *Account) createAccountXLM(from SeedStr, to AddressStr, amount string) (ledger int32, txid string, err error) {
	_, signed, err := a.CreateAccountXLMTransaction(from, to, amount)
	if err != nil {
		return 0, "", err
	}

	return Submit(signed)
}

// CreateAccountXLMTransaction creates a signed transaction to fund an new account 'to' from 'from'
// with a starting balance of 'amount'.
func (a *Account) CreateAccountXLMTransaction(from SeedStr, to AddressStr, amount string) (seqno uint64, signed string, err error) {
	tx, err := build.Transaction(
		build.SourceAccount{AddressOrSeed: from.SecureNoLogString()},
		network,
		build.AutoSequence{SequenceProvider: client},
		build.CreateAccount(
			build.Destination{AddressOrSeed: to.String()},
			build.NativeAmount{Amount: amount},
		),
		build.MemoText{Value: "via keybase"},
	)
	if err != nil {
		return 0, "", err
	}

	return a.sign(from, tx)
}

// sign signs and base64-encodes a transaction.
func (a *Account) sign(from SeedStr, tx *build.TransactionBuilder) (seqno uint64, signed string, err error) {
	txe, err := tx.Sign(from.SecureNoLogString())
	if err != nil {
		return 0, "", err
	}

	seqno = uint64(txe.E.Tx.SeqNum)
	signed, err = txe.Base64()
	return seqno, signed, err
}

// Submit submits a signed transaction to horizon.
func Submit(signed string) (ledger int32, txid string, err error) {
	resp, err := client.SubmitTransaction(signed)
	if err != nil {
		return 0, "", err
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
