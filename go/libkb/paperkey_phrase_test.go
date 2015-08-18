package libkb

import "testing"

func TestPaperKeyPhrase(t *testing.T) {
	p, err := MakePaperKeyPhrase(0)
	if err != nil {
		t.Fatal(err)
	}
	q := NewPaperKeyPhrase(p.String())
	if q.Version() != 0 {
		t.Errorf("version: %d, expected 0", q.Version())
	}
}
