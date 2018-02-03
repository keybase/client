package teams

import (
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestTeamNameFromString(t *testing.T) {
	cases := []struct {
		str      string
		ok       bool
		implicit bool
	}{
		{"", false, false},
		{"a", false, false},
		{"a.", false, false},
		{"aaaa.", false, false},
		{"aaaa.bbbbb.", false, false},
		{".aaaa", false, false},
		{"aaaaaaaaaaaaaaaaaaaaaaaaaaaaa", false, false},

		{"aaa.bbb.ccc", true, false},
		{"aaa.ccc", true, false},
		{"__keybase_implicit_team__", false, false},
		{"__keybase_implicit_team__.x", false, false},
		{"__keybase_implicit_team__9f6d31062cf8efbca45f9b193b24d724", true, true},
		{"__keybase_implicit_team__bbbb26367512347c55154f14d436fb8b", true, true},
		{"__keybase_implicit_team_", false, true},
		{"__keybase_implicit_team__", false, true},
		{"__keybase_implicit_team___", false, true},
		{"__keybase_implicit_team__bbbb26367512347c55154f14d436fb8", false, true},  // too short
		{"__keybase_implicit_team__bbbb26367512347c55154f14d436fb8z", false, true}, // non-hex
	}

	for i, c := range cases {
		t.Logf("--> [%v] %+v", i, c)
		name, err := keybase1.TeamNameFromString(c.str)
		if c.ok {
			require.NoError(t, err)
		} else {
			require.Error(t, err)
			continue
		}
		require.True(t, len(name.Parts) > 0)
		require.Equal(t, c.str, name.String())
		require.Equal(t, c.implicit, name.IsImplicit())
	}
}

func TestParseImplicitTeamBackingName(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	badNames := []string{
		"__keybase_implicit_team__",
		"__keybase_implicit_team__12345678901234567801234567890q",
		"__keybase_implicit_team__12345678901234567801234567890",
	}
	for _, badName := range badNames {
		_, err := keybase1.TeamNameFromString(badName)
		require.Error(t, err)
	}
	goodName := "__keybase_implicit_team__0123456789abcdef0123456789abcdef"
	name, err := keybase1.TeamNameFromString(goodName)
	require.NoError(t, err)
	require.Equal(t, string(name.Parts[0]), "__keybase_implicit_team__0123456789abcdef0123456789abcdef")
}

func TestIsAncestorOf(t *testing.T) {
	test := func(a, b string) bool {
		aName, err := keybase1.TeamNameFromString(a)
		require.NoError(t, err)
		bName, err := keybase1.TeamNameFromString(b)
		require.NoError(t, err)
		return aName.IsAncestorOf(bName)
	}

	require.True(t, test("aaa", "aaa.bbb"))
	require.True(t, test("aaa", "aaa.bbb.ccc"))
	require.False(t, test("ccc", "aaa.bbb"))

	require.True(t, test("aaa.bbb", "aaa.bbb.ccc"))

	require.False(t, test("aaa.bbb.ccc", "aaa.bbb.ccc"))
	require.False(t, test("aaa.bbb.ccc", "aaa.bbb"))
}
