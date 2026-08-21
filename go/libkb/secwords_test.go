// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSecWordList(t *testing.T) {
	words, err := SecWordList(65)
	require.NoError(t, err)
	t.Logf("words: %v", words)
	require.Len(t, words, 6, "# words = %d, expected 6", len(words))
}

func TestSecWordList128(t *testing.T) {
	words, err := SecWordList(128)
	require.NoError(t, err)
	t.Logf("words: %v", words)
	require.Len(t, words, 12, "# words = %d, expected 12", len(words))
}

func TestSecWordList144(t *testing.T) {
	words, err := SecWordList(144)
	require.NoError(t, err)
	t.Logf("words: %v", words)
	require.Len(t, words, 14, "# words = %d, expected 14", len(words))
}

func TestSecWordListConstants(t *testing.T) {
	words, err := SecWordList(PaperKeySecretEntropy + PaperKeyIDBits + PaperKeyVersionBits)
	require.NoError(t, err)
	require.Len(t, words, PaperKeyWordCountMin, "paper key words for constants: %d, expected %d", len(words), PaperKeyWordCountMin)
}
