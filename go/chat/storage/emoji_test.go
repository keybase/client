package storage

import (
	"testing"

	"github.com/kyokomi/emoji/v2"
	"github.com/stretchr/testify/require"
)

// Notification text (desktop snippets, mobile push) is rendered with
// emoji.Sprintf while this package's init has cleared ReplacePadding.
func TestEmojiSprintShortcodes(t *testing.T) {
	cases := []struct {
		in, out string
	}{
		{":+1:", "\U0001f44d"},
		{":thumbsup:", "\U0001f44d"},
		{":tada:", "\U0001f389"},
		{":melting_face:", "\U0001fae0"},
		{":+1::skin-tone-3:", "\U0001f44d\U0001f3fc"},
		{":party-parrot:", ":party-parrot:"},
		{"reacted to your message with :tada:", "reacted to your message with \U0001f389"},
		{"meet at 12:30 ok", "meet at 12:30 ok"},
	}
	for _, c := range cases {
		require.Equal(t, c.out, emoji.Sprint(c.in), c.in)
		require.Equal(t, c.out, emoji.Sprintf("%v", c.in), c.in)
	}
}
