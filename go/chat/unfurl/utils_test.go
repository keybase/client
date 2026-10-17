package unfurl

import (
	"testing"

	"github.com/keybase/client/go/chat/types"
	"github.com/stretchr/testify/require"
)

func TestNormalizeDomain(t *testing.T) {
	good := []struct{ in, want string }{
		{"foo.com", "foo.com"},
		{"www.foo.co.uk", "foo.co.uk"},
		{"https://www.foo.co.uk/path", "foo.co.uk"},
		{"HTTPS://WWW.Foo.com/x", "foo.com"},
		{" foo.com ", "foo.com"},
		{"192.168.1.1", "192.168.1.1"},
	}
	for _, tc := range good {
		got, err := NormalizeDomain(tc.in)
		require.NoError(t, err, tc.in)
		require.Equal(t, tc.want, got, tc.in)
	}
	for _, in := range []string{"", "not a domain", "giphy.com", "https://giphy.com/x", types.MapsDomain} {
		_, err := NormalizeDomain(in)
		require.Error(t, err, in)
	}
}
