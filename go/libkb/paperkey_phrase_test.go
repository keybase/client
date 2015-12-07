// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import "testing"

func TestPaperKeyPhrase(t *testing.T) {
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
