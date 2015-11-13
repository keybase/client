// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package basex

import (
	"bytes"
	"errors"
	"io"
	"io/ioutil"
	// "reflect"
	"strings"
	"testing"
	"time"
)

type testpair struct {
	decoded, encoded string
}

var pairs = []testpair{
	// RFC 3548 examples
	{"\x14\xfb\x9c\x03\xd9\x7e", "3tBXhHeJK"},
	{"\x14\xfb\x9c\x03\xd9", "5jcJo1b"},
	{"\x14\xfb\x9c\x03", "5Hs84X"},

	// RFC 4648 examples
	{"", ""},
	{"f", "F5"},
	{"fo", "GbF"},
	{"foo", "Kz2Cw"},
	{"foob", "MwvLQ7"},
	{"fooba", "Q7brQYy"},
	{"foobar", "F5A5dYcFq"},

	// Wikipedia examples
	{"sure.", "T43Vrxb"},
	{"sure", "QcPCf1"},
	{"sur", "NQ1BM"},
	{"su", "JaD"},
	{"leasure.", "K8aUZhGUNaR"},
	{"easure.", "GNKF4KoojD"},
	{"asure.", "EPSm1BG31"},
	{"sure.", "T43Vrxb"},
}

type encodingTest struct {
	enc  *Encoding           // Encoding to test
	conv func(string) string // Reference string converter
}

// Do nothing to a reference base64 string (leave in standard format)
func stdRef(ref string) string {
	return ref
}

var encodingTests = []encodingTest{
	encodingTest{Base58StdEncoding, stdRef},
}

var bigtest = testpair{
	"Twas brillig, and the slithy toves",
	"GTsfDqyGri6QZNu9WnLkGjRiS7QNBXEEevahZWGXkQbz7Gs",
}

func testEqual(t *testing.T, msg string, args ...interface{}) bool {
	if args[len(args)-2] != args[len(args)-1] {
		t.Errorf(msg, args...)
		return false
	}
	return true
}

func TestEncode(t *testing.T) {
	for _, p := range pairs {
		for _, tt := range encodingTests {
			got := tt.enc.EncodeToString([]byte(p.decoded))
			testEqual(t, "Encode(%q) = %q, want %q", p.decoded,
				got, tt.conv(p.encoded))
		}
	}
}

func TestEncoder(t *testing.T) {
	for _, p := range pairs {
		bb := &bytes.Buffer{}
		encoder := NewEncoder(Base58StdEncoding, bb)
		encoder.Write([]byte(p.decoded))
		encoder.Close()
		testEqual(t, "Encode(%q) = %q, want %q", p.decoded, bb.String(), p.encoded)
	}
}

func TestEncoderBuffering(t *testing.T) {
	input := []byte(bigtest.decoded)
	for bs := 1; bs <= 12; bs++ {
		bb := &bytes.Buffer{}
		encoder := NewEncoder(Base58StdEncoding, bb)
		for pos := 0; pos < len(input); pos += bs {
			end := pos + bs
			if end > len(input) {
				end = len(input)
			}
			n, err := encoder.Write(input[pos:end])
			testEqual(t, "Write(%q) gave error %v, want %v", input[pos:end], err, error(nil))
			testEqual(t, "Write(%q) gave length %v, want %v", input[pos:end], n, end-pos)
		}
		err := encoder.Close()
		testEqual(t, "Close gave error %v, want %v", err, error(nil))
		testEqual(t, "Encoding/%d of %q = %q, want %q", bs, bigtest.decoded, bb.String(), bigtest.encoded)
	}
}

func TestDecode(t *testing.T) {
	for _, p := range pairs {
		for _, tt := range encodingTests {
			encoded := tt.conv(p.encoded)
			dbuf := make([]byte, tt.enc.DecodedLen(len(encoded)))
			count, err := tt.enc.Decode(dbuf, []byte(encoded))
			testEqual(t, "Decode(%q) = error %v, want %v", encoded, err, error(nil))
			testEqual(t, "Decode(%q) = length %v, want %v", encoded, count, len(p.decoded))
			testEqual(t, "Decode(%q) = %q, want %q", encoded, string(dbuf[0:count]), p.decoded)

			dbuf, err = tt.enc.DecodeString(encoded)
			testEqual(t, "DecodeString(%q) = error %v, want %v", encoded, err, error(nil))
			testEqual(t, "DecodeString(%q) = %q, want %q", string(dbuf), p.decoded)
		}
	}
}

