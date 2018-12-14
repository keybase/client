package xdr

import "fmt"

// EntryType is a helper to get at the entry type for a change.
func (change *LedgerEntryChange) EntryType() LedgerEntryType {
	return change.LedgerKey().Type
}

// LedgerKey returns the key for the ledger entry that was changed
// in `change`.
func (change *LedgerEntryChange) LedgerKey() LedgerKey {
	switch change.Type {
	case LedgerEntryChangeTypeLedgerEntryCreated:
		change := change.MustCreated()
		return change.LedgerKey()
	case LedgerEntryChangeTypeLedgerEntryRemoved:
		return change.MustRemoved()
	case LedgerEntryChangeTypeLedgerEntryUpdated:
		change := change.MustUpdated()
		return change.LedgerKey()
	case LedgerEntryChangeTypeLedgerEntryState:
		change := change.MustState()
		return change.LedgerKey()
	default:
		panic(fmt.Errorf("Unknown change type: %v", change.Type))
	}
}
