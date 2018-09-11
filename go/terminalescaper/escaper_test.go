package terminalescaper

import (
	"bytes"
	"fmt"
	"reflect"
	"testing"
	"unicode"
	"unsafe"
)

var tests = map[string]string{

	// The vt100 escape character \033 (i.e. \x1b) is substituted with '^', even as part of escape sequence
	"\x1b":          "^[",
	"aaa\x1b[3Gbbb": "aaa^[[3Gbbb",
	"a\033[12laa":   "a^[[12laa",
	// character movement
	"aaa\033[2Db":        "aaa^[[2Db",
	"aaa\033[4D\033[2Cb": "aaa^[[4D^[[2Cb",
	// color
	"aaa \033[25;25mtest":                 "aaa ^[[25;25mtest",
	"bbb \033]4;1;rgb:38/54/71\033\\test": "bbb ^[]4;1;rgb:38/54/71^[\\test",
	"ccc \033]4;1;rgb:38/54/71test":       "ccc ^[]4;1;rgb:38/54/71test",

	// '\' and '/' are preserved
	"bbb\\raaa": "bbb\\raaa",
	"bbb/raaa":  "bbb/raaa",

	// newline and tab are preserved, even in combination with other escpae codes
	"\n":                 "\n",
	"\t":                 "\t",
	"bbb\naaa":           "bbb\naaa",
	"bbb\taaa":           "bbb\taaa",
	"b\naaa\b\b\033[4P":  "b\naaa^[[4P",
	"x\naaa\b\b\033[2Ka": "x\naaa^[[2Ka",

	// valid non ASCII characters
	"⌘":     "⌘",
	"⌘a\n⌘": "⌘a\n⌘",

	// backspace, carriage return and other similar special characters (except for \n, \t) are stripped out
	"aaa\b\bb":       "aaab",
	"aaa\b\b\033[1K": "aaa^[[1K",
	"bbb\raaa":       "bbbaaa", //carriage return

	// Colors are acceptable, including multiple in the same string,
	"foo\x1b[30mbar": "foo\x1b[30mbar",

	// But non-color escapes should be escaped properly
	"fo\x1b[4Po\x1b[30mbarf\x1b[34moobarfo\x1b[0mobarfoobar\x1b312": "fo^[[4Po\x1b[30mbarf\x1b[34moobarfo\x1b[0mobarfoobar^[312",

	// Edge-cases with colors
	"foo\x1b[30mbar\x1b":         "foo\x1b[30mbar^[",
	"\x1bfoo\x1b[30mbar\x1b":     "^[foo\x1b[30mbar^[",
	"\x1bfoo\x1b[30mbar\x1b[36":  "^[foo\x1b[30mbar^[[36",
	"\x1bfoo\x1b[30mbar\x1b[36m": "^[foo\x1b[30mbar\x1b[36m",
}

func TestMain(t *testing.T) {
	for a, b := range tests {
		tmp := Clean(a)
		if tmp != b {
			t.Logf("Clean() failed: %#v -> %#v != %#v\n", a, tmp, b)
			t.Fail()
		}
	}
}

func TestWriter(t *testing.T) {
	var c bytes.Buffer
	w := &Writer{Writer: &c}

	for a, b := range tests {
		c.Reset()
		n, err := w.Write([]byte(a))
		if c.String() != b {
			t.Logf("Write failed: %#v -> %#v != %#v\n", a, c.String(), b)
			t.Fail()
		}
		if err != nil {
			t.Logf("Write for %#v failed: %#v \n", a, err)
			t.Fail()
		}
		if n != len([]byte(a)) {
			t.Logf("Write for %#v returned wrong length: %#v \n", a, n)
			t.Fail()
		}
	}
}

