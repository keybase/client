package libkb

import "testing"

func TestSecWordList(t *testing.T) {
	words, err := SecWordList(65)
	if err != nil {
		t.Fatal(err)
	}
	if len(words) != 5 {
		t.Errorf("# words = %d, expected 5", len(words))
	}
}
