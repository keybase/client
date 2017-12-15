// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package basex

import (
	"crypto/rand"
	"encoding/base64"
	"testing"
)

func decode(strict bool, dst, src []byte) (int, error) {
	if strict {
		return Base58StdEncodingStrict.Decode(dst, src)
	}
	return Base58StdEncoding.Decode(dst, src)
}

func testTestVector(t *testing.T, name string, val string, strict bool, swizzler func([]byte) []byte) {
	raw, err := base64.StdEncoding.DecodeString(val)
	if err != nil {
		t.Fatalf("%s: %s", name, err)
	}
	b58 := make([]byte, Base58StdEncoding.EncodedLen(len(raw)))
	Base58StdEncoding.Encode(b58, raw)

	// Potentially add spaces or random control characters or whatever else..
	b58 = swizzler(b58)

	reenc := make([]byte, Base58StdEncoding.DecodedLen(len(b58)))
	n, err := decode(strict, reenc, b58)
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
		testTestVector(t, k, v, true, func(b []byte) []byte { return b })
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
		testTestVector(t, k, v, false, spacer)
	}
}

func testDecodeVector(t *testing.T, orig string, encoding string) {
	dec := make([]byte, Base58StdEncoding.DecodedLen(len(encoding)))
	n, err := Base58StdEncoding.Decode(dec, []byte(encoding))
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
		n, err := Base58StdEncoding.Decode(buf[:], []byte(b))
		if err == nil {
			t.Errorf("Should have failed to decode '%s' (got %v)", b, buf[0:n])
		}
	}
}

func BenchmarkDecodeBase62(b *testing.B) {
	r := make([]byte, 1024*1024*16) // 16 MB of data
	rand.Read(r)
	data := Base62StdEncoding.EncodeToString(r)
	b.ResetTimer()
	b.SetBytes(int64(len(data)))
	for i := 0; i < b.N; i++ {
		Base62StdEncoding.DecodeString(data)
	}
}
