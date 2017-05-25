package engine

import (
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
	require "github.com/stretchr/testify/require"
)

func importTrackingLink(t *testing.T, g *libkb.GlobalContext) *libkb.TrackChainLink {
	jw, err := jsonw.Unmarshal([]byte(trackingServerReply))
	if err != nil {
		t.Fatal(err)
	}
	cl, err := libkb.ImportLinkFromServer(g, nil, jw, trackingUID)
	if err != nil {
		t.Fatal(err)
	}
	gl := libkb.GenericChainLink{ChainLink: cl}
	tcl, err := libkb.ParseTrackChainLink(gl)
	if err != nil {
		t.Fatal(err)
	}
	return tcl
}

func TestIdentify2WithUIDImportTrackingLink(t *testing.T) {
	link := importTrackingLink(t, nil)
	if link == nil {
		t.Fatalf("link import failed")
	}
}

type cacheStats struct {
	hit     int
	timeout int
	miss    int
	notime  int
	breaks  int
}

type identify2testCache map[keybase1.UID](*keybase1.Identify2Res)

func (c cacheStats) eq(h, t, m, n, b int) bool {
	return h == c.hit && t == c.timeout && m == c.miss && n == c.notime && b == c.breaks
}

type Identify2WithUIDTester struct {
	libkb.Contextified
	libkb.BaseServiceType
	finishCh        chan struct{}
	startCh         chan struct{}
	checkStatusHook func(libkb.SigHint, libkb.ProofCheckerMode) libkb.ProofError
	cache           identify2testCache
	slowStats       cacheStats
	fastStats       cacheStats
	now             time.Time
	card            keybase1.UserCard
	userLoads       map[keybase1.UID]int
	noDiskCache     bool
}

func newIdentify2WithUIDTester(g *libkb.GlobalContext) *Identify2WithUIDTester {
	return &Identify2WithUIDTester{
		Contextified: libkb.NewContextified(g),
		finishCh:     make(chan struct{}),
		startCh:      make(chan struct{}, 1),
		cache:        make(identify2testCache),
		now:          time.Now(),
		userLoads:    make(map[keybase1.UID]int),
	}
}

func (i *Identify2WithUIDTester) ListProofCheckers(mode libkb.RunMode) []string { return nil }
func (i *Identify2WithUIDTester) AllStringKeys() []string                       { return nil }
func (i *Identify2WithUIDTester) CheckProofText(text string, id keybase1.SigID, sig string) error {
	return nil
}
func (i *Identify2WithUIDTester) DisplayName(n string) string { return n }
func (i *Identify2WithUIDTester) GetPrompt() string           { return "" }
func (i *Identify2WithUIDTester) GetProofType() string        { return "" }
func (i *Identify2WithUIDTester) GetTypeName() string         { return "" }
func (i *Identify2WithUIDTester) NormalizeRemoteName(_ libkb.ProofContext, name string) (string, error) {
	return name, nil
}
func (i *Identify2WithUIDTester) NormalizeUsername(name string) (string, error)    { return name, nil }
func (i *Identify2WithUIDTester) PostInstructions(remotename string) *libkb.Markup { return nil }
func (i *Identify2WithUIDTester) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, remotename string) (*libkb.Markup, error) {
	return nil, nil
}
func (i *Identify2WithUIDTester) ToServiceJSON(remotename string) *jsonw.Wrapper { return nil }

func (i *Identify2WithUIDTester) MakeProofChecker(_ libkb.RemoteProofChainLink) libkb.ProofChecker {
	return i
}
func (i *Identify2WithUIDTester) GetServiceType(n string) libkb.ServiceType { return i }

func (i *Identify2WithUIDTester) CheckStatus(_ libkb.ProofContext, h libkb.SigHint, pcm libkb.ProofCheckerMode, _ libkb.PvlUnparsed) libkb.ProofError {
	if i.checkStatusHook != nil {
		return i.checkStatusHook(h, pcm)
	}
	i.G().Log.Debug("Check status rubber stamp: %+v", h)
	return nil
}

func (i *Identify2WithUIDTester) GetTorError() libkb.ProofError {
	return nil
}

func (i *Identify2WithUIDTester) FinishSocialProofCheck(keybase1.RemoteProof, keybase1.LinkCheckResult) error {
	return nil
}
func (i *Identify2WithUIDTester) Confirm(*keybase1.IdentifyOutcome) (res keybase1.ConfirmResult, err error) {
	return
}
func (i *Identify2WithUIDTester) FinishWebProofCheck(keybase1.RemoteProof, keybase1.LinkCheckResult) error {
	return nil
}
func (i *Identify2WithUIDTester) DisplayCryptocurrency(keybase1.Cryptocurrency) error {
	return nil
}
func (i *Identify2WithUIDTester) DisplayKey(keybase1.IdentifyKey) error {
	return nil
}
func (i *Identify2WithUIDTester) ReportLastTrack(*keybase1.TrackSummary) error {
	return nil
}
func (i *Identify2WithUIDTester) LaunchNetworkChecks(*keybase1.Identity, *keybase1.User) error {
	return nil
}
func (i *Identify2WithUIDTester) DisplayTrackStatement(string) error {
	return nil
}
func (i *Identify2WithUIDTester) ReportTrackToken(keybase1.TrackToken) (err error) {
	return nil
}
func (i *Identify2WithUIDTester) SetStrict(b bool) error {
	return nil
}
func (i *Identify2WithUIDTester) DisplayUserCard(card keybase1.UserCard) error {
	i.card = card
	return nil
}

func (i *Identify2WithUIDTester) DisplayTLFCreateWithInvite(keybase1.DisplayTLFCreateWithInviteArg) error {
	return nil
}