func TestDecoder(t *testing.T) {
	for _, p := range pairs {
		decoder := NewDecoder(Base58StdEncoding, strings.NewReader(p.encoded))
		dbuf := make([]byte, Base58StdEncoding.DecodedLen(len(p.encoded)))
		count, err := decoder.Read(dbuf)
		if err != nil && err != io.EOF {
			t.Fatal("Read failed", err)
		}
		testEqual(t, "Read from %q = length %v, want %v", p.encoded, count, len(p.decoded))
		testEqual(t, "Decoding of %q = %q, want %q", p.encoded, string(dbuf[0:count]), p.decoded)
		if err != io.EOF {
			count, err = decoder.Read(dbuf)
		}
		testEqual(t, "Read from %q = %v, want %v", p.encoded, err, io.EOF)
	}
}

func TestDecoderBuffering(t *testing.T) {
	for bs := 1; bs <= 12; bs++ {
		decoder := NewDecoder(Base58StdEncoding, strings.NewReader(bigtest.encoded))
		buf := make([]byte, len(bigtest.decoded)+12)
		var total int
		for total = 0; total < len(bigtest.decoded); {
			n, err := decoder.Read(buf[total : total+bs])
			testEqual(t, "Read from %q at pos %d = %d, %v, want _, %v", bigtest.encoded, total, n, err, error(nil))
			total += n
		}
		testEqual(t, "Decoding/%d of %q = %q, want %q", bs, bigtest.encoded, string(buf[0:total]), bigtest.decoded)
	}
}

func TestBig(t *testing.T) {
	n := 3*1000 + 1
	raw := make([]byte, n)
	alpha := base58EncodeStd
	for i := 0; i < n || !Base58StdEncoding.IsValidEncodingLength(i); i++ {
		raw[i] = alpha[i%len(alpha)]
	}
	encoded := new(bytes.Buffer)
	w := NewEncoder(Base58StdEncoding, encoded)
	nn, err := w.Write(raw)
	if nn != n || err != nil {
		t.Fatalf("Encoder.Write(raw) = %d, %v want %d, nil", nn, err, n)
	}
	err = w.Close()
	if err != nil {
		t.Fatalf("Encoder.Close() = %v want nil", err)
	}
	decoded, err := ioutil.ReadAll(NewDecoder(Base58StdEncoding, encoded))
	if err != nil {
		t.Fatalf("ioutil.ReadAll(NewDecoder(...)): %v", err)
	}

	if !bytes.Equal(raw, decoded) {
		var i int
		for i = 0; i < len(decoded) && i < len(raw); i++ {
			if decoded[i] != raw[i] {
				break
			}
		}
		t.Errorf("Decode(Encode(%d-byte string)) failed at offset %d", n, i)
	}
}

func TestNewLineCharacters(t *testing.T) {
	// Each of these should decode to the string "sure", without errors.
	const expected = "sure"
	examples := []string{
		"QcPCf1",
		"QcPCf1\r",
		"QcPCf1\n",
		"QcPCf1\r\n",
		"QcPCf\r\n1",
		"QcP\rCf\n1",
		"QcP\nCf\r1",
		"QcPCf\n1",
	}
	for _, e := range examples {
		buf, err := Base58StdEncoding.DecodeString(e)
		if err != nil {
			t.Errorf("Decode(%q) failed: %v", e, err)
			continue
		}
		if s := string(buf); s != expected {
			t.Errorf("Decode(%q) = %q, want %q", e, s, expected)
		}
	}
}

type nextRead struct {
	n   int   // bytes to return
	err error // error to return
}

// faultInjectReader returns data from source, rate-limited
// and with the errors as written to nextc.
type faultInjectReader struct {
	source string
	nextc  <-chan nextRead
}

func (r *faultInjectReader) Read(p []byte) (int, error) {
	nr := <-r.nextc
	if len(p) > nr.n {
		p = p[:nr.n]
	}
	n := copy(p, r.source)
	r.source = r.source[n:]
	return n, nr.err
}

// tests that we don't ignore errors from our underlying reader
func TestDecoderIssue3577(t *testing.T) {
	next := make(chan nextRead, 10)
	wantErr := errors.New("my error")
	next <- nextRead{5, nil}
	next <- nextRead{10, wantErr}
	next <- nextRead{0, wantErr}
	d := NewDecoder(Base58StdEncoding, &faultInjectReader{
		source: "GTsfDqyGri6QZNu9WnLkGjRiS73vQ4n9xVSxpZfC6Rhd92z", // twas brillig...
		nextc:  next,
	})
	errc := make(chan error)
	go func() {
		_, err := ioutil.ReadAll(d)
		errc <- err
	}()
	select {
	case err := <-errc:
		if err != wantErr {
			t.Errorf("got error %v; want %v", err, wantErr)
		}
	case <-time.After(5 * time.Second):
		t.Errorf("timeout; Decoder blocked without returning an error")
	}
}

