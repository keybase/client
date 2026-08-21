package teams

import (
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestRoleOrder(t *testing.T) {
	require.Len(t, keybase1.TeamRoleMap, 7, "you added a new role. Does the IsOrAbove relation still work?")
	n := keybase1.TeamRole_NONE
	rb := keybase1.TeamRole_RESTRICTEDBOT
	b := keybase1.TeamRole_BOT
	r := keybase1.TeamRole_READER
	w := keybase1.TeamRole_WRITER
	a := keybase1.TeamRole_ADMIN
	o := keybase1.TeamRole_OWNER

	require.False(t, n.IsReaderOrAbove())
	require.False(t, rb.IsReaderOrAbove())
	require.False(t, b.IsReaderOrAbove())
	require.True(t, r.IsReaderOrAbove())
	require.True(t, w.IsReaderOrAbove())
	require.True(t, a.IsReaderOrAbove())
	require.True(t, o.IsReaderOrAbove())

	require.False(t, n.IsAdminOrAbove())
	require.False(t, rb.IsAdminOrAbove())
	require.False(t, b.IsAdminOrAbove())
	require.False(t, r.IsAdminOrAbove())
	require.False(t, w.IsAdminOrAbove())
	require.True(t, a.IsAdminOrAbove())
	require.True(t, o.IsAdminOrAbove())

	order := func(r1, r2 keybase1.TeamRole) {
		require.True(t, r2.IsOrAbove(r1))
		require.False(t, r1.IsOrAbove(r2))
	}
	// spot check
	order(n, rb)
	order(n, b)
	order(n, r)
	order(n, w)
	order(n, a)
	order(n, o)

	order(rb, b)
	order(rb, r)
	order(rb, w)
	order(rb, a)
	order(rb, o)

	order(b, r)
	order(b, w)
	order(b, a)
	order(b, o)

	order(r, w)
	order(r, a)
	order(r, o)

	order(w, o)
	order(w, a)
}
