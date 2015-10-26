package base58

import (
	"encoding/base64"
	"testing"
)

func testTestVector(t *testing.T, name string, val string, swizzler func([]byte) []byte) {
	raw, err := base64.StdEncoding.DecodeString(val)
	if err != nil {
		t.Fatalf("%s: %s", name, err)
	}
	b58 := make([]byte, StdEncoding.EncodedLen(len(raw)))
	StdEncoding.Encode(b58, raw)

	// Potentially add spaces or random control characters or whatever else..
	b58 = swizzler(b58)

	reenc := make([]byte, StdEncoding.DecodedLen(len(b58)))
	n, err := StdEncoding.Decode(reenc, b58)
	if err != nil {
		t.Fatalf("%s: %s", name, err)
	}
	out := base64.StdEncoding.EncodeToString(reenc[0:n])
	if out != val {
		t.Fatalf("%s: mismatch: %s != %s", name, out, val)
	}
}

func TestVectors1(t *testing.T) {
	for k, v := range testEncodeVectors1 {
		testTestVector(t, k, v, func(b []byte) []byte { return b })
	}
}

func TestVectorsSpacer(t *testing.T) {
	spacer := func(s []byte) []byte {
		var out []byte
		for i, c := range s {
			if i%5 == 0 {
				out = append(out, ' ')
			}
			out = append(out, c)
		}
		return out
	}

	for k, v := range testEncodeVectors1 {
		testTestVector(t, k, v, spacer)
	}
}

func testDecodeVector(t *testing.T, orig string, encoding string) {
	dec := make([]byte, StdEncoding.DecodedLen(len(encoding)))
	n, err := StdEncoding.Decode(dec, []byte(encoding))
	if err != nil {
		t.Fatalf("%s: %s", orig, err)
	}
	decBase64 := base64.StdEncoding.EncodeToString(dec[0:n])
	if decBase64 != orig {
		t.Errorf("%s != %s", decBase64, orig)
	}
}

func TestDecodeVectors(t *testing.T) {
	for orig, encoding := range testDecodeVectors1 {
		testDecodeVector(t, orig, encoding)
	}
}

func TestBadEncodings(t *testing.T) {
	badEncodings := []string{
		"1",
		"B",
		"1111",
		"BBBB",
		"11111111",
		"BBBBBBBB",
	}
	var buf [100]byte
	for _, b := range badEncodings {
		n, err := StdEncoding.Decode(buf[:], []byte(b))
		if err == nil {
			t.Errorf("Should have failed to decode '%s' (got %v)", b, buf[0:n])
		}
	}
}
