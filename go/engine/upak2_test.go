package engine

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestExportAllIncarnationsAfterReset(t *testing.T) {
	// One context for user that will be doing LoadUser, and another
	// for user that will sign up and reset itself.
	tc := SetupEngineTest(t, "clu")
	defer tc.Cleanup()

	resetUserTC := SetupEngineTest(t, "clu2")
	defer resetUserTC.Cleanup()

	// The first version of this user has just a PGP key. We'll assert that
	// that's reflected in the export at the end.
	t.Logf("create new user")
	fu := createFakeUserWithPGPOnly(t, resetUserTC)

	// Reset this user's account.
	ResetAccount(resetUserTC, fu)

	// Now provision it with regular device keys, and no PGP key.
	fu.LoginOrBust(resetUserTC)
	if err := AssertProvisioned(resetUserTC); err != nil {
		require.NoError(t, err)
	}

	arg := libkb.NewLoadUserByNameArg(tc.G, fu.Username)
	u, err := libkb.LoadUser(arg)
	require.NoError(t, err)

	exported, err := u.ExportToUPKV2AllIncarnations()
	require.NoError(t, err)

	require.Len(t, exported.PastIncarnations, 1, "Expected exactly 1 past incarnation, found %d", len(exported.PastIncarnations))

	current := exported.Current
	past := exported.PastIncarnations[0]

	// Check that the current user has device keys and no PGP key.
	require.Empty(t, current.PGPKeys, "Expected exactly 0 PGP keys in the current incarnation, found %d", len(current.PGPKeys))
	require.Len(t, current.DeviceKeys, 2, "Expected exactly 2 device keys in the current incarnation, found %d", len(current.DeviceKeys))

	// Check that the past version of the user has a PGP key but no device keys.
	require.Len(t, past.PGPKeys, 1, "Expected exactly 1 PGP key in the past incarnation, found %d", len(past.PGPKeys))
	require.Empty(t, past.DeviceKeys, "Expected exactly 0 device keys in the past incarnation, found %d", len(past.DeviceKeys))

	// Make sure the timestamps on keys are exported properly.
	for _, key := range current.DeviceKeys {
		userKeyInfo := u.GetComputedKeyInfos().Infos[key.Base.Kid]
		t1 := keybase1.FromTime(key.Base.CTime)
		t2 := time.Unix(userKeyInfo.CTime, 0)
		require.True(t, t1.Equal(t2),
			"exported key ctime is not equal: %s != %s", t1, t2)
	}

	// Make sure all the chain links made it into the link IDs list.
	require.Len(t, exported.SeqnoLinkIDs, int(u.GetSigChainLastKnownSeqno()), "expected SeqnoLinkIDs to be len %d but found %d", u.GetSigChainLastKnownSeqno(), len(exported.SeqnoLinkIDs))
	// Make sure all seqnos are present.
	for seqno := 1; seqno <= len(exported.SeqnoLinkIDs); seqno++ {
		linkID, ok := exported.SeqnoLinkIDs[keybase1.Seqno(seqno)]
		require.True(t, ok,
			"seqno %d missing from link IDs map", seqno)
		require.NotEmpty(t, linkID, "found empty LinkID at seqno %d, that's pretty weird", seqno)
	}

	// Make sure the eldest key has delegation info populated correctly.
	foundEldest := false
	for _, key := range exported.Current.DeviceKeys {
		if !key.Base.IsEldest {
			continue
		}
		require.False(t, foundEldest,
			"found a second eldest key?!")
		foundEldest = true
		require.False(t, key.Base.Provisioning.Time.IsZero(),
			"eldest key provisioning info appears uninitialized")
	}

	require.Nil(t, current.Reset)
	reset := past.Reset
	require.NotNil(t, reset)
	require.Equal(t, reset.ResetSeqno, keybase1.Seqno(1))
	require.True(t, reset.Ctime > keybase1.UnixTime(1419826703))
	require.True(t, reset.MerkleRoot.Seqno > keybase1.Seqno(0))
	require.Equal(t, reset.Type, keybase1.ResetType_RESET)
	require.Equal(t, reset.EldestSeqno, keybase1.Seqno(1))

	// Test libkb.FindNextMerkleRootAfterReset --- in this case, the next merkle root
	// in the sequence should be the right one.
	m := NewMetaContextForTest(tc)
	fnmrArg := keybase1.FindNextMerkleRootAfterResetArg{
		Uid:        u.GetUID(),
		ResetSeqno: keybase1.Seqno(1),
		Prev:       reset.MerkleRoot,
	}
	res, err := libkb.FindNextMerkleRootAfterReset(m, fnmrArg)
	require.NoError(t, err)
	require.NotNil(t, res.Res)
	require.True(t, res.Res.Seqno > reset.MerkleRoot.Seqno)

	// While we're here, also check that UPK v1 has the right reset summaries.
	upk1, err := libkb.LoadUserPlusKeys(context.TODO(), tc.G, fu.UID(), keybase1.KID(""))
	require.NoError(t, err)
	require.Equal(t, len(upk1.Resets), 1)
	require.Equal(t, upk1.Resets[0].EldestSeqno, keybase1.Seqno(1))
	require.Equal(t, upk1.Resets[0].Type, keybase1.ResetType_RESET)
}
