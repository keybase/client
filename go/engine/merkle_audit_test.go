// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/clockwork"
)

func TestMerkleAuditWork(t *testing.T) {
	tc := SetupEngineTest(t, "merkleaudit")
	defer tc.Cleanup()

	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)

	advance := func(d time.Duration) {
		tc.G.Log.Debug("+ fakeClock#advance(%s) start: %s", d, fakeClock.Now())
		fakeClock.Advance(d)
		tc.G.Log.Debug("- fakeClock#adance(%s) end: %s", d, fakeClock.Now())
	}

	metaCh := make(chan string, 100)
	roundResCh := make(chan error, 100)
	arg := &MerkleAuditArgs{
		testingMetaCh:     metaCh,
		testingRoundResCh: roundResCh,
	}
	eng := NewMerkleAudit(tc.G, arg)
	eng.task.args.Settings.StartStagger = 0 // Disable stagger for deterministic testing
	m := NewMetaContextForTest(tc)
	err := RunEngine2(m, eng)
	require.NoError(t, err)

	// Run a manual root fetch to populate the client
	_, err = tc.G.MerkleClient.FetchRootFromServer(m, time.Hour)
	require.NoError(t, err)

	expectMeta(t, metaCh, "loop-start")
	advance(MerkleAuditSettings.Start + time.Second)
	expectMeta(t, metaCh, "woke-start")

	// first run doesn't do anything
	select {
	case x := <-roundResCh:
		require.Equal(t, nil, x, "round result")
	case <-time.After(30 * time.Second):
		require.FailNow(t, "channel timed out")
	}
	expectMeta(t, metaCh, "loop-round-complete")

	eng.Shutdown()
	expectMeta(t, metaCh, "loop-exit")
	expectMeta(t, metaCh, "")
}

type retryMerkleAuditMock struct {
	*libkb.APIArgRecorder
	tc  libkb.TestContext
	api libkb.API

	getError error
	args     []libkb.APIArg
	resps    []*libkb.APIRes
}

func newRetryMerkleAuditMock(tc libkb.TestContext) *retryMerkleAuditMock {
	return &retryMerkleAuditMock{
		APIArgRecorder: libkb.NewAPIArgRecorder(),
		tc:             tc,
		api:            tc.G.API,
	}
}

func (r *retryMerkleAuditMock) GetDecode(mctx libkb.MetaContext, arg libkb.APIArg, w libkb.APIResponseWrapper) error {
	r.args = append(r.args, arg)
	if r.getError != nil {
		return nil
	}

	return r.api.GetDecode(mctx, arg, w)
}

func (r *retryMerkleAuditMock) Get(mctx libkb.MetaContext, arg libkb.APIArg) (*libkb.APIRes, error) {
	r.args = append(r.args, arg)
	if r.getError != nil {
		r.resps = append(r.resps, nil)
		return nil, r.getError
	}

	res, err := r.api.Get(mctx, arg)
	r.resps = append(r.resps, res)
	if err != nil {
		return nil, err
	}

	return res, nil
}

func (r *retryMerkleAuditMock) resetHistory() {
	r.args = nil
	r.resps = nil
}

