package basic

import (
	"bytes"
	"crypto/rand"
	"reflect"
	"runtime"
	"strings"
	"testing"

	"github.com/keybase/saltpack"
)

func runTestOverVersions(t *testing.T, f func(t *testing.T, version saltpack.Version)) {
	for _, version := range saltpack.KnownVersions() {
		version := version // capture range variable.
		t.Run(version.String(), func(t *testing.T) {
			f(t, version)
		})
	}
}

// runTestsOverVersions runs the given list of test functions over all
// versions to test. prefix should be the common prefix for all the
// test function names, and the names of the subtest will be taken to
// be the strings after that prefix. Example use:
//
// func TestFoo(t *testing.T) {
//      tests := []func(*testing.T, Version){
//              testFooBar1,
//              testFooBar2,
//              testFooBar3,
//              ...
//      }
//      runTestsOverVersions(t, "testFoo", tests)
// }
//
// This is copied from ../common_test.go.
func runTestsOverVersions(t *testing.T, prefix string, fs []func(t *testing.T, ver saltpack.Version)) {
	for _, f := range fs {
		f := f // capture range variable.
		name := runtime.FuncForPC(reflect.ValueOf(f).Pointer()).Name()
		i := strings.LastIndex(name, prefix)
		if i >= 0 {
			i += len(prefix)
		} else {
			i = 0
		}
		name = name[i:]
		t.Run(name, func(t *testing.T) {
			runTestOverVersions(t, f)
		})
	}
}

func randomMsg(t *testing.T, sz int) []byte {
	out := make([]byte, sz)
	if _, err := rand.Read(out); err != nil {
		t.Fatal(err)
	}
	return out
}

func testBasicBox(t *testing.T, version saltpack.Version) {
	kr := NewKeyring()
	k1, err := kr.GenerateBoxKey()
	if err != nil {
		t.Fatal(err)
	}
	k2, err := kr.GenerateBoxKey()
	if err != nil {
		t.Fatal(err)
	}
	msg := randomMsg(t, 1024)
	text, err := saltpack.EncryptArmor62Seal(version, msg, k1, []saltpack.BoxPublicKey{k2.GetPublicKey()}, "")
	if err != nil {
		t.Fatal(err)
	}
	_, msg2, _, err := saltpack.Dearmor62DecryptOpen(saltpack.SingleVersionValidator(version), text, kr)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(msg, msg2) {
		t.Fatal("failed to recover message")
	}
}

func testBasicSign(t *testing.T, version saltpack.Version) {
	kr := NewKeyring()
	k1, err := kr.GenerateSigningKey()
	if err != nil {
		t.Fatal(err)
	}
	msg := randomMsg(t, 1024)
	sig, err := saltpack.SignArmor62(version, msg, k1, "")
	if err != nil {
		t.Fatal(err)
	}
	pk, msg2, _, err := saltpack.Dearmor62Verify(saltpack.SingleVersionValidator(version), sig, kr)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(msg, msg2) {
		t.Fatal("msg payload mismatch")
	}
	if !saltpack.PublicKeyEqual(k1.GetPublicKey(), pk) {
		t.Fatal("public signing key wasn't right")
	}
}

func TestKeyBasic(t *testing.T) {
	tests := []func(*testing.T, saltpack.Version){
		testBasicBox,
		testBasicSign,
	}
	runTestsOverVersions(t, "testBasic", tests)
}
