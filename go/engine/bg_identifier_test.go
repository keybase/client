package engine

import (
	"fmt"
	"github.com/keybase/clockwork"
	"testing"
	"time"
)

const (
	bgIdentifyWaitClean       = 4 * time.Hour
	bgIdentifyWaitSoftFailure = 10 * time.Minute
	bgIdentifyWaitHardFailure = 90 * time.Minute
)

func TestBackgroundIdentifier(t *testing.T) {

	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)
	// to pick up the new clock...
	tc.G.ResetLoginState()

	_, tracy, err := runTrack(tc, fu, "t_tracy")
	if err != nil {
		t.Fatal(err)
	}
	defer runUntrack(tc.G, fu, "t_tracy")

	_, bob, err := runTrack(tc, fu, "t_bob")
	t.Logf("bob is %s", bob.GetUID())
	if err != nil {
		t.Fatal(err)
	}
	defer runUntrack(tc.G, fu, "t_bob")

	endCh := make(chan struct{})
	snoopCh := make(chan IdentifyJob, 100)

	bgi := NewBackgroundIdentifier(tc.G, endCh)
	ctx := Context{}
	bgi.SetSnooperChannel(snoopCh)
	bgi.testArgs = &BackgroundIdentifierTestArgs{
		identify2TestArgs: &Identify2WithUIDTestArgs{
			noCache:          true,
			clock:            func() time.Time { return fakeClock.Now() },
			forceRemoteCheck: true,
		},
	}

	// Settings might meet certain proportions below, so we can't
	// really fiddle with these without changing the tests.
	bgi.settings = BackgroundIdentifierSettings{
		WaitClean:       bgIdentifyWaitClean,
		WaitHardFailure: bgIdentifyWaitHardFailure,
		WaitSoftFailure: bgIdentifyWaitSoftFailure,
		DelaySlot:       time.Duration(0),
		Enabled:         true,
	}

	go func() {
		err = RunEngine(bgi, &ctx)
	}()

	pullExactlyOneJob := func() IdentifyJob {
		var ret IdentifyJob
		select {
		case ret = <-snoopCh:
		case <-time.After(30 * time.Second):
			t.Errorf("Failing after 10s of inactivity")
			t.Logf("Now is: %s", fakeClock.Now())
			t.Logf("Queue has:")
			for _, e := range bgi.queue {
				t.Logf("  %s %s", e.uid, e.nextRun)
			}
			panic("expected a job to be ready")
		}
		select {
		case job := <-snoopCh:
			panic(fmt.Sprintf("did not expect a second job; got %+v", job))
		default:
		}
		return ret
	}

	assertExactlyOneJob := func(i IdentifyJob) {
		job := pullExactlyOneJob()
		if job.uid != i.uid {
			panic("wrong UID %s")
		}
		if job.err != i.err {
			t.Errorf("Bad error status: (%+v) vs (%+v)", job.err, i.err)
			panic("job's error status was unexpected")
		}
	}

	assertNoJobs := func() {
		select {
		case job := <-snoopCh:
			t.Fatalf("did not expect any jobs; got %+v", job)
		default:
		}
	}

	advance := func(d time.Duration) {
		tc.G.Log.Debug("+ fakeClock#advance(%s) start: %s", d, fakeClock.Now())
		fakeClock.Advance(d)
		tc.G.Log.Debug("- fakeClock#adance(%s) end: %s", d, fakeClock.Now())
	}

	assertTracyAdded := func() {
		bgi.Add(tracy.GetUID())
		assertExactlyOneJob(IdentifyJob{uid: tracy.GetUID()})
		advance(bgIdentifyWaitClean + time.Second)
		assertExactlyOneJob(IdentifyJob{uid: tracy.GetUID()})
	}

	assertTracyAdded()

	bgi.Remove(tracy.GetUID())
	advance(bgIdentifyWaitClean + time.Hour)
	assertNoJobs()

	assertTracyAdded()
	advance(20 * time.Second)

	bgi.Add(bob.GetUID())
	assertExactlyOneJob(IdentifyJob{uid: bob.GetUID()})
	advance(bgIdentifyWaitClean - 5*time.Second)
	assertExactlyOneJob(IdentifyJob{uid: tracy.GetUID()})
	advance(10 * time.Second)
	assertExactlyOneJob(IdentifyJob{uid: bob.GetUID()})

	origXAPI := tc.G.XAPI
	flakeyAPI := flakeyRooterAPI{orig: origXAPI, flakeOut: true, G: tc.G}
	tc.G.XAPI = &flakeyAPI
	advance(bgIdentifyWaitClean - 5*time.Second)
	assertExactlyOneJob(IdentifyJob{uid: tracy.GetUID(), err: errBackgroundIdentifierBadProofsSoft})

	advance(10 * time.Second)
	assertExactlyOneJob(IdentifyJob{uid: bob.GetUID()})
	advance(bgIdentifyWaitSoftFailure)
	assertExactlyOneJob(IdentifyJob{uid: tracy.GetUID(), err: errBackgroundIdentifierBadProofsSoft})

	flakeyAPI.hardFail = true
	advance(bgIdentifyWaitSoftFailure + time.Second)
	assertExactlyOneJob(IdentifyJob{uid: tracy.GetUID(), err: errBackgroundIdentifierBadProofsHard})
	advance(bgIdentifyWaitSoftFailure + time.Second)
	assertNoJobs()

	advance(bgIdentifyWaitHardFailure + time.Second)
	assertExactlyOneJob(IdentifyJob{uid: tracy.GetUID(), err: errBackgroundIdentifierBadProofsHard})

	tc.G.XAPI = origXAPI
	advance(bgIdentifyWaitHardFailure + time.Second)
	assertExactlyOneJob(IdentifyJob{uid: tracy.GetUID()})
	advance(bgIdentifyWaitSoftFailure + time.Second)
	assertNoJobs()

	close(endCh)
	if err != nil {
		t.Fatal(err)
	}
}
