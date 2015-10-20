package client

import (
	"bytes"
	"strings"
	"testing"

	"github.com/keybase/client/go/libcmdline"
)

func helpLines(buf bytes.Buffer) []string {
	lines := strings.Split(strings.TrimSpace(string(buf.Bytes())), "\n")
	last := lines[len(lines)-1]
	// this last help command line is problematic
	if strings.HasPrefix(strings.TrimSpace(last), "help") {
		lines = lines[0 : len(lines)-1]
	}
	return lines
}

func helpFilter(buf bytes.Buffer) string {
	lines := helpLines(buf)
	return strings.Join(lines, "\n")
}

func TestHelp(t *testing.T) {
	cl := libcmdline.NewCommandLine(true, GetExtraFlags())
	var buf bytes.Buffer
	cl.SetOutputWriter(&buf)
	cl.AddCommands(GetCommands(cl, G))
	cmd, err := cl.Parse(strings.Fields("keybase pgp help"))
	if err != nil {
		t.Fatal(err)
	}
	if cmd != nil {
		t.Fatalf("expected nil command, got %T", cmd)
	}
}

// test that `keybase pgp help`, `keybase help pgp`, `keybase pgp` output the
// same thing.
func TestParentHelp(t *testing.T) {
	cl := libcmdline.NewCommandLine(true, GetExtraFlags())
	var buf1 bytes.Buffer
	cl.SetOutputWriter(&buf1)
	cl.AddCommands(GetCommands(cl, G))

	cmd, err := cl.Parse(strings.Fields("keybase pgp help"))
	if err != nil {
		t.Fatal(err)
	}
	if cmd != nil {
		t.Fatalf("expected nil command, got %T", cmd)
	}
	help1 := helpFilter(buf1)

	var buf2 bytes.Buffer
	cl.SetOutputWriter(&buf2)
	cmd, err = cl.Parse(strings.Fields("keybase help pgp"))
	if err != nil {
		t.Fatal(err)
	}
	if cmd != nil {
		t.Fatalf("expected nil command, got %T", cmd)
	}
	help2 := helpFilter(buf2)

	if help1 != help2 {
		t.Errorf("`keybase pgp help` and `keybase help pgp` output differed")
	}

	var buf3 bytes.Buffer
	cl.SetOutputWriter(&buf3)
	cmd, err = cl.Parse(strings.Fields("keybase pgp"))
	if err != nil {
		t.Fatal(err)
	}
	if cmd != nil {
		t.Fatalf("expected nil command, got %T", cmd)
	}
	help3 := helpFilter(buf3)

	if help1 != help3 {
		t.Errorf("`keybase pgp help` and `keybase pgp` output differed")
	}

	if help2 != help3 {
		t.Errorf("`keybase help pgp` and `keybase pgp` output differed")
	}

	t.Logf("keybase pgp help:\n%s\n\n", help1)
	t.Logf("keybase help pgp:\n%s\n\n", help2)
	t.Logf("keybase pgp:\n%s\n\n", help3)
}
