package libkb

import (
	"encoding/hex"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewPerUserKeySecretBox(t *testing.T) {
	// Test a roundtrip

	seed := PerUserKeySeed([32]byte{1, 2, 2})
	seed[31] = 9
	key := NaclSecretBoxKey([32]byte{5, 6, 7, 8})

	// seal
	secretbox, err := newPerUserKeyPrev(seed, key)
	require.NoError(t, err)
	t.Logf("seed: %v", hex.EncodeToString(seed[:]))
	t.Logf("key : %v", hex.EncodeToString(key[:]))
	t.Logf("sb  : %v", secretbox)

	// open
	seedOut, err := openPerUserKeyPrev(string(secretbox), key)
	require.NoError(t, err)
	t.Logf("seed expected: %T %v", seed, seed)
	t.Logf("seed   result: %T %v", seedOut, seedOut)
	require.Equal(t, seed, seedOut)
}

func TestNewPerUserKeySecretBox2(t *testing.T) {
	// Test opening a canned one

	expectedSeed, err := hex.DecodeString("7c13fbe503aa2f79970e43eeb832820cfbf67ee4298ae5345ffe19cc1048bdee")
	require.NoError(t, err)
	key1, err := hex.DecodeString("29e48abe7de0da83023ee5741c2a8959624325f2e6b8ed2c96caf676d05d7cda")
	key := MakeByte32(key1)
	require.NoError(t, err)

	sb := "kwG4BAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAA2gAwWiGRZRwucAYHVQ4xJAX9Zn7F5WfnjOmjBd3n\nxkpS8xUFQhjmQRXAfUadTNqY5TU7\n"

	seed, err := openPerUserKeyPrev(sb, key)
	require.NoError(t, err)
	require.Equal(t, PerUserKeySeed(MakeByte32(expectedSeed)), seed)
}
