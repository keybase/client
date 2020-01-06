package xdr

// Operations is a helper on TransactionMeta that returns operations
// meta from `TransactionMeta.Operations` or `TransactionMeta.V1.Operations`.
func (transactionMeta *TransactionMeta) OperationsMeta() []OperationMeta {
	operations, ok := transactionMeta.GetOperations()
	if ok {
		return operations
	}

	return transactionMeta.MustV1().Operations
}
