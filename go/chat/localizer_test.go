package chat

import (
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

func TestLocalizerPipeline(t *testing.T) {
	ctx, world, ri2, _, sender, _ := setupTest(t, 3)
	defer world.Cleanup()

	ri := ri2.(*kbtest.ChatRemoteMock)
	u := world.GetUsers()[0]
	u1 := world.GetUsers()[1]
	u2 := world.GetUsers()[2]
	uid := u.User.GetUID().ToBytes()
	tc := world.Tcs[u.Username]
	<-tc.Context().ConvLoader.Stop(ctx)

	var convs []chat1.Conversation
	_, conv := newConv(ctx, t, tc, uid, ri, sender, u.Username+","+u1.Username)
	convs = append(convs, conv)
	_, conv = newConv(ctx, t, tc, uid, ri, sender, u.Username+","+u2.Username)
	convs = append(convs, conv)
	_, conv = newConv(ctx, t, tc, uid, ri, sender, u.Username+","+u2.Username+","+u1.Username)
	convs = append(convs, conv)

	delay := 2 * time.Second
	pipeline := newLocalizerPipeline(tc.Context())
	jobCh := make(chan *localizerPipelineJob)
	pipeline.useGateCh = true
	pipeline.jobPulledCh = jobCh
	pipeline.start(ctx)
	runLocalize := func() chan types.AsyncInboxResult {
		localizeCh := make(chan types.AsyncInboxResult, 1)
		localizer := newNonblockingLocalizer(tc.Context(), pipeline, localizeCh)
		_, err := localizer.Localize(ctx, uid, types.Inbox{
			ConvsUnverified: utils.RemoteConvs(convs),
		}, nil)
		require.NoError(t, err)
		require.NotNil(t, <-localizeCh)
		return localizeCh
	}
	unGateAndCheck := func(job *localizerPipelineJob, localizeCh chan types.AsyncInboxResult) {
		select {
		case job.gateCh <- struct{}{}:
		case <-time.After(delay):
			require.Fail(t, "unable to ungate")
		}
		select {
		case res := <-localizeCh:
			require.Nil(t, res.ConvLocal.Error)
		case <-time.After(delay):
			require.Fail(t, "no result")
		}
	}
	getJob := func() *localizerPipelineJob {
		select {
		case job := <-jobCh:
			return job
		case <-time.After(delay):
			require.Fail(t, "no job")
		}
		return nil
	}
	noRes := func(ch chan types.AsyncInboxResult) {
		select {
		case v := <-ch:
			require.Fail(t, fmt.Sprintf("should be no job: %#v", v))
		default:
		}
	}
	resClosed := func(ch chan types.AsyncInboxResult) {
		select {
		case v := <-ch:
			require.True(t, v.Conv.GetConvID().IsNil())
		case <-time.After(delay):
			require.Fail(t, "no close")
		}
	}

	t.Logf("basic")
	localizeCh := runLocalize()
	job := getJob()
	noRes(localizeCh)
	unGateAndCheck(job, localizeCh)
	unGateAndCheck(job, localizeCh)
	unGateAndCheck(job, localizeCh)
	resClosed(localizeCh)

	t.Logf("suspend")
	localizeCh = runLocalize()
	job = getJob()
	noRes(localizeCh)
	unGateAndCheck(job, localizeCh)
	require.False(t, pipeline.suspend(ctx))
	unGateAndCheck(job, localizeCh)
	unGateAndCheck(job, localizeCh)
	resClosed(localizeCh)
	pipeline.resume(ctx)

	t.Logf("suspend (cancelable)")
	ctx = globals.CtxAddLocalizerCancelable(ctx)
	localizeCh = runLocalize()
	job = getJob()
	noRes(localizeCh)
	unGateAndCheck(job, localizeCh)
	require.True(t, pipeline.suspend(ctx))
	pipeline.resume(ctx)
	job = getJob()
	unGateAndCheck(job, localizeCh)
	unGateAndCheck(job, localizeCh)
	resClosed(localizeCh)

	t.Logf("suspend multiple")
	ctx = globals.CtxAddLocalizerCancelable(ctx)
	localizeCh = runLocalize()
	job = getJob()
	noRes(localizeCh)
	unGateAndCheck(job, localizeCh)
	require.True(t, pipeline.suspend(ctx))
	require.False(t, pipeline.suspend(ctx))
	pipeline.resume(ctx)
	noRes(localizeCh)
	pipeline.resume(ctx)
	job = getJob()
	unGateAndCheck(job, localizeCh)
	unGateAndCheck(job, localizeCh)
	resClosed(localizeCh)
}
