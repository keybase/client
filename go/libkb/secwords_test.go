package libkb

import (
	"testing"
)

func TestSecWordList(t *testing.T) {
	words, err := SecWordList(65)
	if err != nil {
		t.Fatal(err)
	}
	G.Log.Info("words: %v", words)
	if len(words) != 6 {
		t.Errorf("# words = %d, expected 5", len(words))
	}
}
