package identify3

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	insecureTriplesec "github.com/keybase/go-triplesec-insecure"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
	"sync"
	"testing"
)

func SetupTest(tb libkb.TestingTB, name string) libkb.TestContext {
	tc := externalstest.SetupTest(tb, name, 2)
	// use an insecure triplesec in tests
	tc.G.NewTriplesec = func(passphrase []byte, salt []byte) (libkb.Triplesec, error) {
		warner := func() { tc.G.Log.Warning("Installing insecure Triplesec with weak stretch parameters") }
		isProduction := func() bool {
			return tc.G.Env.GetRunMode() == libkb.ProductionRunMode
		}
		return insecureTriplesec.NewCipher(passphrase, salt, libkb.ClientTriplesecVersion, warner, isProduction)
	}
	return tc
}

type id3results struct {
	resultType   keybase1.Identify3ResultType
	rows         []keybase1.Identify3UpdateRowArg
	cards        []keybase1.UserCard
	timedOut     bool
	userWasReset bool
}

func (r *id3results) pushRow(row keybase1.Identify3UpdateRowArg) {
	r.rows = append(r.rows, row)
}

func (r *id3results) pushUserCard(card keybase1.UserCard) {
	r.cards = append(r.cards, card)
}

func (r *id3results) hitTimeout() {
	r.timedOut = true
}

func (r *id3results) hitUserReset() {
	r.userWasReset = true
}

type fakeUI3 struct {
	sync.Mutex
	resultCh   chan<- keybase1.Identify3ResultType
	id3results id3results
}

func (f *fakeUI3) Identify3ShowTracker(context.Context, keybase1.Identify3ShowTrackerArg) error {
	return nil
}
func (f *fakeUI3) Identify3UpdateRow(_ context.Context, row keybase1.Identify3UpdateRowArg) error {
	f.Lock()
	defer f.Unlock()
	f.id3results.pushRow(row)
	return nil
}
func (f *fakeUI3) Identify3UserReset(context.Context, keybase1.Identify3GUIID) error {
	f.Lock()
	defer f.Unlock()
	f.id3results.hitUserReset()
	return nil
}
func (f *fakeUI3) Identify3UpdateUserCard(_ context.Context, card keybase1.Identify3UpdateUserCardArg) error {
	f.Lock()
	defer f.Unlock()
	f.id3results.pushUserCard(card.Card)
	return nil
}
func (f *fakeUI3) Identify3TrackerTimedOut(context.Context, keybase1.Identify3GUIID) error {
	f.Lock()
	defer f.Unlock()
	f.id3results.hitTimeout()
	return nil
}
func (f *fakeUI3) Identify3Result(_ context.Context, res keybase1.Identify3ResultArg) error {
	f.Lock()
	f.id3results.resultType = res.Result
	f.Unlock()
	f.resultCh <- res.Result
	return nil
}

func (f *fakeUI3) results() id3results {
	f.Lock()
	defer f.Unlock()
	return f.id3results
}

func findRows(t *testing.T, haystack []keybase1.Identify3UpdateRowArg, needles []keybase1.Identify3UpdateRowArg) {
	i := 0
	for _, h := range haystack {
		needle := needles[i]
		if h.Key != needle.Key || h.Value != needle.Value {
			continue
		}
		if needle.SiteURL != "" {
			require.Equal(t, h.SiteURL, needle.SiteURL)
		}
		if needle.ProofURL != "" {
			require.Equal(t, h.ProofURL, needle.ProofURL)
		}
		if needle.State != keybase1.Identify3RowState(0) {
			require.Equal(t, h.State, needle.State)
		}
		if needle.Color != keybase1.Identify3RowColor(0) {
			require.Equal(t, h.Color, needle.Color)
		}
		if needle.Metas != nil {
			require.Equal(t, h.Metas, needle.Metas)
		}
		i++
		if i == len(needles) {
			return
		}
	}
	t.Fatalf("didn't find all wanted rows")
}

func addBTCAddr(tc libkb.TestContext, u *kbtest.FakeUser, addr string) {
	t := tc.T
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
	}
	e := engine.NewCryptocurrencyEngine(tc.G, keybase1.RegisterAddressArg{Address: addr})
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	err := engine.RunEngine2(m, e)
	require.NoError(t, err)
}

func TestCryptocurrency(t *testing.T) {
	tc := SetupTest(t, "id3")
	defer tc.Cleanup()
	alice, err := kbtest.CreateAndSignupFakeUser("alice", tc.G)

	// The keybase Bitcoin pin address.
	addr := "1HUCBSJeHnkhzrVKVjaVmWg2QtZS1mdfaz"
	addBTCAddr(tc, alice, addr)
	require.NoError(t, err)
	_, err = kbtest.CreateAndSignupFakeUser("bob", tc.G)
	require.NoError(t, err)

	mctx := libkb.NewMetaContextForTest(tc)
	res := runID3(t, mctx, alice.Username, true)
	require.False(t, res.userWasReset)

	// We get one row of results, just the cryptocurrency row.
	require.Equal(t, len(res.rows), 1)
	require.Equal(t, res.rows[0].Key, "bitcoin")
	require.Equal(t, res.rows[0].Value, addr)
	require.Equal(t, res.rows[0].Color, keybase1.Identify3RowColor_GREEN)
	require.Equal(t, res.rows[0].State, keybase1.Identify3RowState_VALID)
}

