package uidmap

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"strings"
	"testing"
)

func TestFindAndCheck(t *testing.T) {
	var findTests = []struct {
		uid      string
		username string
	}{
		{"0000919f77953a6961b086b579c3db00", "vladionescu"},
		{"008275e07f931b20807c3b81635c6300", "kobak"},
		{"23260c2ce19420f97b58d7d95b68ca00", "chris"},
		{"23157442436087ee8bcb46c5a193b119", "ZarathustraSpoke"},
		{"dbb165b7879fe7b1174df73bed0b9500", "max"},
		{"fffd6589590eaf361af59c6c22c05300", "SteveClement"},
		{"06eb0cf37180f36567a27bd4598ea700", "hicksfilosopher"},
		{"06ebf3277527fdebc08ab8f68c779100", "wileywiggins"},
		{"06ec3f699708c220e7b8126ab084d900", "pdg"},
		{"06ecc3c2bcbebae81187477e5e340800", "fletch"},
		{"06eeaa6bf23da490727dbc57852f2800", "svrist"},
		{"06f0c3aedcd6b8fc9656594108b32300", "peelr"},
		{"06f188a09ce38152f90a6f8353b08900", "jayholler"},
		{"06f19f7fd78c0d2ff5e8d91e5ae08600", "fredrikhegren"},
		{"06f2412ce9baadfc120739bec1664700", "dwradcliffe"},
		{"06f246cc34d13b7f23bb8a53547bb800", "oneofone"},
		{"eeeeeeeeeeeeeeeeeeeeeeeeeeeeee00", ""},
		{"11111111112222233334445556666719", ""},
	}

	for _, findTest := range findTests {
		uid, err := keybase1.UIDFromString(findTest.uid)
		if err != nil {
			t.Fatal(err)
		}
		found := findHardcoded(uid)
		expected := libkb.NewNormalizedUsername(findTest.username)
		if !found.Eq(expected) {
			t.Fatalf("Failure for %v: %s != %s", uid, expected, found)
		}
		if !expected.IsNil() && !checkUIDAgainstUsername(uid, expected) {
			t.Fatalf("UID mismatch for %v/%s", uid, expected)
		}
	}
}

func TestCheck(t *testing.T) {
	var checkTests = []struct {
		uid      string
		username string
	}{
		{"731f0ec12dfe99134c2932f629f85e19", "a_01586316d6"},
		{"a8ae731d2e7526902b4e2e08cda30419", "a_01f7ed84"},
		{"e6ccb1b0db5905a7c762365d1f182819", "a_02961df0"},
		{"f65191cb570c322d94503168a745ed19", "a_02aba774"},
		{"d1a22d4be0308c26937e2940cb99b719", "a_035eac44"},
		{"f1699a37800bfedf0902923804017319", "a_03ce8bdd"},
		{"e834498c7ad66c8d656ef9430ff9a519", "a_048efd0d"},
		{"f0d669b599df88fbce0bd4e070124e19", "a_054f0dd1"},
	}

	for _, checkTest := range checkTests {
		uid, err := keybase1.UIDFromString(checkTest.uid)
		if err != nil {
			t.Fatal(err)
		}
		username := libkb.NewNormalizedUsername(checkTest.username)
		if !checkUIDAgainstUsername(uid, username) {
			t.Fatalf("Failure for %v/%s", uid, username)
		}
		bad := libkb.NewNormalizedUsername("baaad")
		if checkUIDAgainstUsername(uid, bad) {
			t.Fatalf("Baddie failed: %v", uid)
		}
	}
	uid, err := keybase1.UIDFromString("06f246cc34d13b7f23bb8a53547bb800")
	if err != nil {
		t.Fatal(err)
	}
	username := libkb.NewNormalizedUsername("max")
	if checkUIDAgainstUsername(uid, username) {
		t.Fatal("Wanted a max failure")
	}
}

func TestUsernameSort(t *testing.T) {
	initUsernameSort()
	for i := 0; i < len(lengths)-1; i++ {
		require.True(t, strings.Compare(usernameAtSortedIndex(i), usernameAtSortedIndex(i+1)) < 0)
	}
}

func TestFindHardcodedUsernames(t *testing.T) {
	initUsernameSort()

	var findTests = []struct {
		uid      string
		username string
	}{
		{"0000919f77953a6961b086b579c3db00", "vladionescu"},
		{"008275e07f931b20807c3b81635c6300", "kobak"},
		{"23260c2ce19420f97b58d7d95b68ca00", "chris"},
		{"23157442436087ee8bcb46c5a193b119", "ZarathustraSpoke"},
		{"dbb165b7879fe7b1174df73bed0b9500", "max"},
		{"fffd6589590eaf361af59c6c22c05300", "SteveClement"},
		{"06eb0cf37180f36567a27bd4598ea700", "hicksfilosopher"},
		{"06ebf3277527fdebc08ab8f68c779100", "wileywiggins"},
		{"06ec3f699708c220e7b8126ab084d900", "pdg"},
		{"06ecc3c2bcbebae81187477e5e340800", "fletch"},
		{"06eeaa6bf23da490727dbc57852f2800", "svrist"},
		{"06f0c3aedcd6b8fc9656594108b32300", "peelr"},
		{"06f188a09ce38152f90a6f8353b08900", "jayholler"},
		{"06f19f7fd78c0d2ff5e8d91e5ae08600", "fredrikhegren"},
		{"06f2412ce9baadfc120739bec1664700", "dwradcliffe"},
		{"06f246cc34d13b7f23bb8a53547bb800", "oneofone"},
	}

	for _, findTest := range findTests {
		require.Equal(t, findHardcodedUsername(libkb.NewNormalizedUsername(findTest.username)), keybase1.UID(findTest.uid))
		require.True(t, findHardcodedUsername(libkb.NewNormalizedUsername(findTest.username+"xxyy")).IsNil())
	}
}
