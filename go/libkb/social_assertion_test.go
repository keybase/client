// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import "testing"

type nsatest struct {
	in  string
	out SocialAssertion
	ok  bool
}

var nsatests = []nsatest{
	{in: "keybase", out: "", ok: false},
	{in: "alice@twitter", out: "alice@twitter", ok: true},
	{in: "twitter:alice", out: "alice@twitter", ok: true},
	{in: "Twitter:alice", out: "alice@twitter", ok: true},
	{in: "twitter:Alice", out: "alice@twitter", ok: true},
	{in: "AlicE@twitter", out: "alice@twitter", ok: true},
	{in: "bob@foo@bar", out: "", ok: false},
	{in: "foo:bar:bob", out: "", ok: false},
	{in: "foo:bob@bar", out: "", ok: false},
	{in: "BOB@coinbase", out: "bob@coinbase", ok: true},
	{in: "BOB@github", out: "bob@github", ok: true},
	{in: "BOB@hackernews", out: "BOB@hackernews", ok: true},
	{in: "BOB@reddit", out: "bob@reddit", ok: true},
	{in: "BOB@rooter", out: "bob@rooter", ok: true},
	{in: "BOB@facebook", out: "", ok: false},
}

func TestNormalizeSocialAssertion(t *testing.T) {
	for _, test := range nsatests {
		out, ok := NormalizeSocialAssertion(test.in)

		if out != test.out {
			t.Errorf("%q => %q, expected %q", test.in, out, test.out)
		}
		if ok != test.ok {
			t.Errorf("%q => ok? %v, expected %v", test.in, ok, test.ok)
		}
	}
}
