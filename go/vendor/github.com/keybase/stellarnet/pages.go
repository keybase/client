package stellarnet

import (
	"time"

	"github.com/stellar/go/clients/horizon"
)

// TransactionEmbed is used to get the Links in addition to
// the horizon.Transaction from the transactions endpoints.
type TransactionEmbed struct {
	Links struct {
		Self       horizon.Link `json:"self"`
		Account    horizon.Link `json:"account"`
		Ledger     horizon.Link `json:"ledger"`
		Operations horizon.Link `json:"operations"`
		Effects    horizon.Link `json:"effects"`
		Precedes   horizon.Link `json:"precedes"`
		Succeeds   horizon.Link `json:"succeeds"`
	} `json:"_links"`
	horizon.Transaction
}

// TransactionsPage is used to unmarshal the results from the account
// transactions endpoint.
type TransactionsPage struct {
	Links struct {
		Self horizon.Link `json:"self"`
		Next horizon.Link `json:"next"`
		Prev horizon.Link `json:"prev"`
	} `json:"_links"`
	Embedded struct {
		Records []TransactionEmbed `json:"records"`
	} `json:"_embedded"`
}

// PaymentsPage is used to unmarshal the results from the account
// payments endpoint.
type PaymentsPage struct {
	Links struct {
		Self horizon.Link `json:"self"`
		Next horizon.Link `json:"next"`
		Prev horizon.Link `json:"prev"`
	} `json:"_links"`
	Embedded struct {
		Records []horizon.Payment `json:"records"`
	} `json:"_embedded"`
}

// OperationsPage is used to unmarshal the results from a transaction's
// operations endpoint.
type OperationsPage struct {
	Links struct {
		Self horizon.Link `json:"self"`
		Next horizon.Link `json:"next"`
		Prev horizon.Link `json:"prev"`
	} `json:"_links"`
	Embedded struct {
		Records []Operation `json:"records"`
	} `json:"_embedded"`
}

// Operation is a single operation in a transaction.
type Operation struct {
	ID              string    `json:"id"`
	PagingToken     string    `json:"paging_token"`
	SourceAccount   string    `json:"source_account"`
	Type            string    `json:"type"`
	CreatedAt       time.Time `json:"created_at"`
	TransactionHash string    `json:"transaction_hash"`

	// create_account fields
	Account         string `json:"account"`
	StartingBalance string `json:"starting_balance"`
	Funder          string `json:"funder"`

	// payment fields
	AssetType string `json:"asset_type"`
	From      string `json:"from"`
	To        string `json:"to"`
	Amount    string `json:"amount"`
}

type EffectsPage struct {
	Embedded struct {
		Records []Effect
	} `json:"_embedded"`
}

type Effect struct {
	Type   string `json:"type"`
	Amount string `json:"amount"`
}
