package libkb

import (
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/nacl/secretbox"
)

func TestSplitCiphertextRejectsShortInput(t *testing.T) {
	for length := range 24 + secretbox.Overhead {
		data, nonce, err := splitCiphertext(make([]byte, length))
		require.Error(t, err, "length %d", length)
		require.Nil(t, data, "length %d", length)
		require.Nil(t, nonce, "length %d", length)
	}
}
