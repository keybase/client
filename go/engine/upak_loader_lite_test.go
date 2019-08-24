package engine

import (
	"fmt"
	"reflect"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type _deviceKeys map[keybase1.KID]keybase1.PublicKeyV2NaCl

func deviceKeysMatch(dk1, dk2 _deviceKeys) bool {
	highKeys1 := make(_deviceKeys)
	highKeys2 := make(_deviceKeys)
	for kid, key := range dk1 {
		if key.Base.IsSibkey || key.Base.IsEldest {
			highKeys1[kid] = key
		}
	}
	for kid, key := range dk2 {
		if key.Base.IsSibkey || key.Base.IsEldest {
			highKeys2[kid] = key
		}
	}
	return reflect.DeepEqual(highKeys1, highKeys2)
}

func assertUpkInstanceMatch(t *testing.T, upkLite keybase1.UPKLiteV1, upkFull keybase1.UserPlusKeysV2) {
	require.Equal(t, upkLite.Uid, upkFull.Uid)
	require.Equal(t, upkLite.Username, upkFull.Username)
	require.Equal(t, upkLite.Status, upkFull.Status)
	require.Equal(t, upkLite.EldestSeqno, upkFull.EldestSeqno)
	// device keys (not subkeys, just sibkeys and eldest)
	msg := fmt.Sprintf("device keys match. lite: %v || full: %v", upkLite.DeviceKeys, upkFull.DeviceKeys)
	require.True(t, deviceKeysMatch(upkLite.DeviceKeys, upkFull.DeviceKeys), msg)
	// reset summary
	msg = fmt.Sprintf("resets match. lite: %v || full: %v", upkLite.Reset, upkFull.Reset)
	require.True(t, reflect.DeepEqual(upkFull.Reset, upkLite.Reset), msg)
}

func assertUPAKLiteMatchesUPAK(t *testing.T, tc libkb.TestContext, uid keybase1.UID) {
	ctx := context.TODO()
	loadArgLite := libkb.NewLoadUserByUIDArg(ctx, tc.G, uid).ForUPAKLite().WithForceReload()
	upakLite, err := tc.G.GetUPAKLoader().LoadLite(loadArgLite)
	require.NoError(t, err)
	loadArg := libkb.NewLoadUserByUIDArg(ctx, tc.G, uid).WithForceReload().WithPublicKeyOptional()
	upak, _, err := tc.G.GetUPAKLoader().LoadV2(loadArg)
	require.NoError(t, err)
	assertUpkInstanceMatch(t, upakLite.Current, upak.Current)
	require.Equal(t, len(upak.PastIncarnations), len(upakLite.PastIncarnations), "same number of past incarnations")
	for idx, prevUpakFull := range upak.PastIncarnations {
		prevUpakLite := upakLite.PastIncarnations[idx]
		assertUpkInstanceMatch(t, prevUpakLite, prevUpakFull)
	}
	// seqno,linkID pairs in the upakLite must exist in the full upak
	for seqno, linkID := range upakLite.SeqnoLinkIDs {
		require.Equal(t, upak.SeqnoLinkIDs[seqno], linkID)
	}
}

func TestLoadLiteBasicUser(t *testing.T) {
	tc := SetupEngineTest(t, "loadlite")
	defer tc.Cleanup()

	// basic new user
	fu := CreateAndSignupFakeUser(tc, "jim")
	uid := fu.UID()
	t.Logf("create new user %s, %s", fu.Username, uid)
	assertUPAKLiteMatchesUPAK(t, tc, uid)

	// add a couple low links and test again
	sigVersion := libkb.GetDefaultSigVersion(tc.G)
	trackAlice(tc, fu, sigVersion)
	untrackAlice(tc, fu, sigVersion)
	t.Logf("with a couple of low links")
	assertUPAKLiteMatchesUPAK(t, tc, uid)

	// add a new high link (a new PGP key) and test
	uis := libkb.UIs{LogUI: tc.G.UI.GetLogUI(), SecretUI: fu.NewSecretUI()}
	_, _, key := genPGPKeyAndArmor(t, tc, fu.Email)
	eng, err := NewPGPKeyImportEngineFromBytes(tc.G, []byte(key), true)
	require.NoError(t, err)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err = RunEngine2(m, eng)
	require.NoError(t, err)
	t.Logf("with a new PGP key")
	assertUPAKLiteMatchesUPAK(t, tc, uid)

	// reset the user and test immediately
	ResetAccountNoLogout(tc, fu)
	t.Logf("reset the account with no new links")
	assertUPAKLiteMatchesUPAK(t, tc, uid)
	// add a couple low links and test
	fu.LoginOrBust(tc)
	trackAlice(tc, fu, sigVersion)
	untrackAlice(tc, fu, sigVersion)
	t.Logf("reset the account and add a couple more low links")
	assertUPAKLiteMatchesUPAK(t, tc, uid)
	// reset again!
	ResetAccountNoLogout(tc, fu)
	fu.LoginOrBust(tc)
	// add a low link
	trackAlice(tc, fu, sigVersion)
	// add a high link (new paper key)
	uis = libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{},
		SecretUI: &libkb.TestSecretUI{},
	}
	peng := NewPaperKey(tc.G)
	m = NewMetaContextForTest(tc).WithUIs(uis)
	err = RunEngine2(m, peng)
	require.NoError(t, err)
	// add another low link
	untrackAlice(tc, fu, sigVersion)
	t.Logf("reset the account again and add a low link, a new paper key, and another low link")
	assertUPAKLiteMatchesUPAK(t, tc, uid)

	// with a logged out user
	Logout(tc)
	assertUPAKLiteMatchesUPAK(t, tc, uid)
}
