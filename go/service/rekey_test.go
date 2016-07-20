package service

import (
	"testing"
	"time"

	"github.com/jonboulle/clockwork"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/gregor/protocol/gregor1"
)

func rekeySetup(tc libkb.TestContext) (gregor1.UID, *gregorHandler, *RekeyUIHandler) {
	tc.G.SetService()

	kbUID, err := keybase1.UIDFromString("9f9611a4b7920637b1c2a839b2a0e119")
	if err != nil {
		tc.T.Fatal(err)
	}
	gUID := gregor1.UID(kbUID.ToBytes())
	did, err := libkb.NewDeviceID()
	if err != nil {
		tc.T.Fatal(err)
	}
	tc.G.Env.GetConfigWriter().SetUserConfig(libkb.NewUserConfig(kbUID, "", nil, did), true)

	h, err := newGregorHandler(tc.G)
	if err != nil {
		tc.T.Fatal(err)
	}

	rekeyHandler := NewRekeyUIHandler(tc.G, 0)
	rekeyHandler.alwaysAlive = true
	rekeyHandler.notifyStart = make(chan int, 10)
	rekeyHandler.notifyComplete = make(chan int, 10)
	rekeyHandler.scorer = fakeScoreProblemFoldersEmpty
	h.PushHandler(rekeyHandler)

	return gUID, h, rekeyHandler
}

func rekeyBroadcast(tc libkb.TestContext, gUID gregor1.UID, h *gregorHandler, body string) {
	msgID := gregor1.MsgID("my_random_id")
	m := gregor1.Message{
		Ibm_: &gregor1.InBandMessage{
			StateUpdate_: &gregor1.StateUpdateMessage{
				Md_: gregor1.Metadata{
					MsgID_: msgID,
					Ctime_: gregor1.ToTime(tc.G.Clock().Now()),
					Uid_:   gUID,
				},
				Creation_: &gregor1.Item{
					Category_: gregor1.Category("kbfs_tlf_rekey_needed"),
					Body_:     gregor1.Body(body),
				},
			},
		},
	}

	if err := h.BroadcastMessage(context.Background(), m); err != nil {
		tc.T.Fatal(err)
	}

}

func TestRekeyNeededMessageNoScores(t *testing.T) {
	t.Skip()
	tc := libkb.SetupTest(t, "gregor", 1)
	defer tc.Cleanup()

	gUID, h, _ := rekeySetup(tc)

	// Test that a broadcast with an empty body works.
	rekeyBroadcast(tc, gUID, h, `{}`)
}

const problemSet = `{
	"user": {
		"uid": "9f9611a4b7920637b1c2a839b2a0e119",
		"username": "t_frank"
	},
	"kid": "01206f31b54690a95a1a60a0d8861c8ec27c322b49a93b475a631ee6a676018bfd140a",
	"tlfs": [
		{
			"tlf": {
				"tlfid": "folder",
				"name": "folder name",
				"writers": ["t_frank","t_george"],
				"readers": ["t_alice"],
				"isPrivate": true
			},
			"score": 300,
			"solution_kids": ["01206f31b54690a95a1a60a0d8861c8ec27c322b49a93b475a631ee6a676018bfd140a"]
		}
	]
}`

