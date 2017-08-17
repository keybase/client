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
