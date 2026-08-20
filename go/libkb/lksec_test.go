package libkb

import (
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/nacl/secretbox"
)

func TestSplitCiphertextRejectsShortInput(t *testing.T) {
	for length := 0; length < 24+secretbox.Overhead; length++ {
		data, nonce, err := splitCiphertext(make([]byte, length))
		require.Error(t, err, "length %d", length)
		require.Nil(t, data, "length %d", length)
		require.Nil(t, nonce, "length %d", length)
	}
}
