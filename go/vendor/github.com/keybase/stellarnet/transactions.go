package stellarnet

// Transaction contains the TransactionEmbed from the
// horizon transactions endpoint and all the operations
// for the transaction.
type Transaction struct {
	Internal   TransactionEmbed
	Operations []Operation
}
