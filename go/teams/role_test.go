package teams

import (
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestRoleOrder(t *testing.T) {
	require.Len(t, keybase1.TeamRoleMap, 5, "you added a new role. Does the IsOrAbove relation still work?")
	n := keybase1.TeamRole_NONE
	r := keybase1.TeamRole_READER
	w := keybase1.TeamRole_WRITER
	a := keybase1.TeamRole_ADMIN
	o := keybase1.TeamRole_OWNER

	require.Equal(t, false, n.IsReaderOrAbove())
	require.Equal(t, true, r.IsReaderOrAbove())
	require.Equal(t, true, w.IsReaderOrAbove())
	require.Equal(t, true, a.IsReaderOrAbove())
	require.Equal(t, true, o.IsReaderOrAbove())

	require.Equal(t, false, n.IsAdminOrAbove())
	require.Equal(t, false, r.IsAdminOrAbove())
	require.Equal(t, false, w.IsAdminOrAbove())
	require.Equal(t, true, a.IsAdminOrAbove())
	require.Equal(t, true, o.IsAdminOrAbove())

	order := func(r1, r2 keybase1.TeamRole) {
		require.Equal(t, true, r2.IsOrAbove(r1))
		require.Equal(t, false, r1.IsOrAbove(r2))
	}
	// spot check
	order(n, r)
	order(n, w)
	order(n, a)
	order(n, o)
	order(r, a)
	order(r, o)
	order(w, o)
	order(w, a)
}