func (i *Identify2WithUIDTester) Cancel() error {
	return nil
}

func (i *Identify2WithUIDTester) Finish() error {
	i.finishCh <- struct{}{}
	return nil
}

func (i *Identify2WithUIDTester) Dismiss(_ string, _ keybase1.DismissReason) error {
	return nil
}

func (i *Identify2WithUIDTester) Start(string, keybase1.IdentifyReason, bool) error {
	i.startCh <- struct{}{}
	return nil
}

func (i *Identify2WithUIDTester) Get(uid keybase1.UID, gctf libkb.GetCheckTimeFunc, gcdf libkb.GetCacheDurationFunc, breaksOK bool) (*keybase1.Identify2Res, error) {
	res := i.cache[uid]
	stats := &i.slowStats

	// Please execuse this horrible hack, but use the `GetCacheDurationFunc` to see if we're dealing
	// with a fast cache duration
	if gcdf(keybase1.Identify2Res{}) == libkb.Identify2CacheShortTimeout {
		stats = &i.fastStats
	}

	if res == nil {
		stats.miss++
		return nil, nil
	}
	if gctf != nil {
		then := gctf(*res)
		if then == 0 {
			stats.notime++
			return nil, libkb.TimeoutError{}
		}
		if res.TrackBreaks != nil && !breaksOK {
			stats.breaks++
			return nil, libkb.TrackBrokenError{}
		}
		timeout := gcdf(*res)
		thenTime := keybase1.FromTime(then)
		if i.now.Sub(thenTime) > timeout {
			stats.timeout++
			return nil, libkb.TimeoutError{}
		}
	}
	stats.hit++
	return res, nil
}

func (i *Identify2WithUIDTester) Insert(up *keybase1.Identify2Res) error {
	tmp := *up
	copy := &tmp
	copy.Upk.Uvv.CachedAt = keybase1.ToTime(i.now)
	i.cache[up.Upk.Uid] = copy
	return nil
}
func (i *Identify2WithUIDTester) DidFullUserLoad(uid keybase1.UID) {
	i.userLoads[uid]++
}
func (i *Identify2WithUIDTester) UseDiskCache() bool {
	return !i.noDiskCache
}

func (i *Identify2WithUIDTester) Delete(uid keybase1.UID) error {
	delete(i.cache, uid)
	return nil
}

func (i *Identify2WithUIDTester) Shutdown() {}

var _ libkb.Identify2Cacher = (*Identify2WithUIDTester)(nil)

func TestIdentify2WithUIDWithoutTrack(t *testing.T) {
	tc := SetupEngineTest(t, "Identify2WithUIDWithoutTrack")
	defer tc.Cleanup()
	i := newIdentify2WithUIDTester(tc.G)
	tc.G.Services = i
	arg := &keybase1.Identify2Arg{
		Uid: tracyUID,
	}
	eng := NewIdentify2WithUID(tc.G, arg)
	ctx := Context{IdentifyUI: i}

	err := eng.Run(&ctx)
	if err != nil {
		t.Fatal(err)
	}
	<-i.finishCh
}

