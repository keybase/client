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
	{in: "keybase", out: SocialAssertion{}, ok: false},
	{in: "alice@twitter", out: SocialAssertion{username: "alice", service: "twitter"}, ok: true},
	{in: "twitter:alice", out: SocialAssertion{username: "alice", service: "twitter"}, ok: true},
	{in: "Twitter:alice", out: SocialAssertion{username: "alice", service: "twitter"}, ok: true},
	{in: "twitter:Alice", out: SocialAssertion{username: "alice", service: "twitter"}, ok: true},
	{in: "AlicE@twitter", out: SocialAssertion{username: "alice", service: "twitter"}, ok: true},
	{in: "bob@foo@bar", out: SocialAssertion{}, ok: false},
	{in: "foo:bar:bob", out: SocialAssertion{}, ok: false},
	{in: "foo:bob@bar", out: SocialAssertion{}, ok: false},
	{in: "BOB@coinbase", out: SocialAssertion{username: "bob", service: "coinbase"}, ok: true},
	{in: "BOB@github", out: SocialAssertion{username: "bob", service: "github"}, ok: true},
	{in: "BOB@hackernews", out: SocialAssertion{username: "BOB", service: "hackernews"}, ok: true},
	{in: "BOB@reddit", out: SocialAssertion{username: "bob", service: "reddit"}, ok: true},
	{in: "BOB@rooter", out: SocialAssertion{username: "bob", service: "rooter"}, ok: true},
	{in: "BOB@facebook", out: SocialAssertion{}, ok: false},
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
