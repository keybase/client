package engine

import (
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
		t.Fatal(err)
	}

	arg := libkb.NewLoadUserByNameArg(tc.G, fu.Username)
	u, err := libkb.LoadUser(arg)
	require.NoError(t, err)

	exported, err := u.ExportToUPKV2AllIncarnations()
	require.NoError(t, err)

	if len(exported.PastIncarnations) != 1 {
		t.Fatalf("Expected exactly 1 past incarnation, found %d", len(exported.PastIncarnations))
	}

	current := exported.Current
	past := exported.PastIncarnations[0]

	// Check that the current user has device keys and no PGP key.
	if len(current.PGPKeys) != 0 {
		t.Fatalf("Expected exactly 0 PGP keys in the current incarnation, found %d", len(current.PGPKeys))
	}
	if len(current.DeviceKeys) != 2 {
		t.Fatalf("Expected exactly 2 device keys in the current incarnation, found %d", len(current.DeviceKeys))
	}

	// Check that the past version of the user has a PGP key but no device keys.
	if len(past.PGPKeys) != 1 {
		t.Fatalf("Expected exactly 1 PGP key in the past incarnation, found %d", len(past.PGPKeys))
	}
	if len(past.DeviceKeys) != 0 {
		t.Fatalf("Expected exactly 0 device keys in the past incarnation, found %d", len(past.DeviceKeys))
	}

	// Make sure the timestamps on keys are exported properly.
	for _, key := range current.DeviceKeys {
		userKeyInfo := u.GetComputedKeyInfos().Infos[key.Base.Kid]
		t1 := keybase1.FromTime(key.Base.CTime)
		t2 := time.Unix(userKeyInfo.CTime, 0)
		if !t1.Equal(t2) {
			t.Fatalf("exported key ctime is not equal: %s != %s", t1, t2)
		}
	}

	// Make sure all the chain links made it into the link IDs list.
	if len(exported.SeqnoLinkIDs) != int(u.GetSigChainLastKnownSeqno()) {
		t.Fatalf("expected SeqnoLinkIDs to be len %d but found %d", u.GetSigChainLastKnownSeqno(), len(exported.SeqnoLinkIDs))
	}
	// Make sure all seqnos are present.
	for seqno := 1; seqno <= len(exported.SeqnoLinkIDs); seqno++ {
		linkID, ok := exported.SeqnoLinkIDs[keybase1.Seqno(seqno)]
		if !ok {
			t.Fatalf("seqno %d missing from link IDs map", seqno)
		}
		if len(linkID) == 0 {
			t.Fatalf("found empty LinkID at seqno %d, that's pretty weird", seqno)
		}
	}
}