func TestMerkleAuditRetry(t *testing.T) {
	tc := SetupEngineTest(t, "merkleaudit")
	defer tc.Cleanup()

	api := newRetryMerkleAuditMock(tc)
	tc.G.API = api

	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)

	advance := func(d time.Duration) {
		tc.G.Log.Debug("+ fakeClock#advance(%s) start: %s", d, fakeClock.Now())
		fakeClock.Advance(d)
		tc.G.Log.Debug("- fakeClock#adance(%s) end: %s", d, fakeClock.Now())
	}

	metaCh := make(chan string, 100)
	roundResCh := make(chan error, 100)
	arg := &MerkleAuditArgs{
		testingMetaCh:     metaCh,
		testingRoundResCh: roundResCh,
	}
	eng := NewMerkleAudit(tc.G, arg)
	eng.task.args.Settings.StartStagger = 0 // Disable stagger for deterministic testing
	m := NewMetaContextForTest(tc)
	err := RunEngine2(m, eng)
	require.NoError(t, err)

	// Run a manual root fetch
	_, err = tc.G.MerkleClient.FetchRootFromServer(m, time.Hour)
	require.NoError(t, err)

	require.NotEmpty(t, api.args)
	require.NotEmpty(t, api.resps)
	require.Equal(t, "merkle/root", api.args[0].Endpoint)

	// Make sure that the initial root fetch worked
	_, err = api.resps[0].Body.AtKey("seqno").GetInt64()
	require.NoError(t, err)

	// Make the mock return an error on API.Get
	internalTestError := errors.New("Fake internal test error")
	api.getError = internalTestError
	api.resetHistory()

	expectMeta(t, metaCh, "loop-start")
	advance(MerkleAuditSettings.Start + time.Second)
	expectMeta(t, metaCh, "woke-start")

	// first run should fail and write into leveldb
	select {
	case x := <-roundResCh:
		require.Equal(t, internalTestError, x, "round result #1")
	case <-time.After(30 * time.Second):
		require.FailNow(t, "channel timed out")
	}
	expectMeta(t, metaCh, "loop-round-complete")

	// Figure out what seqno we were trying to fetch
	require.NotEmpty(t, api.args)
	require.Equal(t, "merkle/path", api.args[0].Endpoint)
	startSeqnoStr := api.args[0].Args["start_seqno"].String()
	startSeqno, err := strconv.ParseInt(startSeqnoStr, 10, 64)
	require.NoError(t, err)

	tc.G.Log.Debug("Expecting the next iteration to look up %d", startSeqno)

	// The second try should be exactly the same
	api.resetHistory()

	advance(MerkleAuditSettings.Interval + time.Second)
	expectMeta(t, metaCh, "woke-interval")
	expectMeta(t, metaCh, "woke-wakeup")
	select {
	case x := <-roundResCh:
		require.Equal(t, internalTestError, x, "round result #2")
	case <-time.After(30 * time.Second):
		require.FailNow(t, "channel timed out")
	}
	expectMeta(t, metaCh, "loop-round-complete")

	require.NotEmpty(t, api.args)
	require.Equal(t, "merkle/path", api.args[0].Endpoint)
	require.Equal(t, startSeqnoStr, api.args[0].Args["start_seqno"].String())
	tc.G.Log.Debug("The second iteration correctly tried to look up %d", startSeqno)

	// Reset the mock and retry, now succeeding
	api.getError = nil
	api.resetHistory()

	advance(MerkleAuditSettings.Interval + time.Second)
	expectMeta(t, metaCh, "woke-interval")
	expectMeta(t, metaCh, "woke-wakeup")

	select {
	case x := <-roundResCh:
		require.Equal(t, nil, x, "round result #3")
	case <-time.After(30 * time.Second):
		require.FailNow(t, "channel timed out")
	}
	expectMeta(t, metaCh, "loop-round-complete")

	require.NotEmpty(t, api.args)
	require.NotEmpty(t, api.resps)
	require.Equal(t, "merkle/path", api.args[0].Endpoint)

	successfulSeqno, err := api.resps[0].Body.AtKey("root").AtKey("seqno").GetInt64()
	require.NoError(t, err)
	require.Equal(t, startSeqno, successfulSeqno, "result #3 seqno")
	tc.G.Log.Debug("Third iteration succeeded on validating %d.", successfulSeqno)

	// Fourth iteration should try to audit another block
	api.resetHistory()

	advance(MerkleAuditSettings.Interval + time.Second)
	expectMeta(t, metaCh, "woke-interval")
	expectMeta(t, metaCh, "woke-wakeup")

	select {
	case x := <-roundResCh:
		require.Equal(t, nil, x, "round result #4")
	case <-time.After(30 * time.Second):
		require.FailNow(t, "channel timed out")
	}
	expectMeta(t, metaCh, "loop-round-complete")

	require.NotEmpty(t, api.args)
	require.NotEmpty(t, api.resps)
	require.Equal(t, "merkle/path", api.args[0].Endpoint)

	differentSeqno, err := api.resps[0].Body.AtKey("root").AtKey("seqno").GetInt64()
	require.NoError(t, err)
	require.NotEqual(t, startSeqno, differentSeqno, "result #4 seqno")
	tc.G.Log.Debug("Fourth iteration succeeded on validating another root, %d.", differentSeqno)

	eng.Shutdown()
	expectMeta(t, metaCh, "loop-exit")
	expectMeta(t, metaCh, "")
}

