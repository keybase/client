// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"testing"
)

func TestParseIdentity(t *testing.T) {
	for i, identLine := range inputIdentLines {
		expected := expectedIdentities[i]
		identity, err := ParseIdentity(identLine)
		if err != nil {
			t.Errorf("error parsing identity: %s", err)
		} else {
			if *identity != expected {
				t.Errorf("identity differs from expected\n%s\n%s", identity, expected)
			}
		}
	}
}

var inputIdentLines = [...]string{
	`Barb Akew <barb@example.com>`,
	`Barb Akew (bbq) <barb@example.com>`,
	`"Barb Akew" (bbq) <barb@example.com>`,
	`Barb Akew (b"b"q) <barb@example.com>`,
	`"Barb Akew (bbq)" <barb@example.com>`,
	`x/Barb <barb@example.com>`,
	`Barb Akew (co<mme>nt)`,
	`Barb`,
}

var expectedIdentities = [...]Identity{
	{"Barb Akew", "", "barb@example.com"},
	{"Barb Akew", "bbq", "barb@example.com"},
	{"Barb Akew", "bbq", "barb@example.com"},
	{"Barb Akew", `b"b"q`, "barb@example.com"},
	{"Barb Akew", "bbq", "barb@example.com"},
	{"x/Barb", "", "barb@example.com"},
	{"Barb Akew", "co<mme>nt", ""},
	{"Barb", "", ""},
}