func TestRekeyNeededMessageWithScores(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 1)
	defer tc.Cleanup()

	rkeyui := &fakeRekeyUI{}
	router := fakeUIRouter{
		rekeyUI: rkeyui,
	}
	tc.G.SetUIRouter(&router)

	clock := clockwork.NewFakeClock()
	tc.G.SetClock(clock)

	gUID, h, rekeyHandler := rekeySetup(tc)

	rekeyBroadcast(tc, gUID, h, problemSet)

	select {
	case <-rekeyHandler.notifyStart:
	case <-time.After(20 * time.Second):
		t.Fatal("timeout waiting for rekeyHandler.notifyStart")
	}

	done := make(chan struct{})
	defer close(done)
	go func() {
		for {
			select {
			case <-done:
				return
			default:
				clock.Advance(1 * time.Second)
			}
		}
	}()

	select {
	case <-rekeyHandler.notifyComplete:
	case <-time.After(20 * time.Second):
		t.Fatal("timeout waiting for rekeyHandler.notifyComplete")
	}

	// Test that refresh was called twice.
	if len(rkeyui.refreshArgs) != 2 {
		t.Fatalf("rkeyui refresh calls: %d, expected 2", len(rkeyui.refreshArgs))
	}

	// the first call should contain a TLF
	if len(rkeyui.refreshArgs[0].ProblemSetDevices.ProblemSet.Tlfs) != 1 {
		t.Errorf("first refresh call, tlf count = %d, expected 1", len(rkeyui.refreshArgs[0].ProblemSetDevices.ProblemSet.Tlfs))
	}
	// the second call should have updated the scores, and have no more TLFs in it.
	if len(rkeyui.refreshArgs[1].ProblemSetDevices.ProblemSet.Tlfs) != 0 {
		t.Errorf("second/final refresh call, tlf count = %d, expected 0", len(rkeyui.refreshArgs[1].ProblemSetDevices.ProblemSet.Tlfs))
	}

	// check the devices field
	if len(rkeyui.refreshArgs[0].ProblemSetDevices.Devices) != 1 {
		t.Fatalf("num devices: %d, expected 1", len(rkeyui.refreshArgs[0].ProblemSetDevices.Devices))
	}
	d := rkeyui.refreshArgs[0].ProblemSetDevices.Devices[0]
	if d.DeviceID != "640ee4f517c2a0ff190456952df26e18" {
		t.Errorf("device id: %v, expected 640ee4f517c2a0ff190456952df26e18", d.DeviceID)
	}
	if d.VerifyKey != "01206f31b54690a95a1a60a0d8861c8ec27c322b49a93b475a631ee6a676018bfd140a" {
		t.Errorf("device verify key: %v, expected 01206f31b54690a95a1a60a0d8861c8ec27c322b49a93b475a631ee6a676018bfd140a", d.VerifyKey)
	}
}

type fakeRekeyUI struct {
	sessionID     int
	refreshArgs   []keybase1.RefreshArg
	notifyRefresh chan bool
}

// A rekey is needed, but the user closes the rekey status window.
func TestRekeyNeededUserClose(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 1)
	defer tc.Cleanup()

	rkeyui := &fakeRekeyUI{}
	rkeyui.notifyRefresh = make(chan bool, 10)
	router := fakeUIRouter{
		rekeyUI: rkeyui,
	}
	tc.G.SetUIRouter(&router)

	clock := clockwork.NewFakeClock()
	tc.G.SetClock(clock)

	gUID, h, rekeyHandler := rekeySetup(tc)

	rekeyBroadcast(tc, gUID, h, problemSet)

	select {
	case <-rekeyHandler.notifyStart:
	case <-time.After(20 * time.Second):
		t.Fatal("timeout waiting for rekeyHandler.notifyStart")
	}

	// since this is testing that the user closes a rekey status window,
	// wait for the refresh call:
	select {
	case <-rkeyui.notifyRefresh:
	case <-time.After(20 * time.Second):
		t.Fatal("timeout waiting for rekeyui.notifyRefresh")
	}

	// now call finish
	outcome, err := h.RekeyStatusFinish(context.Background(), rkeyui.sessionID)
	if err != nil {
		t.Fatal(err)
	}
	if outcome != keybase1.Outcome_IGNORED {
		t.Fatalf("RekeyStatusFinish outcome: %v, expected %v", outcome, keybase1.Outcome_IGNORED)
	}

	clock.Advance(3 * time.Second)

	select {
	case <-rekeyHandler.notifyComplete:
	case <-time.After(20 * time.Second):
		t.Fatal("timeout waiting for rekeyHandler.notifyComplete")
	}

	// there should be one call to refresh to bring the window up, but then the RekeyStatusFinish call above
	// should close the window and stop the loop.
	if len(rkeyui.refreshArgs) != 1 {
		t.Fatalf("rkeyui refresh calls: %d, expected 1", len(rkeyui.refreshArgs))
	}

	if len(rkeyui.refreshArgs[0].ProblemSetDevices.ProblemSet.Tlfs) != 1 {
		t.Errorf("first refresh call, tlf count = %d, expected 1", len(rkeyui.refreshArgs[0].ProblemSetDevices.ProblemSet.Tlfs))
	}
}