func launchWaiter(t *testing.T, ch chan struct{}) func() {
	waitCh := make(chan error)
	go func() {
		select {
		case <-ch:
			waitCh <- nil
		case <-time.After(10 * time.Second):
			waitCh <- errors.New("failed to get a finish after timeout")
		}
	}()
	return func() {
		err := <-waitCh
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestIdentify2WithUIDWithTrack(t *testing.T) {
	tc := SetupEngineTest(t, "Identify2WithUIDWithTrack")
	defer tc.Cleanup()
	i := newIdentify2WithUIDTester(tc.G)
	tc.G.Services = i
	arg := &keybase1.Identify2Arg{
		Uid: tracyUID,
	}
	eng := NewIdentify2WithUID(tc.G, arg)

	eng.testArgs = &Identify2WithUIDTestArgs{
		noMe: true,
		tcl:  importTrackingLink(t, tc.G),
	}

	ctx := Context{IdentifyUI: i}
	waiter := launchWaiter(t, i.finishCh)

	err := eng.Run(&ctx)
	if err != nil {
		t.Fatal(err)
	}

	waiter()
}

func TestIdentify2WithUIDWithTrackAndSuppress(t *testing.T) {
	tc := SetupEngineTest(t, "Identify2WithUIDWithTrackAndSuppress")
	defer tc.Cleanup()
	i := newIdentify2WithUIDTester(tc.G)
	tc.G.Services = i
	arg := &keybase1.Identify2Arg{
		Uid:           tracyUID,
		CanSuppressUI: true,
	}
	eng := NewIdentify2WithUID(tc.G, arg)

	eng.testArgs = &Identify2WithUIDTestArgs{
		noMe: true,
		tcl:  importTrackingLink(t, tc.G),
	}

	ctx := Context{IdentifyUI: i}
	err := eng.Run(&ctx)
	if err != nil {
		t.Fatal(err)
	}

	select {
	case <-i.startCh:
		t.Fatalf("did not expect the identify to start")
	default:
	}

	select {
	case <-i.finishCh:
		t.Fatalf("did not expect the identify to end")
	default:
	}
}

func identify2WithUIDWithBrokenTrackMakeEngine(t *testing.T, arg *keybase1.Identify2Arg) (func(), error) {
	tc := SetupEngineTest(t, "testIdentify2WithUIDWithBrokenTrack")
	defer tc.Cleanup()
	i := newIdentify2WithUIDTester(tc.G)
	tc.G.Services = i
	eng := NewIdentify2WithUID(tc.G, arg)

	eng.testArgs = &Identify2WithUIDTestArgs{
		noMe:  true,
		cache: i,
		tcl:   importTrackingLink(t, tc.G),
	}
	i.checkStatusHook = func(l libkb.SigHint, _ libkb.ProofCheckerMode) libkb.ProofError {
		if strings.Contains(l.GetHumanURL(), "twitter") {
			tc.G.Log.Debug("failing twitter proof %s", l.GetHumanURL())
			return libkb.NewProofError(keybase1.ProofStatus_DELETED, "gone!")
		}
		return nil
	}
	ctx := Context{IdentifyUI: i}
	waiter := launchWaiter(t, i.finishCh)
	err := eng.Run(&ctx)
	return waiter, err
}

func testIdentify2WithUIDWithBrokenTrack(t *testing.T, suppress bool) {
	arg := &keybase1.Identify2Arg{
		Uid:           tracyUID,
		CanSuppressUI: suppress,
	}
	waiter, err := identify2WithUIDWithBrokenTrackMakeEngine(t, arg)

	if err == nil {
		t.Fatal("expected an ID2 error since twitter proof failed")
	}
	waiter()
}

func TestIdentify2WithUIDWithBrokenTrack(t *testing.T) {
	testIdentify2WithUIDWithBrokenTrack(t, false)
}

func TestIdentify2WithUIDWithBrokenTrackWithSuppressUI(t *testing.T) {
	testIdentify2WithUIDWithBrokenTrack(t, true)
}

func TestIdentify2WithUIDWithUntrackedFastPath(t *testing.T) {
	tc := SetupEngineTest(t, "TestIdentify2WithUIDWithUntrackedFastPath")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "track")

	runID2 := func(expectFastPath bool) {

		tester := newIdentify2WithUIDTester(tc.G)
		tester.noDiskCache = true

		eng := NewIdentify2WithUID(tc.G, &keybase1.Identify2Arg{Uid: aliceUID, IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_GUI})
		eng.testArgs = &Identify2WithUIDTestArgs{
			cache: tester,
			allowUntrackedFastPath: true,
		}
		ctx := Context{IdentifyUI: tester}
		err := eng.Run(&ctx)
		require.NoError(t, err)
		require.Equal(t, expectFastPath, (eng.testArgs.stats.untrackedFastPaths == 1), "right number of untracked fast paths")
	}

	runID2(true)
	trackAlice(tc, fu)
	defer untrackAlice(tc, fu)
	runID2(false)
}

func TestIdentify2WithUIDWithBrokenTrackFromChatGUI(t *testing.T) {

	tc := SetupEngineTest(t, "TestIdentify2WithUIDWithBrokenTrackFromChatGUI")
	defer tc.Cleanup()
	tester := newIdentify2WithUIDTester(tc.G)
	tc.G.Services = tester
	tester.checkStatusHook = func(l libkb.SigHint, _ libkb.ProofCheckerMode) libkb.ProofError {
		if strings.Contains(l.GetHumanURL(), "twitter") {
			tc.G.Log.Debug("failing twitter proof %s", l.GetHumanURL())
			return libkb.NewProofError(keybase1.ProofStatus_DELETED, "gone!")
		}
		return nil
	}

	var origUI libkb.IdentifyUI
	origUI = tester

	checkBrokenRes := func(res *keybase1.Identify2Res) {
		if !res.Upk.Uid.Equal(tracyUID) {
			t.Fatal("bad UID for t_tracy")
		}
		if res.Upk.Username != "t_tracy" {
			t.Fatal("bad username for t_tracy")
		}
		if len(res.Upk.DeviceKeys) != 4 {
			t.Fatal("wrong # of device keys for tracy")
		}
		if len(res.TrackBreaks.Proofs) != 1 {
			t.Fatal("Expected to get back 1 broken proof")
		}
		if res.TrackBreaks.Proofs[0].RemoteProof.Key != "twitter" {
			t.Fatal("Expected a twitter proof type")
		}
		if res.TrackBreaks.Proofs[0].Lcr.RemoteDiff.Type != keybase1.TrackDiffType_REMOTE_FAIL {
			t.Fatal("wrong remote failure type")
		}
	}

	runChatGUI := func() {
		// Now run the engine again, but in normal mode, and check that we don't hit
		// the cached broken gy.
		eng := NewIdentify2WithUID(tc.G, &keybase1.Identify2Arg{Uid: tracyUID, IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_GUI})

		eng.testArgs = &Identify2WithUIDTestArgs{
			noMe:  true,
			cache: tester,
			tcl:   importTrackingLink(t, tc.G),
			allowUntrackedFastPath: true,
		}

		ctx := Context{IdentifyUI: tester}

		waiter := launchWaiter(t, tester.finishCh)
		err := eng.Run(&ctx)
		// Since we threw away the test UI, we have to manually complete the UI here,
		// otherwise the waiter() will block indefinitely.
		origUI.Finish()
		waiter()
		res := eng.Result()
		if err != nil {
			t.Fatalf("expected no ID2 error; got %v\n", err)
		}
		checkBrokenRes(res)
		if n := eng.testArgs.stats.untrackedFastPaths; n > 0 {
			t.Fatalf("Didn't expect any untracked fast paths, but got %d", n)
		}
	}

	runStandard := func() {
		// Now run the engine again, but in normal mode, and check that we don't hit
		// the cached broken gy.
		eng := NewIdentify2WithUID(tc.G, &keybase1.Identify2Arg{Uid: tracyUID})

		eng.testArgs = &Identify2WithUIDTestArgs{
			noMe:  true,
			cache: tester,
			tcl:   importTrackingLink(t, tc.G),
		}

		ctx := Context{IdentifyUI: tester}

		waiter := launchWaiter(t, tester.finishCh)
		err := eng.Run(&ctx)
		waiter()
		if err == nil {
			t.Fatalf("Expected a break with running ID2 in standard mode")
		}
	}

	runChatGUI()

	// First time through, we should miss both caches
	if !tester.fastStats.eq(0, 0, 1, 0, 0) || !tester.slowStats.eq(0, 0, 1, 0, 0) {
		t.Fatalf("bad cache stats: %+v, %+v", tester.fastStats, tester.slowStats)
	}

	runStandard()

	// If we run without the chat GUI, we should hit the cache, but have it be
	// disqualified because the cached copy has broken tracker statements.
	if !tester.fastStats.eq(0, 0, 1, 0, 1) || !tester.slowStats.eq(0, 0, 1, 0, 1) {
		t.Fatalf("bad cache stats: %+v, %+v", tester.fastStats, tester.slowStats)
	}

	runChatGUI()

	// The next time we run with the chat GUI, we won't hit the slow or fast
	// cache, since the failure in standard mode cleared out the cache for this
	// user.
	if !tester.fastStats.eq(0, 0, 2, 0, 1) || !tester.slowStats.eq(0, 0, 2, 0, 1) {
		t.Fatalf("bad cache stats: %+v, %+v", tester.fastStats, tester.slowStats)
	}

	tester.incNow(time.Second)
	runChatGUI()

	// Now we should get a fast cache hit
	if !tester.fastStats.eq(1, 0, 2, 0, 1) || !tester.slowStats.eq(0, 0, 2, 0, 1) {
		t.Fatalf("bad cache stats: %+v, %+v", tester.fastStats, tester.slowStats)
	}

	tester.incNow(time.Second + libkb.Identify2CacheShortTimeout)
	runChatGUI()

	// A fast cache timeout and a slow cache hit!
	if !tester.fastStats.eq(1, 1, 2, 0, 1) || !tester.slowStats.eq(1, 0, 2, 0, 1) {
		t.Fatalf("bad cache stats: %+v, %+v", tester.fastStats, tester.slowStats)
	}

	tester.incNow(time.Second + libkb.Identify2CacheBrokenTimeout)
	runChatGUI()

	// After the broken timeout passes, we should get timeouts on both caches
	if !tester.fastStats.eq(1, 2, 2, 0, 1) || !tester.slowStats.eq(1, 1, 2, 0, 1) {
		t.Fatalf("bad cache stats: %+v, %+v", tester.fastStats, tester.slowStats)
	}
}

func TestIdentify2WithUIDWithAssertion(t *testing.T) {
	tc := SetupEngineTest(t, "Identify2WithUIDWithAssertion")
	defer tc.Cleanup()
	i := newIdentify2WithUIDTester(tc.G)
	tc.G.Services = i
	arg := &keybase1.Identify2Arg{
		Uid:           tracyUID,
		UserAssertion: "tacovontaco@twitter",
	}
	eng := NewIdentify2WithUID(tc.G, arg)

	eng.testArgs = &Identify2WithUIDTestArgs{
		noMe: true,
	}

	ctx := Context{IdentifyUI: i}

	err := eng.Run(&ctx)
	if err != nil {
		t.Fatal(err)
	}

	<-i.finishCh
}

func TestIdentify2WithUIDWithAssertions(t *testing.T) {
	tc := SetupEngineTest(t, "Identify2WithUIDWithAssertion")
	defer tc.Cleanup()
	i := newIdentify2WithUIDTester(tc.G)
	tc.G.Services = i
	arg := &keybase1.Identify2Arg{
		Uid:           tracyUID,
		UserAssertion: "tacovontaco@twitter+t_tracy@rooter",
	}
	eng := NewIdentify2WithUID(tc.G, arg)

	eng.testArgs = &Identify2WithUIDTestArgs{
		noMe: true,
	}

	ctx := Context{IdentifyUI: i}

	err := eng.Run(&ctx)
	if err != nil {
		t.Fatal(err)
	}

	<-i.finishCh
}

func TestIdentify2WithUIDWithNonExistentAssertion(t *testing.T) {
	tc := SetupEngineTest(t, "Identify2WithUIDWithNonExistentAssertion")
	defer tc.Cleanup()
	i := newIdentify2WithUIDTester(tc.G)
	tc.G.Services = i
	arg := &keybase1.Identify2Arg{
		Uid:           tracyUID,
		UserAssertion: "beyonce@twitter",
	}
	eng := NewIdentify2WithUID(tc.G, arg)

	eng.testArgs = &Identify2WithUIDTestArgs{
		noMe: true,
	}

	ctx := Context{IdentifyUI: i}

	done := make(chan bool)
	starts := 0
	go func() {
		select {
		case <-i.startCh:
			starts++
		case <-done:
			return
		}
	}()

	err := eng.Run(&ctx)
	if err == nil {
		t.Fatal(err)
	}
	if _, ok := err.(libkb.UnmetAssertionError); !ok {
		t.Fatalf("Wanted an error of type %T; got %T", libkb.UnmetAssertionError{}, err)
	}
	if starts > 0 {
		t.Fatalf("Didn't expect the identify UI to start in this case")
	}

	done <- true
}

func TestIdentify2WithUIDWithFailedAssertion(t *testing.T) {
	tc := SetupEngineTest(t, "TestIdentify2WithUIDWithFailedAssertion")
	defer tc.Cleanup()
	i := newIdentify2WithUIDTester(tc.G)
	tc.G.Services = i
	arg := &keybase1.Identify2Arg{
		Uid:           tracyUID,
		UserAssertion: "tacovontaco@twitter",
	}
	eng := NewIdentify2WithUID(tc.G, arg)

	eng.testArgs = &Identify2WithUIDTestArgs{
		noMe: true,
	}

	ctx := Context{IdentifyUI: i}

	starts := 0
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		tc.G.Log.Debug("In BG: waiting for UI notification on startCh")
		<-i.startCh
		starts++
		tc.G.Log.Debug("In BG: waited for UI notification on startCh")
		wg.Done()
	}()

	i.checkStatusHook = func(l libkb.SigHint, _ libkb.ProofCheckerMode) libkb.ProofError {
		if strings.Contains(l.GetHumanURL(), "twitter") {
			tc.G.Log.Debug("failing twitter proof %s", l.GetHumanURL())
			return libkb.NewProofError(keybase1.ProofStatus_DELETED, "gone!")
		}
		return nil
	}

	err := eng.Run(&ctx)

	if err == nil {
		t.Fatal(err)
	}
	if _, ok := err.(libkb.ProofError); !ok {
		t.Fatalf("Wanted an error of type libkb.ProofError; got %T", err)
	}
	wg.Wait()
	if starts != 1 {
		t.Fatalf("Expected the UI to have started")
	}
	<-i.finishCh
}

