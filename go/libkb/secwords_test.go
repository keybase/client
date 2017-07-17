// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"testing"
)

func TestSecWordList(t *testing.T) {
	words, err := SecWordList(65)
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("words: %v", words)
	if len(words) != 6 {
		t.Errorf("# words = %d, expected 6", len(words))
	}
}

func TestSecWordList128(t *testing.T) {
	words, err := SecWordList(128)
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("words: %v", words)
	if len(words) != 12 {
		t.Errorf("# words = %d, expected 12", len(words))
	}
}

func TestSecWordList144(t *testing.T) {
	words, err := SecWordList(144)
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("words: %v", words)
	if len(words) != 14 {
		t.Errorf("# words = %d, expected 14", len(words))
	}
}

func TestSecWordListConstants(t *testing.T) {
	words, err := SecWordList(PaperKeySecretEntropy + PaperKeyIDBits + PaperKeyVersionBits)
	if err != nil {
		t.Fatal(err)
	}
	if len(words) != PaperKeyWordCountMin {
		t.Errorf("paper key words for constants: %d, expected %d", len(words), PaperKeyWordCountMin)
	}
}
