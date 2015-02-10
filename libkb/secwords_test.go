package libkb

import (
	"fmt"
	"testing"
)

func TestSecWordList(t *testing.T) {
	words, err := SecWordList(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(words) != 10 {
		t.Errorf("# words = %d, expected 10", len(words))
	}
	fmt.Printf("words: %v\n", words)
}
