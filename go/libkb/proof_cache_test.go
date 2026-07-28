// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"testing"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestProofCacheGetForRequest(t *testing.T) {
	tc := SetupTest(t, "proof_cache_request", 0)
	defer tc.Cleanup()

	cache := NewProofCache(tc.G, 10)
	sid := keybase1.SigID("proof")
	pvlHash := keybase1.MerkleStoreKitHash("pvl")
	storedAt := time.Now()
	key := proofCacheRequestKey{
		mode:      ProofCheckerModeActive,
		apiURL:    "https://example.test/proof",
		checkText: "proof text",
	}
	cache.memPut(sid, CheckResult{
		Contextified: NewContextified(tc.G),
		Status:       NewProofError(keybase1.ProofStatus_HTTP_500, "temporary failure"),
		Time:         storedAt,
		PvlHash:      string(pvlHash),
		requestKey:   &key,
	})

	// A cache result must be strictly newer than the request. Equal timestamps
	// can occur with coarse clocks and do not prove that the check followed it.
	require.Nil(t, cache.getForRequest(sid, pvlHash, storedAt, key))

	got := cache.getForRequest(sid, pvlHash, storedAt.Add(-time.Nanosecond), key)
	require.NotNil(t, got)
	require.Equal(t, keybase1.ProofStatus_HTTP_500, got.Status.GetProofStatus())

	wrongMode := key
	wrongMode.mode = ProofCheckerModePassive
	require.Nil(t, cache.getForRequest(sid, pvlHash, storedAt.Add(-time.Nanosecond), wrongMode))

	wrongHint := key
	wrongHint.checkText = "different proof text"
	require.Nil(t, cache.getForRequest(sid, pvlHash, storedAt.Add(-time.Nanosecond), wrongHint))
	require.Nil(t, cache.getForRequest(sid, keybase1.MerkleStoreKitHash("other"), storedAt.Add(-time.Nanosecond), key))

	// The normal proof cache policy still rejects soft failures.
	require.Nil(t, cache.Get(sid, pvlHash))
}
