// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"strings"
	"testing"
)

func TestPaperKeyPhraseBasics(t *testing.T) {
	p, err := MakePaperKeyPhrase(0)
	if err != nil {
		t.Fatal(err)
	}
	q := NewPaperKeyPhrase(p.String())
	version, err := q.Version()
	if err != nil {
		t.Fatal(err)
	}
	if version != 0 {
		t.Errorf("version: %d, expected 0", version)
	}
}

func TestPaperKeyPhraseTypos(t *testing.T) {
	p, err := MakePaperKeyPhrase(0)
	if err != nil {
		t.Fatal(err)
	}

	equivs := []string{
		p.String(),
		"   " + p.String(),
		p.String() + "  ",
		" " + p.String() + " ",
		"\t" + p.String() + "  ",
		" " + p.String() + "\t",
		strings.Join(strings.Split(p.String(), " "), "   "),
		strings.ToTitle(p.String()),
		strings.ToUpper(p.String()),
	}

	for _, s := range equivs {
		q := NewPaperKeyPhrase(s)
		version, err := q.Version()
		if err != nil {
			t.Fatal(err)
		}
		if version != 0 {
			t.Errorf("input: %q => version: %d, expected 0", s, version)
		}
		if q.String() != p.String() {
			t.Errorf("input: %q => phrase %q, expected %q", s, q.String(), p.String())
		}
		if len(q.InvalidWords()) > 0 {
			t.Errorf("input: %q => phrase %q, contains invalid words %v", s, q.String(), q.InvalidWords())
		}
	}

	// make a typo in one of the words
	w := strings.Fields(p.String())
	w[0] = w[0] + "qx"
	x := strings.Join(w, " ")
	q := NewPaperKeyPhrase(x)

	// version should still be ok
	version, err := q.Version()
	if err != nil {
		t.Fatal(err)
	}
	if version != 0 {
		t.Errorf("input: %q => version: %d, expected 0", x, version)
	}

	// but InvalidWords should return the first word as invalid
	if len(q.InvalidWords()) == 0 {
		t.Fatalf("input: %q => all words valid, expected %s to be invalid", x, w[0])
	}

	if q.InvalidWords()[0] != w[0] {
		t.Errorf("input: %q => invalid words %v, expected %s", x, q.InvalidWords(), w[0])
	}
}
