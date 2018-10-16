package bundle

import (
	"testing"

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
}
