package terminalescaper

import (
	"bytes"
	"fmt"
	"testing"
)

var tests = map[string]string{

	// The vt100 escape character \033 (i.e. \x1b) is substituted with '^', even as part of escape sequence
	"\x1b":          "^",
	"aaa\x1b[3Gbbb": "aaa^[3Gbbb",
	"a\033[12laa":   "a^[12laa",
	// character movement
	"aaa\033[2Db":        "aaa^[2Db",
	"aaa\033[4D\033[2Cb": "aaa^[4D^[2Cb",
	// color
	"aaa \033[25;25mtest":                 "aaa ^[25;25mtest",
	"bbb \033]4;1;rgb:38/54/71\033\\test": "bbb ^]4;1;rgb:38/54/71^\\test",
	"ccc \033]4;1;rgb:38/54/71test":       "ccc ^]4;1;rgb:38/54/71test",

	// '\' and '/' are preserved
	"bbb\\raaa": "bbb\\raaa",
	"bbb/raaa":  "bbb/raaa",

	// newline and tab are preserved, even in combination with other escpae codes
	"\n":                 "\n",
	"\t":                 "\t",
	"bbb\naaa":           "bbb\naaa",
	"bbb\taaa":           "bbb\taaa",
	"b\naaa\b\b\033[4P":  "b\naaa^[4P",
	"x\naaa\b\b\033[2Ka": "x\naaa^[2Ka",

	// valid non ASCII characters
	"⌘":     "⌘",
	"⌘a\n⌘": "⌘a\n⌘",

	// backspace, carriage return and other similar special characters (except for \n, \t) are stripped out
	"aaa\b\bb":       "aaab",
	"aaa\b\b\033[1K": "aaa^[1K",
	"bbb\raaa":       "bbbaaa", //carriage return

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
