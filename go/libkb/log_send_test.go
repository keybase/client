package libkb

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/keybase/client/go/logger"
)

func testTail(t *testing.T, testname, filename string, count, actual int, first, last string) {
	log := logger.NewTestLogger(t)
	tailed := tail(log, filename, count)
	lines := strings.Split(tailed, "\n")
	if len(lines) != actual {
		t.Errorf("test %s: tailed lines: %d, expected %d", testname, len(lines), actual)
	}

	if strings.TrimSpace(lines[0]) != first {
		t.Errorf("test %s: first line: %q, expected %q", testname, strings.TrimSpace(lines[0]), first)
	}
	if strings.TrimSpace(lines[len(lines)-1]) != last {
		t.Errorf("test %s: last line: %q, expected %q", testname, strings.TrimSpace(lines[len(lines)-1]), last)
	}

}

func TestTail(t *testing.T) {
	// file has 20k lines in it
	filename := filepath.Join("testfixtures", "longline.log")

	firstLine := "00000"
	firstLine10k := "10000"
	lastLine := "19999"

	testTail(t, "10k", filename, 10000, 10000, firstLine10k, lastLine)

	// asking for 100k lines should return 20k lines
	testTail(t, "100k", filename, 100000, 20000, firstLine, lastLine)
}