func TestIdentify2WithUIDWithFailedAncillaryAssertion(t *testing.T) {
	tc := SetupEngineTest(t, "TestIdentify2WithUIDWithFailedAncillaryAssertion")
	defer tc.Cleanup()
	i := newIdentify2WithUIDTester(tc.G)
	tc.G.Services = i
	arg := &keybase1.Identify2Arg{
		Uid:           tracyUID,
		UserAssertion: "tacoplusplus@github+t_tracy@rooter",
	}
	eng := NewIdentify2WithUID(tc.G, arg)

	eng.testArgs = &Identify2WithUIDTestArgs{
		noMe: true,
	}

	ctx := Context{IdentifyUI: i}

	var wg sync.WaitGroup
	wg.Add(1)

	i.checkStatusHook = func(l libkb.SigHint, _ libkb.ProofCheckerMode) libkb.ProofError {
		switch {
		case strings.Contains(l.GetHumanURL(), "twitter"):
			wg.Done()
			tc.G.Log.Debug("failing twitter proof %s", l.GetHumanURL())
			return libkb.NewProofError(keybase1.ProofStatus_DELETED, "gone!")
		case strings.Contains(l.GetHumanURL(), "github"):
			wg.Wait()
			return nil
		case strings.Contains(l.GetHumanURL(), "rooter"):
			wg.Wait()
			return nil
		default:
			return nil
		}
	}

	err := eng.Run(&ctx)

	if err != nil {
		t.Fatal(err)
	}
	<-i.startCh
	<-i.finishCh
}

