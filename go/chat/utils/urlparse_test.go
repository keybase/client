package utils

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

type urlDecorateTest struct {
	body   string
	result string
}

func TestDecorateURLs(t *testing.T) {
	cases := []urlDecorateTest{
		urlDecorateTest{
			body:   "you should checkout google.com",
			result: "you should checkout $>kb${\"typ\":1,\"url\":{\"text\":\"google.com\",\"url\":\"https://google.com\"}}$<kb$",
		},
		urlDecorateTest{
			body:   "Jan 17 20:37:58 ws-0.localdomain app.iced",
			result: "Jan 17 20:37:58 ws-0.localdomain app.iced",
		},
		urlDecorateTest{
			body:   "hello jack-testing.keybase.io",
			result: "hello $>kb${\"typ\":1,\"url\":{\"text\":\"jack-testing.keybase.io\",\"url\":\"https://jack-testing.keybase.io\"}}$<kb$",
		},
		urlDecorateTest{
			body:   "parens wikipedia.org/wiki/John_McLean_(Illinois_politician).",
			result: "parens $>kb${\"typ\":1,\"url\":{\"text\":\"wikipedia.org/wiki/John_McLean_(Illinois_politician)\",\"url\":\"https://wikipedia.org/wiki/John_McLean_(Illinois_politician)\"}}$<kb$.",
		},
	}
	for _, c := range cases {
		res := DecorateWithURLs(context.TODO(), c.body)
		require.Equal(t, c.result, res)
	}
}
