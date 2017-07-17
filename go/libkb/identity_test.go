// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"testing"
)

func TestParseIdentity(t *testing.T) {
	for _, idents := range sampleIdentities {
		checkIdentity(t, idents.input, idents.expected)
	}
}

func checkIdentity(t *testing.T, input string, expected Identity) {
	identity, err := ParseIdentity(input)
	if err != nil {
		t.Errorf("error parsing identity: %s", err)
	} else {
		if *identity != expected {
			t.Errorf("identity differs from expected\n%s\n%s", identity, expected)
		}
	}
}

var sampleIdentities = []struct {
	input    string
	expected Identity
}{
	{`Barb Akew <barb@example.com>`,
		Identity{"Barb Akew", "", "barb@example.com"}},
	{`Barb Akew (bbq) <barb@example.com>`,
		Identity{"Barb Akew", "bbq", "barb@example.com"}},
	{`"Barb Akew" (bbq) <barb@example.com>`,
		Identity{"Barb Akew", "bbq", "barb@example.com"}},
	{`Barb Akew (b"b"q) <barb@example.com>`,
		Identity{"Barb Akew", `b"b"q`, "barb@example.com"}},
	{`"Barb Akew (bbq)" <barb@example.com>`,
		Identity{"Barb Akew", "bbq", "barb@example.com"}},
	{`x/Barb <barb@example.com>`,
		Identity{"x/Barb", "", "barb@example.com"}},
	{`Barb Akew (co<mme>nt)`,
		Identity{"Barb Akew", "co<mme>nt", ""}},
	{`Barb Akew (the "new" key)`,
		Identity{"Barb Akew", `the "new" key`, ""}},
	{`Barb`,
		Identity{"Barb", "", ""}},
}