func (i *Identify2WithUIDTester) incNow(d time.Duration) {
	i.now = i.now.Add(d)
}

func TestIdentify2WithUIDCache(t *testing.T) {
	tc := SetupEngineTest(t, "Identify2WithUIDWithoutTrack")
	defer tc.Cleanup()
	i := newIdentify2WithUIDTester(tc.G)
	tc.G.Services = i
	arg := &keybase1.Identify2Arg{
		Uid: tracyUID,
	}
	run := func() {
		eng := NewIdentify2WithUID(tc.G, arg)
		eng.testArgs = &Identify2WithUIDTestArgs{
			cache: i,
			clock: func() time.Time { return i.now },
		}
		ctx := Context{IdentifyUI: i}
		err := eng.Run(&ctx)
		if err != nil {
			t.Fatal(err)
		}
	}

	// First time we'll cause an ID, so we need to finish
	run()
	<-i.startCh
	<-i.finishCh

	if !i.fastStats.eq(0, 0, 1, 0, 0) || !i.slowStats.eq(0, 0, 1, 0, 0) {
		t.Fatalf("bad cache stats %+v %+v", i.fastStats, i.slowStats)
	}

	i.incNow(time.Second)
	run()

	// A new fast-path hit
	if !i.fastStats.eq(1, 0, 1, 0, 0) || !i.slowStats.eq(0, 0, 1, 0, 0) {
		t.Fatalf("bad cache stats %+v %+v", i.fastStats, i.slowStats)
	}

	i.incNow(time.Second + libkb.Identify2CacheShortTimeout)
	run()

	// A new fast-path timeout and a new slow-path hit
	if !i.fastStats.eq(1, 1, 1, 0, 0) || !i.slowStats.eq(1, 0, 1, 0, 0) {
		t.Fatalf("bad cache stats %+v %+v", i.fastStats, i.slowStats)
	}

	i.incNow(time.Second + libkb.Identify2CacheLongTimeout)
	run()
	<-i.startCh
	<-i.finishCh

	// A new slow-path timeout and a new slow-path timeout
	if !i.fastStats.eq(1, 2, 1, 0, 0) || !i.slowStats.eq(1, 1, 1, 0, 0) {
		t.Fatalf("bad cache stats %+v %+v", i.fastStats, i.slowStats)
	}

	i.incNow(time.Second)
	run()
	// A new fast-path hit
	if !i.fastStats.eq(2, 2, 1, 0, 0) || !i.slowStats.eq(1, 1, 1, 0, 0) {
		t.Fatalf("bad cache stats %+v %+v", i.fastStats, i.slowStats)
	}

	arg.UserAssertion = "tacovontaco@twitter"
	i.incNow(time.Second)
	run()
	// A new slow-path hit; we have to use the slow path with assertions
	if !i.fastStats.eq(2, 2, 1, 0, 0) || !i.slowStats.eq(2, 1, 1, 0, 0) {
		t.Fatalf("bad cache stats %+v %+v", i.fastStats, i.slowStats)
	}
}

