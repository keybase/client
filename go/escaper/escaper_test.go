package escaper

import (
	"testing"
)

var tests = map[string]string{

	"hi man\x1b[3Gdude": "hi man\\x1b[3Gdude",

	// basic escape
	"a\033[12laa": "a\\x1b[12laa",

	// backspace and clear
	"aaa\b\bb":       "aaa\\b\\bb",
	"aaa\b\b\033[1K": "aaa\\b\\b\\x1b[1K",

	// character movement
	"aaa\033[2Db":        "aaa\\x1b[2Db",
	"aaa\033[4D\033[2Cb": "aaa\\x1b[4D\\x1b[2Cb",

	// color
	"aaa \033[25;25mtest":                 "aaa \\x1b[25;25mtest",
	"bbb \033]4;1;rgb:38/54/71\033\\test": "bbb \\x1b]4;1;rgb:38/54/71\\x1b\\\\test",
	"ccc \033]4;1;rgb:38/54/71test":       "ccc \\x1b]4;1;rgb:38/54/71test",

	// newline is preserved
	"bbb\naaa":           "bbb\naaa",
	"b\naaa\b\b\033[4P":  "b\naaa\\b\\b\\x1b[4P",
	"x\naaa\b\b\033[2Ka": "x\naaa\\b\\b\\x1b[2Ka",

	// carriage return
	"bbb\raaa": "bbb\\raaa",

	// non ASCII chars
	"⌘":     "⌘",
	"⌘a\n⌘": "⌘a\n⌘",
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
