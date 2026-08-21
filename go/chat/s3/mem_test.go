package s3

import (
	"bytes"
	"context"
	"crypto/sha256"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

type ptsign struct{}

func (p *ptsign) Sign(payload []byte) ([]byte, error) {
	s := sha256.Sum256(payload)
	return s[:], nil
}

func TestMemPut(t *testing.T) {
	tc := libkb.SetupTest(t, "team", 1)
	defer tc.Cleanup()

	m := &Mem{}
	c := m.New(tc.G, &ptsign{}, Region{})
	b := c.Bucket("bucket-1")
	path := "abc/def"
	content := "bucket content"
	if err := b.PutReader(context.TODO(), path, strings.NewReader(content), int64(len(content)), "string", Private, Options{}); err != nil {
		require.NoError(t, err)
	}
	r, err := b.GetReader(context.TODO(), path)
	require.NoError(t, err)
	var buf bytes.Buffer
	n, err := buf.ReadFrom(r)
	require.NoError(t, err)
	if n != int64(len(content)) {
		require.Failf(t, "", "length: %d, expected %d", n, len(content))
	}
	s := buf.String()
	if s != content {
		require.Failf(t, "", "read data: %q, expected %q", s, content)
	}
}
