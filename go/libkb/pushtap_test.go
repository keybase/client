package libkb

import (
	"context"
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// The cases are the table the client used to carry (deep-link-emitter.test.ts),
// kept so the destination a tap opens did not change when the mapping moved
// here.
func TestResolvePushTap(t *testing.T) {
	route := func(url, uid string) *keybase1.PushTapRoute {
		return &keybase1.PushTapRoute{Url: url, TargetUID: uid}
	}
	cases := []struct {
		name    string
		payload string
		want    *keybase1.PushTapRoute
	}{
		{
			"chat with account", `{"type":"chat.newmessage","convID":"0000ab","uid":"u1"}`,
			route("keybase://convid/0000ab", "u1"),
		},
		{
			"chat without account", `{"type":"chat.newmessage","convID":"0000ab"}`,
			route("keybase://convid/0000ab", ""),
		},
		{"chat without conversation", `{"type":"chat.newmessage"}`, nil},
		{
			"apns chat with numbers and aps",
			`{"type":"chat.newmessage","convID":"0000ab","uid":"u1","t":1,"aps":{"alert":{"body":"hi"}}}`,
			route("keybase://convid/0000ab", "u1"),
		},
		{
			"a numeric convID becomes a string", `{"type":"chat.newmessage","convID":1234}`,
			route("keybase://convid/1234", ""),
		},
		{
			"the uid is kept verbatim", `{"type":"chat.newmessage","convID":"0000ab","uid":"u 1&x"}`,
			route("keybase://convid/0000ab", "u 1&x"),
		},
		{
			"follow with uid", `{"type":"follow","username":"testuser","uid":"u1"}`,
			route("keybase://profile/show/testuser", "u1"),
		},
		{
			"follow with targetUID", `{"type":"follow","username":"testuser","targetUID":"u2"}`,
			route("keybase://profile/show/testuser", "u2"),
		},
		{"follow without username", `{"type":"follow","uid":"u1"}`, nil},
		{
			"new device", `{"type":"device.new","uid":"u1","device_id":"d1"}`,
			route("keybase://devices", "u1"),
		},
		{"revoked device without account", `{"type":"device.revoked","device_id":"d1"}`, nil},
		{
			"contacts joined", `{"message":"Your contact testuser joined Keybase"}`,
			route("keybase://tabs.peopleTab", ""),
		},
		{"read receipt", `{"type":"chat.readmessage","b":0,"message":"Your contact x"}`, nil},
		{"silent chat", `{"type":"chat.newmessageSilent_2","c":"0000ab"}`, nil},
		{"autoreset", `{"type":"autoreset","uid":"u1"}`, nil},
		{"failed pending", `{"type":"chat.failedpending","convID":"0000ab","uid":""}`, nil},
		{"an unknown type opens nothing", `{"type":"something.new","uid":"u1"}`, nil},
		{"not json", `not json`, nil},
		{"json that is not an object", `"just a string"`, nil},
		{"json with trailing garbage", `{"type":"chat.newmessage","convID":"0000ab"} x`, nil},
		{
			"a conversation id is escaped into the URL",
			`{"type":"chat.newmessage","convID":"a/b c&d"}`,
			route("keybase://convid/a%2Fb%20c%26d", ""),
		},
		{
			"a username is escaped into the URL",
			`{"type":"follow","username":"a b/c"}`,
			route("keybase://profile/show/a%20b%2Fc", ""),
		},
		{"a non-string message is not a contact push", `{"message":1}`, nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := ResolvePushTap(tc.payload)
			if tc.want == nil {
				require.False(t, ok)
				require.Equal(t, keybase1.PushTapRoute{}, got)
				return
			}
			require.True(t, ok)
			require.Equal(t, *tc.want, got)
		})
	}
}

// encodeURIComponent's escape set is what keeps a URL built here identical to
// the one the client used to build, so the marks JavaScript leaves alone are
// pinned rather than assumed.
func TestEncodeURIComponent(t *testing.T) {
	require.Equal(t, "-_.!~*'()", encodeURIComponent("-_.!~*'()"))
	require.Equal(t, "abcXYZ019", encodeURIComponent("abcXYZ019"))
	require.Equal(t, "%20%2B%2F%3F%23%26%3D%25", encodeURIComponent(" +/?#&=%"))
	require.Equal(t, "%E2%9C%93", encodeURIComponent("✓"))
	require.Empty(t, encodeURIComponent(""))
}

func TestPendingPushTapPeekIsNotDestructive(t *testing.T) {
	tc := SetupTest(t, "pushtap", 1)
	defer tc.Cleanup()
	g := tc.G
	ctx := context.Background()

	require.Nil(t, g.PendingPushTap.Peek())

	g.PendingPushTap.Set(ctx, keybase1.PushTapRoute{Url: "keybase://convid/0000ab", TargetUID: "u1"})
	first := g.PendingPushTap.Peek()
	require.NotNil(t, first)
	require.Equal(t, "keybase://convid/0000ab", first.Url)
	require.NotZero(t, first.Id, "Set stamps an id")

	// The peek that never reached the client -- or whose reply did not come back --
	// must leave the tap where it was, or the tap is gone with nothing to say so.
	again := g.PendingPushTap.Peek()
	require.Equal(t, first, again)

	require.True(t, g.PendingPushTap.Ack(first.Id))
	require.Nil(t, g.PendingPushTap.Peek(), "the ack retired it")
	require.False(t, g.PendingPushTap.Ack(first.Id), "nothing left to retire")
}

func TestPendingPushTapAckDoesNotRetireANewerTap(t *testing.T) {
	tc := SetupTest(t, "pushtap", 1)
	defer tc.Cleanup()
	g := tc.G
	ctx := context.Background()

	g.PendingPushTap.Set(ctx, keybase1.PushTapRoute{Url: "keybase://convid/0000ab"})
	stale := g.PendingPushTap.Peek()
	require.NotNil(t, stale)

	// A tap not yet acked is replaced rather than queued: the newest tap is the
	// one the user just made.
	g.PendingPushTap.Set(ctx, keybase1.PushTapRoute{Url: "keybase://devices", TargetUID: "u2"})
	newer := g.PendingPushTap.Peek()
	require.NotNil(t, newer)
	require.Equal(t, "keybase://devices", newer.Url)
	require.NotEqual(t, stale.Id, newer.Id)

	// The ack for the tap it replaced was already in flight; it must not take the
	// newer one with it.
	require.False(t, g.PendingPushTap.Ack(stale.Id))
	require.Equal(t, newer, g.PendingPushTap.Peek())

	require.True(t, g.PendingPushTap.Ack(newer.Id))
	require.Nil(t, g.PendingPushTap.Peek())
}
