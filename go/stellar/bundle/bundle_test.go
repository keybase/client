package bundle

import (
	"testing"

	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/stretchr/testify/require"
)

func TestSetMobileOnly(t *testing.T) {
	b, err := NewInitialBundle()
	require.NoError(t, err)
	require.Len(t, b.Accounts, 1)
	require.Equal(t, b.Accounts[0].Mode, stellar1.AccountMode_USER)

	err = SetMobileOnly(&b, b.Accounts[0].AccountID)
	require.NoError(t, err)
	require.Equal(t, b.Accounts[0].Mode, stellar1.AccountMode_MOBILE)
}
