package acctbundle

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/stretchr/testify/require"
)

func TestInitialAccountBundle(t *testing.T) {
	b, err := NewInitialAccountBundle()
	require.NoError(t, err)
	require.NotNil(t, b)
	require.Len(t, b.signers, 1)
}

func TestBoxAccountBundle(t *testing.T) {
	b, err := NewInitialAccountBundle()
	require.NoError(t, err)
	require.NotNil(t, b)

	seed, gen := mkPuk(t, 1)
	boxed, err := b.Box(gen, seed)
	require.NoError(t, err)
	require.NotNil(t, boxed, "b.Box() should return something")
	require.Equal(t, stellar1.AccountBundleVersion_V1, boxed.FormatVersion, "should be V1")
	require.NotEmpty(t, boxed.EncB64)
	require.NotEmpty(t, boxed.VisB64)
	require.Equal(t, 1, boxed.Enc.V)
	require.NotEmpty(t, boxed.Enc.E)
	require.NotZero(t, boxed.Enc.N)
	require.Equal(t, gen, boxed.Enc.Gen)

	bundle, version := testDecodeAndUnbox(t, boxed.EncB64, boxed.VisB64, seed)
	require.NotNil(t, bundle)
	require.Equal(t, stellar1.AccountBundleVersion_V1, version)
	require.Len(t, bundle.Signers, 1)
	require.Equal(t, bundle.Signers[0], b.signers[0])
	require.Equal(t, stellar1.AccountMode_USER, bundle.Mode)
}

func testDecodeAndUnbox(t *testing.T, encB64 string, visB64 string, seed libkb.PerUserKeySeed) (stellar1.AccountBundle, stellar1.AccountBundleVersion) {
	encBundle, hash, err := decode(encB64)
	require.NoError(t, err)
	acctBundle, version, err := unbox(encBundle, hash, visB64, seed)
	require.NoError(t, err)
	return acctBundle, version
}

func mkPuk(t *testing.T, gen int) (libkb.PerUserKeySeed, keybase1.PerUserKeyGeneration) {
	puk, err := libkb.GeneratePerUserKeySeed()
	require.NoError(t, err)
	return puk, keybase1.PerUserKeyGeneration(gen)
}
