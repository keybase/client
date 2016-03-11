// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import "testing"

type cntest struct {
	in  string
	out string
	err bool
}

var cntests = []cntest{
	{in: "hi", out: "hi"},
	{in: "Patrick", out: "patrick"},
	{in: "patrick,max", out: "max,patrick"},
	{in: "alice@twitter,bob", out: "alice@twitter,bob"},
	{in: "twitter:alice,bob", out: "alice@twitter,bob"},
	{in: "bob,alice@twitter", out: "alice@twitter,bob"},
	{in: "bob,twitter:alice", out: "alice@twitter,bob"},
	{in: "BOB,Twitter:alice", out: "alice@twitter,bob"},
	{in: "bob+", out: "", err: true},
	{in: "bob/", out: "", err: true},
	{in: "bob@foo@bar", out: "", err: true},
	{in: "foo:bar:bob", out: "", err: true},
	{in: "foo:bob@bar", out: "", err: true},
	{in: "charlie,bob,alice", out: "alice,bob,charlie"},
	{in: "BOB@coinbase", out: "bob@coinbase"},
	{in: "BOB@github", out: "bob@github"},
	{in: "BOB@hackernews", out: "BOB@hackernews"},
	{in: "BOB@reddit", out: "bob@reddit"},
	{in: "BOB@rooter", out: "bob@rooter"},
}

func TestCanonicalizeName(t *testing.T) {
	for _, test := range cntests {
		out, err := CanonicalizeName(test.in)

		if out != test.out {
			t.Errorf("%q => %q, expected %q", test.in, out, test.out)
		}
		if (err != nil) != test.err {
			t.Errorf("%q => error? %v, expected %v", test.in, (err != nil), test.err)
		}
	}
}
