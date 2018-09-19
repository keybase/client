// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type nsatest struct {
	in  string
	out keybase1.SocialAssertion
	ok  bool
}

var nsatests = []nsatest{
	{in: "keybase", out: keybase1.SocialAssertion{}, ok: false},
	{in: "alice@twitter", out: keybase1.SocialAssertion{User: "alice", Service: "twitter"}, ok: true},
	{in: "alice@twitter+bob@twitter", out: keybase1.SocialAssertion{}, ok: false},
	{in: "alice+bob@twitter", out: keybase1.SocialAssertion{}, ok: false},
	{in: "twitter:alice", out: keybase1.SocialAssertion{User: "alice", Service: "twitter"}, ok: true},
	{in: "Twitter:alice", out: keybase1.SocialAssertion{User: "alice", Service: "twitter"}, ok: true},
	{in: "twitter:Alice", out: keybase1.SocialAssertion{User: "alice", Service: "twitter"}, ok: true},
	{in: "AlicE@twitter", out: keybase1.SocialAssertion{User: "alice", Service: "twitter"}, ok: true},
	{in: "012345678901234567891@twitter", out: keybase1.SocialAssertion{}, ok: false},
	{in: "bob@foo@bar", out: keybase1.SocialAssertion{}, ok: false},
	{in: "foo:bar:bob", out: keybase1.SocialAssertion{}, ok: false},
	{in: "foo:bob@bar", out: keybase1.SocialAssertion{}, ok: false},
	{in: "BOB@github", out: keybase1.SocialAssertion{User: "bob", Service: "github"}, ok: true},
	{in: "BOB@hackernews", out: keybase1.SocialAssertion{User: "BOB", Service: "hackernews"}, ok: true},
	{in: "BOB@reddit", out: keybase1.SocialAssertion{User: "bob", Service: "reddit"}, ok: true},
	{in: "BOB@rooter", out: keybase1.SocialAssertion{User: "bob", Service: "rooter"}, ok: true},
	{in: "BOB@facebook", out: keybase1.SocialAssertion{User: "bob", Service: "facebook"}, ok: true},
	{in: "Akalin.Com@web", out: keybase1.SocialAssertion{User: "akalin.com", Service: "web"}, ok: true},
	{in: "alice@mastodon.SoCiAl", out: keybase1.SocialAssertion{User: "alice", Service: "mastodon.social"}, ok: true},
	{in: "alice@mastodon", out: keybase1.SocialAssertion{}, ok: false},
	{in: "sadtimes@nousers.notsocial", out: keybase1.SocialAssertion{}, ok: false},
}

func TestNormalizeSocialAssertion(t *testing.T) {
	tc := libkb.SetupTest(t, "NormalizeSocialAssertion", 1)
	for _, test := range nsatests {
		out, ok := NormalizeSocialAssertion(tc.G, test.in)

		require.Equal(t, test.out, out)
		require.Equal(t, test.ok, ok)
	}
}
