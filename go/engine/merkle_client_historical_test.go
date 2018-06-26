package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestMerkleClientHistorical(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")
	m := NewMetaContextForTest(tc)

	q := libkb.NewHTTPArgs()
	q.Add("uid", libkb.UIDArg(fu.UID()))
	mc := tc.G.MerkleClient
	leaf, err := mc.LookupUser(m, q, nil)
	root := mc.LastRoot()

	require.NoError(t, err)
	require.NotNil(t, leaf)
	require.NotNil(t, root)

	var sigVersion libkb.SigVersion
	for i := 0; i < 3; i++ {
		// Cover both v1 and v2 case
		if i%2 == 0 {
			sigVersion = libkb.KeybaseSignatureV2
		} else {
			sigVersion = libkb.KeybaseSignatureV1
		}
		trackAlice(tc, fu, sigVersion)
		untrackAlice(tc, fu, sigVersion)
	}
	leaf2, err := mc.LookupLeafAtHashMeta(m, fu.UID().AsUserOrTeam(), root.HashMeta())
	require.NoError(t, err)
	require.NotNil(t, leaf2)
	require.True(t, leaf.Public().Eq(*leaf2.Public))

	arg := keybase1.VerifyMerkleRootAndKBFSArg{
		Root: keybase1.MerkleRootV2{
			Seqno:    *root.Seqno(),
			HashMeta: root.HashMeta(),
		},
		ExpectedKBFSRoot: keybase1.KBFSRoot{
			TreeID: keybase1.MerkleTreeID_KBFS_PRIVATETEAM,
		},
	}
	err = libkb.VerifyMerkleRootAndKBFS(m, arg)
	require.NoError(t, err)
}

func TestFindNextMerkleRootAfterRevoke(t *testing.T) {
	tc := SetupEngineTest(t, "merk")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUserPaper(tc, "merk")
	for i := 0; i < 2; i++ {
		v := libkb.KeybaseSignatureV2
		trackAlice(tc, fu, v)
		untrackAlice(tc, fu, v)
	}

	assertNumDevicesAndKeys(tc, fu, 2, 4)

	devices, _ := getActiveDevicesAndKeys(tc, fu)
	var paperDevice *libkb.Device
	for _, device := range devices {
		if device.Type == libkb.DeviceTypePaper {
			paperDevice = device
		}
	}

	err := doRevokeDevice(tc, fu, paperDevice.ID, false, false)
	require.NoError(t, err, "revoke worked")
	assertNumDevicesAndKeys(tc, fu, 1, 2)

	for i := 0; i < 2; i++ {
		v := libkb.KeybaseSignatureV2
		trackAlice(tc, fu, v)
		untrackAlice(tc, fu, v)
	}

	m := NewMetaContextForTest(tc)

	upak, _, err := tc.G.GetUPAKLoader().LoadV2(libkb.NewLoadUserArgWithMetaContext(m).WithUID(fu.UID()))
	require.NoError(t, err, "upak loaded")
	require.NotNil(t, upak, "upak wasn't nil")

	var revokedKey *keybase1.PublicKeyV2NaCl
	for _, key := range upak.Current.DeviceKeys {
		if key.Base.Revocation != nil {
			revokedKey = &key
			break
		}
	}
	require.NotNil(t, revokedKey, "we found a revoked key")
	arg := keybase1.FindNextMerkleRootAfterRevokeArg{
		Uid:  fu.UID(),
		Kid:  revokedKey.Base.Kid,
		Loc:  revokedKey.Base.Revocation.SigChainLocation,
		Prev: revokedKey.Base.Revocation.PrevMerkleRootSigned,
	}
	res, err := libkb.FindNextMerkleRootAfterRevoke(m, arg)
	require.NoError(t, err, "found the next root")
	require.NotNil(t, res.Res, "we got a root back")
	before := revokedKey.Base.Revocation.PrevMerkleRootSigned.Seqno
	after := res.Res.Seqno
	require.True(t, after > before, "we got a > seqno")
	t.Logf("Found merkle root %d > %d", after, before)

}
