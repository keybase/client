package main

import (
	"crypto/rand"
	"encoding/base32"
	"fmt"
	"github.com/ThomasRooney/gexpect"
	"os"
	"os/exec"
	"path"
	"strings"
	"testing"
)

// compileBinary compiles the keybase main binary via `go install`.  It installs
// it in the user's $GOPATH/bin, as per go standard.
func compileBinary() error {
	if prog, err := exec.LookPath("go"); err != nil {
		return err
	} else if out, err := exec.Command(prog, "install").CombinedOutput(); err != nil {
		return err
	} else {
		fmt.Printf("compiled `keybase` binary: %v\n", out)
	}
	return nil
}

// keybaseBinaryPath guesses where the above `go install` will install the
// keybase binary.
func keybaseBinaryPath() string {
	gopath := os.Getenv("GOPATH")
	binpath := path.Join(gopath, "bin", "keybase")
	return binpath
}

// TestMain runs test but first compiles/installs the keybase
// binary so that we can test it in the following tests.
func TestMain(m *testing.M) {
	if err := compileBinary(); err != nil {
		fmt.Printf("Error: %s\n", err.Error())
		os.Exit(2)
	}
	os.Exit(m.Run())
}

// user is a fake test user, who has a name, email and passphrase
// all derived from a random 6-byte base32-encoded string.
type user struct {
	name       string
	email      string
	passphrase string
}

// randomBase32 makes a random base32-string, with trailing `=` padding
// all stripped.
func randomBase32(t *testing.T, l int) string {
	buf := make([]byte, l, l)
	_, err := rand.Read(buf)
	if err != nil {
		t.Fatalf("Random error: %v\n", err)
		return ""
	}
	return strings.Replace(base32.StdEncoding.EncodeToString(buf), "=", "", -1)
}

// newUser creates a new test user, generating their email, username
// and passphrase
func newUser(t *testing.T) *user {
	stem := randomBase32(t, 6)
	return &user{
		name:       "u_" + stem,
		email:      ("test+" + stem + "@test.keybase.io"),
		passphrase: ("pp " + stem + stem),
	}
}

// makeHome creates a new home directory for this user, and returns where
// it is, so that our keybase command-line can use it during tests.
func (u user) makeHome(t *testing.T) string {
	p := path.Join(".", "scratch", "home", u.name)
	err := os.MkdirAll(p, 0755)
	if err != nil {
		t.Fatalf("Error in MkdirAll %s: %v", p, err)
	}
	return p
}

// expectCmd is a wrapper around the ExpectSubprocess command. It's
// a thin wrapper, but tries to call Fatal on the testing.T object
// rather than erroring out.
type expectCmd struct {
	es *gexpect.ExpectSubprocess
}

// newExpectCmd creates a new Expect command out of the given argument
// strings.  We can then interact with the command as per normal expect,
// but one difference is that any failures become fatal on the supplied
// testing.T object.
func (u user) newExpectCmd(t *testing.T, args ...string) *expectCmd {
	cmd := []string{
		keybaseBinaryPath(),
		"--standalone",
		"-H",
		u.makeHome(t),
	}
	cmd = append(cmd, args...)
	es, err := gexpect.Spawn(strings.Join(cmd, " "))
	if err != nil {
		t.Fatalf("Error spwaning %v: %v", cmd, err)
	}
	return &expectCmd{es}
}

// expect a given string on standard output
func (c expectCmd) expect(t *testing.T, s string) {
	err := c.es.Expect(s)
	if err != nil {
		t.Fatalf("In waiting for '%s': %v", s, err)
	}
}

// wait until the process ends
func (c expectCmd) wait() {
	c.es.Wait()
}

// interact with the subprocess, piping input and output with expect and
// SendLine
func (c expectCmd) interact() {
	c.es.Interact()
}

// close off all work with this subprocess.
func (c expectCmd) close() {
	c.es.Close()
}

// TestVersion tests the trivial version subcommand
func TestVersion(t *testing.T) {
	u := newUser(t)
	cmd := u.newExpectCmd(t, "version")
	cmd.expect(t, "Keybase Command-Line App")
	cmd.expect(t, "- Visit https://keybase.io for more details")
	cmd.interact()
	cmd.wait()
	cmd.close()
	return
}
