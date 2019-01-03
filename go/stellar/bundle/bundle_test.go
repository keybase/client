package bundle

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestInitialBundle makes sure we can make a brand-new account bundle
// with a new random secret.
func TestInitialBundle(t *testing.T) {
	b, err := NewInitial("hello")
	require.NoError(t, err)
	require.NotNil(t, b)
	require.Len(t, b.Accounts, 1)
	require.Len(t, b.AccountBundles, 1)
}