func TestFollowUnfollowTracy(t *testing.T) {
	tc := SetupTest(t, "id3")
	defer tc.Cleanup()
	_, err := kbtest.CreateAndSignupFakeUser("id3", tc.G)
	require.NoError(t, err)

	mctx := libkb.NewMetaContextForTest(tc)
	res := runID3(t, mctx, "t_tracy", true)
	require.Equal(t, res.resultType, keybase1.Identify3ResultType_OK)
	require.Equal(t, len(res.rows), 9)
	require.Equal(t, len(res.cards), 1)
	require.False(t, res.cards[0].YouFollowThem)

	findRows(t, res.rows, []keybase1.Identify3UpdateRowArg{
		keybase1.Identify3UpdateRowArg{
			Key:   "twitter",
			Value: "tacovontaco",
			State: keybase1.Identify3RowState_CHECKING,
			Color: keybase1.Identify3RowColor_GRAY,
		},
		keybase1.Identify3UpdateRowArg{
			Key:   "twitter",
			Value: "tacovontaco",
			State: keybase1.Identify3RowState_VALID,
			Color: keybase1.Identify3RowColor_GREEN,
		},
	})
	findRows(t, res.rows, []keybase1.Identify3UpdateRowArg{
		keybase1.Identify3UpdateRowArg{
			Key:   "https",
			Value: "keybase.io",
			State: keybase1.Identify3RowState_CHECKING,
			Color: keybase1.Identify3RowColor_GRAY,
		},
		keybase1.Identify3UpdateRowArg{
			Key:   "https",
			Value: "keybase.io",
			State: keybase1.Identify3RowState_WARNING,
			Color: keybase1.Identify3RowColor_ORANGE,
			Metas: []keybase1.Identify3RowMeta{keybase1.Identify3RowMeta{Color: keybase1.Identify3RowColor_ORANGE, Label: "unreachable"}},
		},
	})

	res = runID3(t, mctx, "t_tracy", false)
	require.Equal(t, res.resultType, keybase1.Identify3ResultType_OK)
	require.Equal(t, len(res.rows), 9)
	require.Equal(t, len(res.cards), 1)
	require.True(t, res.cards[0].YouFollowThem)

	findRows(t, res.rows, []keybase1.Identify3UpdateRowArg{
		keybase1.Identify3UpdateRowArg{
			Key:   "twitter",
			Value: "tacovontaco",
			State: keybase1.Identify3RowState_CHECKING,
			Color: keybase1.Identify3RowColor_GRAY,
		},
		keybase1.Identify3UpdateRowArg{
			Key:   "twitter",
			Value: "tacovontaco",
			State: keybase1.Identify3RowState_VALID,
			Color: keybase1.Identify3RowColor_GREEN,
		},
	})
	findRows(t, res.rows, []keybase1.Identify3UpdateRowArg{
		keybase1.Identify3UpdateRowArg{
			Key:   "https",
			Value: "keybase.io",
			State: keybase1.Identify3RowState_CHECKING,
			Color: keybase1.Identify3RowColor_GRAY,
		},
		keybase1.Identify3UpdateRowArg{
			Key:   "https",
			Value: "keybase.io",
			State: keybase1.Identify3RowState_WARNING,
			Color: keybase1.Identify3RowColor_ORANGE,
			Metas: []keybase1.Identify3RowMeta{keybase1.Identify3RowMeta{Color: keybase1.Identify3RowColor_ORANGE, Label: "ignored"}},
		},
	})
}

func runID3(t *testing.T, mctx libkb.MetaContext, user string, follow bool) id3results {

	guiid, err := libkb.NewIdentify3GUIID()
	require.NoError(t, err)
	resultCh := make(chan keybase1.Identify3ResultType)
	fakeUI3 := fakeUI3{resultCh: resultCh}
	err = Identify3(mctx, &fakeUI3, keybase1.Identify3Arg{
		Assertion: keybase1.Identify3Assertion(user),
		GuiID:     guiid,
	})
	require.NoError(t, err)
	<-resultCh
	err = FollowUser(mctx, keybase1.Identify3FollowUserArg{
		GuiID:  guiid,
		Follow: follow,
	})
	require.NoError(t, err)
	return fakeUI3.results()
}

func TestFollowResetFollow(t *testing.T) {

	tc := SetupTest(t, "id3")
	defer tc.Cleanup()
	alice, err := kbtest.CreateAndSignupFakeUser("id3a", tc.G)
	require.NoError(t, err)
	bob, err := kbtest.CreateAndSignupFakeUser("id3b", tc.G)
	require.NoError(t, err)
	mctx := libkb.NewMetaContextForTest(tc)
	res := runID3(t, mctx, alice.Username, true)
	require.False(t, res.userWasReset)

	kbtest.Logout(tc)
	kbtest.ResetAccount(tc, alice)
	alice.Login(tc.G)
	kbtest.Logout(tc)

	bob.Login(tc.G)
	res = runID3(t, mctx, alice.Username, true)
	require.True(t, res.userWasReset)
	res = runID3(t, mctx, alice.Username, true)
	require.False(t, res.userWasReset)
}
