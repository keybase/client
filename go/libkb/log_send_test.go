package libkb

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/keybase/client/go/logger"
)

func testTail(t *testing.T, testname, filename string, count, actual int, first, last string) {
	log := logger.NewTestLogger(t)
	tailed := tail(log, "tset", filename, count)
	lines := strings.Split(tailed, "\n")
	if len(tailed) != actual {
		t.Errorf("test %s: tailed bytes: %d, expected %d", testname, len(tailed), actual)
	}

	if strings.TrimSpace(lines[0]) != first {
		t.Errorf("test %s: first line: %q, expected %q", testname, strings.TrimSpace(lines[0]), first)
	}
	if strings.TrimSpace(lines[len(lines)-2]) != last {
		t.Errorf("test %s: last line: %q, expected %q", testname, strings.TrimSpace(lines[len(lines)-2]), last)
	}
	if strings.TrimSpace(lines[len(lines)-1]) != "" {
		t.Errorf("test %s: last line: %q, expected %q", testname, strings.TrimSpace(lines[len(lines)-1]), "")
	}

}

func TestTail(t *testing.T) {
	// file has 20k lines in it
	filename := filepath.Join("testfixtures", "longline.testlog")

	lastLine := "19999"

	testTail(t, "tail -c 1002", filename, 1002, 996, "19834", lastLine)
	testTail(t, "tail -c 100002", filename, 100002, 89994, "05001", lastLine)
	testTail(t, "tail -c 100002", filename, 100002, 89994, "05001", lastLine)
	testTail(t, "tail -c 250002", filename, 250002, 249999, "00179", lastLine)

}

func TestTailMulti(t *testing.T) {
	stem := filepath.Join("testfixtures", "f.testlog")
	testTail(t, "follow", stem, 100000, 99996, "13334", "29999")
	testTail(t, "follow", stem, 10000, 9996, "28334", "29999")
}
