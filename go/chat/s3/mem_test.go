package s3

import (
	"bytes"
	"crypto/sha256"
	"github.com/keybase/client/go/libkb"
	"strings"
	"testing"

	"golang.org/x/net/context"
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
		t.Fatal(err)
	}
	r, err := b.GetReader(context.TODO(), path)
	if err != nil {
		t.Fatal(err)
	}
	var buf bytes.Buffer
	n, err := buf.ReadFrom(r)
	if err != nil {
		t.Fatal(err)
	}
	if n != int64(len(content)) {
		t.Errorf("length: %d, expected %d", n, len(content))
	}
	s := buf.String()
	if s != content {
		t.Errorf("read data: %q, expected %q", s, content)
	}
}
