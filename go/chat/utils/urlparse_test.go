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
	}
	for _, c := range cases {
		res := DecorateWithURLs(context.TODO(), c.body)
		require.Equal(t, c.result, res)
	}
}
