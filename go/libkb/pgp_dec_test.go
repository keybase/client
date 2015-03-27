package libkb

import (
	"strings"
	"testing"
)

func TestPGPDecryptBasic(t *testing.T) {
	tc := SetupTest(t, "pgp_encrypt")
	defer tc.Cleanup()
	keyA, err := tc.MakePGPKey("keya@keybase.io")
	if err != nil {
		t.Fatal(err)
	}
	keyB, err := tc.MakePGPKey("keyb@keybase.io")
	if err != nil {
		t.Fatal(err)
	}

	mid := NewBufferCloser()
	msg := "Is it time for lunch?"
	recipients := []*PgpKeyBundle{keyA, keyB}
	if err := PGPEncrypt(strings.NewReader(msg), mid, nil, recipients); err != nil {
		t.Fatal(err)
	}

	out := NewBufferCloser()
	if _, err := PGPDecryptWithBundles(mid, out, recipients); err != nil {
		t.Fatal(err)
	}

	dec := string(out.Bytes())
	if dec != msg {
		t.Errorf("decoded: %q, expected %q", dec, msg)
	}
}
