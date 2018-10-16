package bundle

import (
	"testing"

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
}