func TestDecoderIssue4779(t *testing.T) {
	encoded := `2eZ6Rr7LKz6psHNWSaSBaZwWXH11111NVDA1CEiTpmZ1gUf3BiVz1BfGRZL7
c2EYtFVTbY4iFnXAbE2712Ac7iiC2GqtpM5tB9QhDg8w1vDayRMGN53tyZg8
m2iLHiA3jXMnCwjoyQ3dH1Dt3Eiv2HHpjLyffJy4xE6r66RLiqMZKBgZHoBU
kSGT5h5u8TwLhBJbR12Jp3VQg4GAmY7X2rGRtKHhzPyZJihpEZoxaHKkxvC2
qBuQcXdcYzyb3m1SoGDcdaxiFytHW9YJG6BZEZ4P6dUPUy1xHmJdEUujZZwf
mz8Hmng2DWM7QikmjoyFrupsuaJ4XGKrduUn4AGDC59nRodJvQPyFKK1QiTb
quRtGVgp7yF2tkH9hmiCf8L6hQzk1bUDJi1uQ1Nf2dHYhQDgiJaXGNNyUadg
WneexNPxprSpukjfQY69dYgukbJtuzxhqhGCSAWnTSk9Sod27hKYeXyZLGAt
8WTsPahihtnoVh7mKBLxCsQwcjcqeMRWsS9gk3TR9noZz8U4EfoeQHtz3U7r
WhVgyLXtikm43aviyDgB8JaiLvpeU4UU7wUy7vCNwwKtakc7efG3rXrM2Ek5
aLuC52Se5QqFXdebutzcrCQ3VK8oW9dnwwqHAc3EhhgEjFvK847hRDTSjWAB
Dhv5sgJdK8VEJZAa1fg1HktVpUbgcrJ8qUEgbQ6kPWodGv9JhQcijUXhUw2N
rBaouiB6ogdoE7o75QXxuxRCtkoNdu8Mi6ntuj2KPcqqp6zPKX2XoSBaWsZT
WZNx6GyFanuHZUJEyE8hmZw4wpZnyG4wzG37PjvQitf5JB8k4pmuMjFp7KrZ
zdig783N8bxhzv5YfuUw1dvsVaeXbSyNc9x5S7ieTd6cNcrbhocJEr6cSbXU
AxA1fEUSk9Rq7izcR2mS8fKZHQP2jk55hHkrY9QMGyYFnQhDJq2LhAiJDfzu
XcAFA8jRXbNy8Ja6VVrzxttgesfK16STCZBYzT7SYVA1LhfmbX5SZ84JgqdE
QMbQoToAuRpfmWvM4FH
`
	encodedShort := strings.Replace(encoded, "\n", "", -1)

	dec := NewDecoder(Base58StdEncoding, strings.NewReader(encoded))
	res1, err := ioutil.ReadAll(dec)
	if err != nil {
		t.Errorf("ReadAll failed: %v", err)
	}

	dec = NewDecoder(Base58StdEncoding, strings.NewReader(encodedShort))
	var res2 []byte
	res2, err = ioutil.ReadAll(dec)
	if err != nil {
		t.Errorf("ReadAll failed: %v", err)
	}

	if !bytes.Equal(res1, res2) {
		t.Error("Decoded results not equal")
	}
}

func TestDecodeCorrupt(t *testing.T) {
	testCases := []struct {
		input  string
		offset int // -1 means no corruption.
	}{
		{"", -1},
		{"!!!!", 0},
		{"====", 0},
		{"x===", 1},
		{"=AAA", 0},
		{"A=AA", 1},
		{"AA=A", 2},
		{"A=", 1},
		{"A==", 1},
		{"A䦕==", 1},
	}
	for _, tc := range testCases {
		dbuf := make([]byte, Base58StdEncoding.DecodedLen(len(tc.input)))
		_, err := Base58StdEncodingStrict.Decode(dbuf, []byte(tc.input))
		if tc.offset == -1 {
			if err != nil {
				t.Error("Decoder wrongly detected coruption in", tc.input)
			}
			continue
		}
		switch err := err.(type) {
		case CorruptInputError:
			testEqual(t, "Corruption in %q at offset %v, want %v", tc.input, int(err), tc.offset)
		default:
			t.Error("Decoder failed to detect corruption in", tc)
		}
	}
}

func BenchmarkEncodeToString(b *testing.B) {
	data := make([]byte, 8192)
	b.SetBytes(int64(len(data)))
	for i := 0; i < b.N; i++ {
		Base58StdEncoding.EncodeToString(data)
	}
}

func BenchmarkDecodeString(b *testing.B) {
	data := Base58StdEncoding.EncodeToString(make([]byte, 8192))
	b.SetBytes(int64(len(data)))
	for i := 0; i < b.N; i++ {
		Base58StdEncoding.DecodeString(data)
	}
}