func TestIdentify2WithUIDLocalAssertions(t *testing.T) {
	tc := SetupEngineTest(t, "TestIdentify2WithUIDLocalAssertions")
	defer tc.Cleanup()
	i := newIdentify2WithUIDTester(tc.G)
	tc.G.Services = i
	arg := &keybase1.Identify2Arg{
		Uid: tracyUID,
	}

	run := func() {
		testArgs := &Identify2WithUIDTestArgs{
			cache: i,
			clock: func() time.Time { return i.now },
		}
		eng := NewIdentify2WithUID(tc.G, arg)
		eng.testArgs = testArgs
		ctx := Context{IdentifyUI: i}
		err := eng.Run(&ctx)
		if err != nil {
			t.Fatal(err)
		}
	}

	numTracyLoads := func() int {
		tracyUID := keybase1.UID("eb72f49f2dde6429e5d78003dae0c919")
		return i.userLoads[tracyUID]
	}

	// First time we'll cause an ID, so we need to start & finish
	arg.UserAssertion = "4ff50d580914427227bb14c821029e2c7cf0d488@" + libkb.PGPAssertionKey
	run()
	if n := numTracyLoads(); n != 1 {
		t.Fatalf("expected 1 full user load; got %d", n)
	}
	<-i.startCh
	<-i.finishCh

	// Don't attempt to hit fast cache, since we're using local assertions.
	if !i.fastStats.eq(0, 0, 0, 0, 0) || !i.slowStats.eq(0, 0, 1, 0, 0) {
		t.Fatalf("bad cache stats %+v %+v", i.fastStats, i.slowStats)
	}

	i.incNow(time.Second)
	run()
	// A new slow-path hit
	if !i.fastStats.eq(0, 0, 0, 0, 0) || !i.slowStats.eq(1, 0, 1, 0, 0) {
		t.Fatalf("bad cache stats %+v %+v", i.fastStats, i.slowStats)
	}
	if n := numTracyLoads(); n != 1 {
		t.Fatalf("expected 1 full user load; got %d", n)
	}
	arg.UserAssertion += "+tacovontaco@twitter"
	i.incNow(time.Second)
	run()
	// A new slow-path hit
	if !i.fastStats.eq(0, 0, 0, 0, 0) || !i.slowStats.eq(2, 0, 1, 0, 0) {
		t.Fatalf("bad cache stats %+v %+v", i.fastStats, i.slowStats)
	}
	if n := numTracyLoads(); n != 2 {
		t.Fatalf("expected 2 full user load; got %d", n)
	}

	i.incNow(libkb.Identify2CacheLongTimeout)
	run()
	<-i.startCh
	<-i.finishCh
	// A new slow-path timeout
	if !i.fastStats.eq(0, 0, 0, 0, 0) || !i.slowStats.eq(2, 1, 1, 0, 0) {
		t.Fatalf("bad cache stats %+v %+v", i.fastStats, i.slowStats)
	}

	i.incNow(time.Second)
	run()
	// A new slow-path hit
	if !i.fastStats.eq(0, 0, 0, 0, 0) || !i.slowStats.eq(3, 1, 1, 0, 0) {
		t.Fatalf("bad cache stats %+v %+v", i.fastStats, i.slowStats)
	}
}

func TestResolveAndIdentify2WithUIDWithAssertions(t *testing.T) {
	tc := SetupEngineTest(t, "Identify2WithUIDWithAssertion")
	defer tc.Cleanup()
	i := newIdentify2WithUIDTester(tc.G)
	tc.G.Services = i
	arg := &keybase1.Identify2Arg{
		UserAssertion: "tacovontaco@twitter+t_tracy@rooter",
	}
	eng := NewResolveThenIdentify2(tc.G, arg)
	eng.testArgs = &Identify2WithUIDTestArgs{
		noMe: true,
	}
	ctx := Context{IdentifyUI: i}
	err := eng.Run(&ctx)
	if err != nil {
		t.Fatal(err)
	}
	<-i.startCh
	<-i.finishCh
}

func TestIdentify2NoSigchain(t *testing.T) {
	tc := SetupEngineTest(t, "Identify2NoSigchain")
	defer tc.Cleanup()

	u, _ := createFakeUserWithNoKeys(tc)
	Logout(tc)

	i := newIdentify2WithUIDTester(tc.G)
	tc.G.Services = i
	arg := &keybase1.Identify2Arg{
		UserAssertion: u,
	}
	eng := NewResolveThenIdentify2(tc.G, arg)
	ctx := Context{IdentifyUI: i}

	err := eng.Run(&ctx)
	if err != nil {
		t.Fatalf("identify2 failed on user with no keys: %s", err)
	}

	// kbfs would like to have some info about the user
	result := eng.Result()
	if result == nil {
		t.Fatal("no result on id2 w/ no sigchain")
	}
	if result.Upk.Username != u {
		t.Errorf("result username: %q, expected %q", result.Upk.Username, u)
	}
}

