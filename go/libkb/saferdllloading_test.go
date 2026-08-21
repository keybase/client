package libkb

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSaferDLLLoading(t *testing.T) {
	err := SaferDLLLoading()
	require.NoError(t, err, "SaferDLLLoading error:", err)
}