func TestWriterStopsOnErr(t *testing.T) {
	w := &Writer{Writer: &mockWriter{}}

	a := []byte("test")

	if n, err := w.Write(a); n != len(a) || err != nil {
		t.Logf("Write returned unexpected output: %#v, %#v \n", n, err)
		t.Fail()
	}

	// This write should fail, as the mock writer errors
	if n, err := w.Write(a); n != 0 || err == nil {
		t.Logf("Write returned unexpected output: %#v, %#v \n", n, err)
		t.Fail()
	}

	// This write should fail, even if the mock writer would allow it
	if n, err := w.Write(a); n != 0 || err == nil {
		t.Logf("Write returned unexpected output: %#v, %#v \n", n, err)
		t.Fail()
	}
}

// Allows even calls, errors on odd calls
type mockWriter struct {
	i int
}

func (m *mockWriter) Write(p []byte) (n int, err error) {
	if m.i == 0 {
		m.i++
		return len(p), nil
	}

	m.i--
	return 1, fmt.Errorf("error writing")
}

// Tests for the replace function are adapted from the ones for strings.Map

func tenRunes(ch rune) string {
	r := make([]rune, 10)
	for i := range r {
		r[i] = ch
	}
	return string(r)
}

// User-defined self-inverse mapping function
func rot13(r rune) rune {
	step := rune(13)
	if r >= 'a' && r <= 'z' {
		return ((r - 'a' + step) % 26) + 'a'
	}
	if r >= 'A' && r <= 'Z' {
		return ((r - 'A' + step) % 26) + 'A'
	}
	return r
}
func Test_replace(t *testing.T) {
	// Run a couple of awful growth/shrinkage tests
	a := tenRunes('a')
	// 1.  Grow. This triggers two reallocations in Map.
	maxRune := func(rune) rune { return unicode.MaxRune }
	m := replace(maxRune, a)
	expect := tenRunes(unicode.MaxRune)
	if m != expect {
		t.Errorf("growing: expected %q got %q", expect, m)
	}

	// 2. Shrink
	minRune := func(rune) rune { return 'a' }
	m = replace(minRune, tenRunes(unicode.MaxRune))
	expect = a
	if m != expect {
		t.Errorf("shrinking: expected %q got %q", expect, m)
	}

	// 3. Rot13
	m = replace(rot13, "a to zed")
	expect = "n gb mrq"
	if m != expect {
		t.Errorf("rot13: expected %q got %q", expect, m)
	}

	// 4. Rot13^2
	m = replace(rot13, replace(rot13, "a to zed"))
	expect = "a to zed"
	if m != expect {
		t.Errorf("rot13: expected %q got %q", expect, m)
	}

	// 5. Drop^[
	dropNotLatin := func(r rune) rune {
		if unicode.Is(unicode.Latin, r) {
			return r
		}
		return -2
	}
	m = replace(dropNotLatin, "Hello, 세계")
	expect = "Hello"
	if m != expect {
		t.Errorf("drop: expected %q got %q", expect, m)
	}

	// 6. Identity
	identity := func(r rune) rune {
		return r
	}
	orig := "Input string that we expect not to be copied."
	m = replace(identity, orig)
	if (*reflect.StringHeader)(unsafe.Pointer(&orig)).Data !=
		(*reflect.StringHeader)(unsafe.Pointer(&m)).Data {
		t.Error("unexpected copy during identity map")
	}

	// 7. Handle invalid UTF-8 sequence
	replaceNotLatin := func(r rune) rune {
		if unicode.Is(unicode.Latin, r) {
			return r
		}
		return '?'
	}
	m = replace(replaceNotLatin, "Hello\255World")
	expect = "Hello?World"
	if m != expect {
		t.Errorf("replace invalid sequence: expected %q got %q", expect, m)
	}

	// 8. Handle special case of -1 to '^['
	aToEscape := func(r rune) rune {
		if r == 'a' {
			return -1
		}
		return r
	}
	m = replace(aToEscape, "a")
	expect = "^["
	if m != expect {
		t.Errorf("Escaping: expected %q got %q", expect, m)
	}
	m = replace(aToEscape, "aa")
	expect = "^[^["
	if m != expect {
		t.Errorf("Escaping: expected %q got %q", expect, m)
	}
	m = replace(aToEscape, "abaaba")
	expect = "^[b^[^[b^["
	if m != expect {
		t.Errorf("Escaping: expected %q got %q", expect, m)
	}
}