// See CORE-4310
func TestIdentifyAfterDbNuke(t *testing.T) {

	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	trackAlice(tc, fu)
	defer untrackAlice(tc, fu)

	runIDAlice := func() {

		i := newIdentify2WithUIDTester(tc.G)
		arg := &keybase1.Identify2Arg{
			Uid: aliceUID,
		}
		eng := NewIdentify2WithUID(tc.G, arg)
		eng.testArgs = &Identify2WithUIDTestArgs{
			noCache: true,
		}
		ctx := Context{IdentifyUI: i}
		waiter := launchWaiter(t, i.finishCh)

		if err := eng.Run(&ctx); err != nil {
			t.Fatal(err)
		}
		waiter()
	}

	tc.G.Log.Debug("------------ ID Alice Iteration 0 ---------------")
	runIDAlice()
	if _, err := tc.G.LocalDb.Nuke(); err != nil {
		t.Fatal(err)
	}
	if err := tc.G.ConfigureCaches(); err != nil {
		t.Fatal(err)
	}
	tc.G.Log.Debug("------------ ID Alice Iteration 1 ---------------")
	runIDAlice()
}

func TestNoSelfHostedIdentifyInPassiveMode(t *testing.T) {
	tc := SetupEngineTest(t, "id")
	defer tc.Cleanup()

	eve := CreateAndSignupFakeUser(tc, "e")
	_, _, err := proveRooter(tc.G, eve)
	tc.G.ProofCache.DisableDisk()
	require.NoError(t, err)
	Logout(tc)

	alice := CreateAndSignupFakeUser(tc, "a")

	runTest := func(identifyBehavior keybase1.TLFIdentifyBehavior, returnUnchecked bool, shouldCheck bool, wantedMode libkb.ProofCheckerMode) {

		i := newIdentify2WithUIDTester(tc.G)
		checked := false
		i.checkStatusHook = func(l libkb.SigHint, pcm libkb.ProofCheckerMode) libkb.ProofError {
			checked = true
			if strings.Contains(l.GetHumanURL(), "rooter") {
				if !shouldCheck {
					t.Fatalf("should not have gotten a check; should have hit cache")
				}
				require.Equal(t, pcm, wantedMode, "we get a passive ID in GUI mode")
				if returnUnchecked {
					return libkb.ProofErrorUnchecked
				}
			}
			tc.G.Log.Debug("proof rubber-stamped: %s", l.GetHumanURL())
			return nil
		}

		tc.G.Services = i
		arg := &keybase1.Identify2Arg{
			Uid:              eve.UID(),
			IdentifyBehavior: identifyBehavior,
			NeedProofSet:     true,
		}
		eng := NewIdentify2WithUID(tc.G, arg)
		eng.testArgs = &Identify2WithUIDTestArgs{
			noMe: false,
		}
		ctx := Context{IdentifyUI: i}
		var waiter func()
		if !identifyBehavior.ShouldSuppressTrackerPopups() {
			waiter = launchWaiter(t, i.finishCh)
		}
		err = eng.Run(&ctx)
		require.NoError(t, err)
		require.Equal(t, checked, shouldCheck)
		if waiter != nil {
			waiter()
		}
	}

	// Alice ID's Eve, in chat mode, without a track. Assert that we get a
	// PASSIVE proof checker mode for rooter.
	runTest(keybase1.TLFIdentifyBehavior_CHAT_GUI, true, true, libkb.ProofCheckerModePassive)

	// Alice ID's Eve, in standard ID mode, without a track. Assert that we get a
	// ACTIVE proof checker mode for the rooter
	runTest(keybase1.TLFIdentifyBehavior_DEFAULT_KBFS, false, true, libkb.ProofCheckerModeActive)

	// Alice ID's Eve in chat mode, without a track. But she should hit the proof cache
	// from right above.
	runTest(keybase1.TLFIdentifyBehavior_CHAT_GUI, false, false, libkb.ProofCheckerModePassive)

	trackUser(tc, alice, eve.NormalizedUsername())

	tc.G.ProofCache.Reset()

	// Alice ID's Eve, in chat mode, with a track. Assert that we get an
	// Active proof checker mode for rooter.
	runTest(keybase1.TLFIdentifyBehavior_CHAT_GUI, true, true, libkb.ProofCheckerModeActive)
}

func TestSkipExternalChecks(t *testing.T) {
	arg := &keybase1.Identify2Arg{
		Uid:           tracyUID,
		CanSuppressUI: true,
	}
	arg.IdentifyBehavior = keybase1.TLFIdentifyBehavior_KBFS_REKEY
	_, err := identify2WithUIDWithBrokenTrackMakeEngine(t, arg)
	require.NoError(t, err)

	arg.IdentifyBehavior = keybase1.TLFIdentifyBehavior_KBFS_QR
	_, err = identify2WithUIDWithBrokenTrackMakeEngine(t, arg)
	require.NoError(t, err)

	arg.IdentifyBehavior = keybase1.TLFIdentifyBehavior_CHAT_CLI
	_, err = identify2WithUIDWithBrokenTrackMakeEngine(t, arg)
	require.Error(t, err)
}

