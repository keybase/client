package xdr

import (
	"sort"
)

// SortSignersByKey returns a new []Signer array sorted by signer key.
func SortSignersByKey(signers []Signer) []Signer {
	keys := make([]string, 0, len(signers))
	keysMap := make(map[string]Signer)
	newSigners := make([]Signer, 0, len(signers))

	for _, signer := range signers {
		key := signer.Key.Address()
		keys = append(keys, key)
		keysMap[key] = signer
	}

	sort.Strings(keys)

	for _, key := range keys {
		newSigners = append(newSigners, keysMap[key])
	}

	return newSigners
}
