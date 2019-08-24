// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
//
// +build !production

package saltpackkeystest

import (
	"encoding/hex"
	"testing"

	"github.com/keybase/saltpack"
)

// MockPseudonymResolver resolver returns nil for all the pseudonyms requested unless otherwise instructed
// by the AddPseudonym method. It does not make any network requests to the server.
type MockPseudonymResolver struct {
	T       *testing.T
	pnymMap map[[32]byte](*saltpack.SymmetricKey)
}

var _ saltpack.SymmetricKeyResolver = (*MockPseudonymResolver)(nil)

func (r *MockPseudonymResolver) ResolveKeys(identifiers [][]byte) ([]*saltpack.SymmetricKey, error) {
	var pnyms []string
	var keys []*saltpack.SymmetricKey

	for _, psBytes := range identifiers {
		pnyms = append(pnyms, hex.EncodeToString(psBytes))
		var pnym [32]byte
		copy(pnym[:], psBytes)
		if key, found := r.pnymMap[pnym]; found {
			keys = append(keys, key)
		} else {
			keys = append(keys, nil)
		}
	}
	r.T.Logf("MockPseudonymResolver called on input: %+v", pnyms)
	return keys, nil
}

func (r *MockPseudonymResolver) AddPseudonym(pnym [32]byte, key *saltpack.SymmetricKey) {
	r.T.Logf("MockPseudonymResolver: adding pnym %s, key %s", hex.EncodeToString(pnym[:]), hex.EncodeToString(key[:]))
	r.pnymMap[pnym] = key
}

func NewMockPseudonymResolver(t *testing.T) saltpack.SymmetricKeyResolver {
	return &MockPseudonymResolver{
		T:       t,
		pnymMap: make(map[[32]byte](*saltpack.SymmetricKey)),
	}
}