var aliceUID = keybase1.UID("295a7eea607af32040647123732bc819")
var tracyUID = keybase1.UID("eb72f49f2dde6429e5d78003dae0c919")
var trackingUID = keybase1.UID("92b3b3dbe457059f28c9f74e8e6b9419")
var trackingServerReply = `{"seqno":3,"payload_hash":"c3ffe390e9c9dabdd5f7253b81e0a38fad2c17589a9c7fcd967958418055140a","sig_id":"4ec10665ad163d0aa419ce4eab8ff661429c9a3a32cd4978fdb8c6b5c6d047620f","sig_id_short":"TsEGZa0WPQqkGc5Oq4_2YUKcmjoyzUl4_bjG","kid":"0101f3b2f0e8c9d1f099db64cac366c6a9c1da63da624127b2f66a056acfa36834fe0a","sig":"-----BEGIN PGP MESSAGE-----\nVersion: Keybase OpenPGP v2.0.49\nComment: https://keybase.io/crypto\n\n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\nHzt0Q3P9OxPLmqeOPX3RVSPpG2YdtWQ=\n=h5Bq\n-----END PGP MESSAGE-----","payload_json":"{\"body\":{\"client\":{\"name\":\"keybase.io web\"},\"key\":{\"eldest_kid\":\"0101f3b2f0e8c9d1f099db64cac366c6a9c1da63da624127b2f66a056acfa36834fe0a\",\"fingerprint\":\"a889587e1ce7bd7edbe3eeb8ef8fd8f7b31c4a2f\",\"host\":\"keybase.io\",\"key_id\":\"ef8fd8f7b31c4a2f\",\"kid\":\"0101f3b2f0e8c9d1f099db64cac366c6a9c1da63da624127b2f66a056acfa36834fe0a\",\"uid\":\"92b3b3dbe457059f28c9f74e8e6b9419\",\"username\":\"tracy_friend1\"},\"track\":{\"basics\":{\"id_version\":14,\"last_id_change\":1449514728,\"username\":\"t_tracy\"},\"id\":\"eb72f49f2dde6429e5d78003dae0c919\",\"key\":{\"key_fingerprint\":\"\",\"kid\":\"01209bd2e255235529cf45877767ad8687d85200518adc74595d058750e2f7ab7b000a\"},\"pgp_keys\":[{\"key_fingerprint\":\"4ff50d580914427227bb14c821029e2c7cf0d488\",\"kid\":\"0101ee69b1566428109eb7548d9a9d7267d48933daa4614fa743cedbeac618ab66dd0a\"}],\"remote_proofs\":[{\"ctime\":1449512840,\"curr\":\"f09c84ccadf8817aea944526638e9a4c034c9200dd68b5a3292c7f69d980390d\",\"etime\":1954088840,\"prev\":\"909f6aa65b050ec5582515cad43aeb1f9279ee21db955cff309abe4692b7e11a\",\"remote_key_proof\":{\"check_data_json\":{\"name\":\"twitter\",\"username\":\"tacovontaco\"},\"proof_type\":2,\"state\":1},\"seqno\":5,\"sig_id\":\"67570e971c5b8881cf07179d1872a83042be4285ba897a8f12dc3e419cade80b0f\",\"sig_type\":2},{\"ctime\":1449512883,\"curr\":\"8ad8ce94c9d23d260750294905877ef92adf4e7736198909fcbe7e27d6dfb463\",\"etime\":1954088883,\"prev\":\"f09c84ccadf8817aea944526638e9a4c034c9200dd68b5a3292c7f69d980390d\",\"remote_key_proof\":{\"check_data_json\":{\"name\":\"github\",\"username\":\"tacoplusplus\"},\"proof_type\":3,\"state\":1},\"seqno\":6,\"sig_id\":\"bfe76a25acf046f7477350291cdd178e1f0026a49f85733d97c122ba4e4a000f0f\",\"sig_type\":2},{\"ctime\":1449512914,\"curr\":\"ea5bee1701e7ec7c8dfd71421bd2ab6fb0fa2af473412c664fa49d35c34078ea\",\"etime\":1954088914,\"prev\":\"8ad8ce94c9d23d260750294905877ef92adf4e7736198909fcbe7e27d6dfb463\",\"remote_key_proof\":{\"check_data_json\":{\"name\":\"rooter\",\"username\":\"t_tracy\"},\"proof_type\":100001,\"state\":1},\"seqno\":7,\"sig_id\":\"0c467de321795b777aa10916eb9aa8153bffa5163b5079600db7d50ca00a77410f\",\"sig_type\":2},{\"ctime\":1449514687,\"curr\":\"bfd3462a2193fa7946f7f31e5074cfc4ac95400680273deb520078a6a4f5cbf5\",\"etime\":1954090687,\"prev\":\"9ae84f56c0c62dc91206363b9f5609245f94199d58a4a3c0bee7d4bb91c47de7\",\"remote_key_proof\":{\"check_data_json\":{\"hostname\":\"keybase.io\",\"protocol\":\"https:\"},\"proof_type\":1000,\"state\":1},\"seqno\":9,\"sig_id\":\"92eeea3db99cb519409765c17ea32a82ce8b86bbacd8f366e8e8930f1faea20b0f\",\"sig_type\":2}],\"seq_tail\":{\"payload_hash\":\"bfd3462a2193fa7946f7f31e5074cfc4ac95400680273deb520078a6a4f5cbf5\",\"seqno\":9,\"sig_id\":\"92eeea3db99cb519409765c17ea32a82ce8b86bbacd8f366e8e8930f1faea20b0f\"}},\"type\":\"track\",\"version\":1},\"ctime\":1449514785,\"expire_in\":157680000,\"prev\":\"a4f76660341a087d69238f5a25e98d8b3d038224457107bad91ffdfbd82d84d9\",\"seqno\":3,\"tag\":\"signature\"}","sig_type":3,"ctime":1449514785,"etime":1607194785,"rtime":null,"sig_status":0,"prev":"a4f76660341a087d69238f5a25e98d8b3d038224457107bad91ffdfbd82d84d9","proof_id":null,"proof_type":null,"proof_text_check":null,"proof_text_full":null,"check_data_json":null,"remote_id":null,"api_url":null,"human_url":null,"proof_state":null,"proof_status":null,"retry_count":null,"hard_fail_count":null,"last_check":null,"last_success":null,"version":null,"fingerprint":"a889587e1ce7bd7edbe3eeb8ef8fd8f7b31c4a2f"}`