type merkleAuditErrorListener struct {
	libkb.NoopNotifyListener

	merkleAuditError chan string
}

var _ libkb.NotifyListener = (*merkleAuditErrorListener)(nil)

func (m *merkleAuditErrorListener) RootAuditError(msg string) {
	m.merkleAuditError <- msg
}

func TestMerkleAuditFail(t *testing.T) {
	tc := SetupEngineTest(t, "merkleaudit")
	defer tc.Cleanup()

	api := newRetryMerkleAuditMock(tc)
	tc.G.API = api

	tc.G.SetService()
	notifyListener := &merkleAuditErrorListener{
		merkleAuditError: make(chan string),
	}
	tc.G.NotifyRouter.AddListener(notifyListener)

	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)

	advance := func(d time.Duration) {
		tc.G.Log.Debug("+ fakeClock#advance(%s) start: %s", d, fakeClock.Now())
		fakeClock.Advance(d)
		tc.G.Log.Debug("- fakeClock#adance(%s) end: %s", d, fakeClock.Now())
	}

	metaCh := make(chan string, 100)
	roundResCh := make(chan error, 100)
	arg := &MerkleAuditArgs{
		testingMetaCh:     metaCh,
		testingRoundResCh: roundResCh,
	}
	eng := NewMerkleAudit(tc.G, arg)
	eng.task.args.Settings.StartStagger = 0 // Disable stagger for deterministic testing
	m := NewMetaContextForTest(tc)
	err := RunEngine2(m, eng)
	require.NoError(t, err)

	// Run a manual root fetch
	_, err = tc.G.MerkleClient.FetchRootFromServer(m, time.Hour)
	require.NoError(t, err)

	require.NotEmpty(t, api.args)
	require.NotEmpty(t, api.resps)
	require.Equal(t, "merkle/root", api.args[0].Endpoint)

	// Make sure that the initial root fetch worked
	x, err := api.resps[0].Body.AtKey("seqno").GetInt64()
	tc.G.Log.Debug("last seqno %d", x)
	require.NoError(t, err)

	// Make the mock return an error on API.Get
	validationError := libkb.NewClientMerkleSkipHashMismatchError("test error")
	api.getError = validationError
	api.resetHistory()

	expectMeta(t, metaCh, "loop-start")
	advance(MerkleAuditSettings.Start + time.Second)
	expectMeta(t, metaCh, "woke-start")

	// first run should fail and send a notification
	select {
	case x := <-notifyListener.merkleAuditError:
		require.Regexp(t, "Merkle tree audit from [0-9]+ failed: Error checking merkle tree: test error", x, "notification message")
	case <-time.After(30 * time.Second):
		require.FailNow(t, "channel timed out")
	}
	select {
	case x := <-roundResCh:
		require.Equal(t, validationError, x, "round result")
	case <-time.After(30 * time.Second):
		require.FailNow(t, "channel timed out")
	}
	expectMeta(t, metaCh, "loop-round-complete")

	eng.Shutdown()
	expectMeta(t, metaCh, "loop-exit")
	expectMeta(t, metaCh, "")
}
