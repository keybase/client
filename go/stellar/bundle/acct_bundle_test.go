package bundle

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAccountBundle(t *testing.T) {
	b, err := NewInitialAccountBundle()
	require.NoError(t, err)
	require.NotNil(t, b)
}
