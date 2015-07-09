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