// After user cancels rekey harass window, it should be spawned 24h later.
func TestRekeyReharass(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 1)
	defer tc.Cleanup()

	rkeyui := &fakeRekeyUI{}
	rkeyui.notifyRefresh = make(chan bool, 10)
	router := fakeUIRouter{
		rekeyUI: rkeyui,
	}
	tc.G.SetUIRouter(&router)

	clock := clockwork.NewFakeClock()
	tc.G.SetClock(clock)

	gUID, gregorHandler, rekeyUIHandler := rekeySetup(tc)

	// need a RekeyHandler for this test too (it has the rekey reharass loop in it)
	// creating it here to fake the time.Ticker
	rekeyHandler := &RekeyHandler{
		Contextified: libkb.NewContextified(tc.G),
		gregor:       gregorHandler,
		scorer:       fakeScoreProblemFoldersFull,
	}
	ticker := make(chan time.Time)
	go rekeyHandler.recheckRekeyStatusTicker(ticker)

	rekeyBroadcast(tc, gUID, gregorHandler, problemSet)

	// 1. start
	select {
	case <-rekeyUIHandler.notifyStart:
	case <-time.After(20 * time.Second):
		t.Fatal("timeout waiting for rekeyUIHandler.notifyStart")
	}

	// 2. refresh called on ui
	select {
	case <-rkeyui.notifyRefresh:
	case <-time.After(20 * time.Second):
		t.Fatal("timeout waiting for rekeyui.notifyRefresh")
	}

	// 3. user cancels rekey window
	outcome, err := rekeyHandler.RekeyStatusFinish(context.Background(), rkeyui.sessionID)
	if err != nil {
		t.Fatal(err)
	}
	if outcome != keybase1.Outcome_IGNORED {
		t.Fatalf("RekeyStatusFinish outcome: %v, expected %v", outcome, keybase1.Outcome_IGNORED)
	}

	clock.Advance(3 * time.Second)

	// 4. wait for it to finish
	select {
	case <-rekeyUIHandler.notifyComplete:
	case <-time.After(20 * time.Second):
		t.Fatal("timeout waiting for rekeyHandler.notifyComplete")
	}

	// There should only be one call to refresh to bring the window up
	// The RekeyStatusFinish call above should close the window and stop the loop.
	if len(rkeyui.refreshArgs) != 1 {
		t.Fatalf("rkeyui refresh calls: %d, expected 1", len(rkeyui.refreshArgs))
	}

	// A recheck deadline should be set
	if rekeyHandler.isRecheckDeadlineZero() {
		t.Fatalf("rekeyHandler recheckDeadline is zero, it should be set to a time in the future")
	}

	// 5. fast-forward 25h
	clock.Advance(25 * time.Hour)
	ticker <- clock.Now()

	// 6. rekey updater loop should start up again
	select {
	case <-rekeyUIHandler.notifyStart:
	case <-time.After(20 * time.Second):
		t.Fatal("timeout waiting for rekeyUIHandler.notifyStart")
	}

	// 7. refresh called on ui
	select {
	case <-rkeyui.notifyRefresh:
	case <-time.After(20 * time.Second):
		t.Fatal("timeout waiting for rekeyui.notifyRefresh")
	}

	// make sure refresh was called again
	if len(rkeyui.refreshArgs) != 2 {
		t.Fatalf("rkeyui refresh calls: %d, expected 2", len(rkeyui.refreshArgs))
	}
}

func (f *fakeRekeyUI) DelegateRekeyUI(ctx context.Context) (int, error) {
	f.sessionID++
	return f.sessionID, nil
}

func (f *fakeRekeyUI) Refresh(ctx context.Context, arg keybase1.RefreshArg) error {
	f.refreshArgs = append(f.refreshArgs, arg)
	select {
	case f.notifyRefresh <- true:
	default:
	}
	return nil
}

func fakeScoreProblemFoldersEmpty(g *libkb.GlobalContext, existing keybase1.ProblemSet) (keybase1.ProblemSet, error) {
	// always return empty ProblemSet
	return keybase1.ProblemSet{}, nil
}

func fakeScoreProblemFoldersFull(g *libkb.GlobalContext, existing keybase1.ProblemSet) (keybase1.ProblemSet, error) {
	return keybase1.ProblemSet{
		Tlfs: []keybase1.ProblemTLF{
			{
				Tlf: keybase1.TLF{
					Id:   "tlfid",
					Name: "problemdir",
				},
			},
		},
	}, nil
}
