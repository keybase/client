package escaper

import (
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
