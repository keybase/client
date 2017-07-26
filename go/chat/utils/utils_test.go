package utils

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestParseDurationExtended(t *testing.T) {
	test := func(input string, expected time.Duration) {
		d, err := ParseDurationExtended(input)
		if err != nil {
			t.Fatal(err)
		}
		if d != expected {
			t.Fatalf("wrong parsed duration. Expected %v, got %v\n", expected, d)
		}
	}
	test("1d", time.Hour*24)
	test("123d12h2ns", 123*24*time.Hour+12*time.Hour+2*time.Nanosecond)
}

func TestParseAtMentionsNames(t *testing.T) {
	text := "@chat_1e2263952c @9mike hello! @mike From @chat_5511c5e0ce. @ksjdskj 889@ds8 @_dskdjs @k1"
	matches := ParseAtMentionsNames(context.TODO(), text)
	expected := []string{"chat_1e2263952c", "mike", "chat_5511c5e0ce", "ksjdskj", "k1"}
	require.Equal(t, expected, matches)
	text = "@mike@jim"
	matches = ParseAtMentionsNames(context.TODO(), text)
	expected = []string{"mike"}
	require.Equal(t, expected, matches)
}
