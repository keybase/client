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

	kbUID := keybase1.MakeTestUID(1)
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
	rekeyHandler.notifyComplete = make(chan int, 10)
	rekeyHandler.scorer = fakeScoreProblemFolders
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
					Ctime_: gregor1.ToTime(tc.G.Clock.Now()),
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
	tc := libkb.SetupTest(t, "gregor", 1)
	defer tc.Cleanup()

	gUID, h, _ := rekeySetup(tc)

	// Test that a broadcast with an empty body works.
	rekeyBroadcast(tc, gUID, h, `{}`)
}

const problemSet = `{ 
	"user": {
		"uid": "295a7eea607af32040647123732bc819",
		"username": "t_alice"
	},
	"kid": "011212121212121212121212121212121212121212121212121212121212121212120a",
	"tlfs": [
		{
			"tlf": {
				"tlfid": "folder", 
				"name": "folder name", 
				"writers": ["t_alice"], 
				"readers": ["t_alice"], 
				"isPrivate": true
			},
			"score": 300,
			"solutions": ["011313131313131313131313131313131313131313131313131313131313131313130a"]
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
	tc.G.Clock = clock

	gUID, h, rekeyHandler := rekeySetup(tc)

	go func() {
		clock.BlockUntil(1)
		clock.Advance(3 * time.Second)
	}()

	rekeyBroadcast(tc, gUID, h, problemSet)

	<-rekeyHandler.notifyComplete

	// Test that refresh was called twice.
	if len(rkeyui.refreshArgs) != 2 {
		t.Fatalf("rkeyui refresh calls: %d, expected 2", len(rkeyui.refreshArgs))
	}

	// the first call should contain a TLF
	if len(rkeyui.refreshArgs[0].Tlfs) != 1 {
		t.Errorf("first refresh call, tlf count = %d, expected 1", len(rkeyui.refreshArgs[0].Tlfs))
	}
	// the second call should have updated the scores, and have no more TLFs in it.
	if len(rkeyui.refreshArgs[1].Tlfs) != 0 {
		t.Errorf("second/final refresh call, tlf count = %d, expected 0", len(rkeyui.refreshArgs[1].Tlfs))
	}
}

type fakeRekeyUI struct {
	sessionID   int
	refreshArgs []keybase1.RefreshArg
}

// A rekey is needed, but the user closes the rekey status window.
func TestRekeyNeededUserClose(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 1)
	defer tc.Cleanup()

	rkeyui := &fakeRekeyUI{}
	router := fakeUIRouter{
		rekeyUI: rkeyui,
	}
	tc.G.SetUIRouter(&router)

	clock := clockwork.NewFakeClock()
	tc.G.Clock = clock

	gUID, h, rekeyHandler := rekeySetup(tc)

	rekeyBroadcast(tc, gUID, h, problemSet)

	clock.BlockUntil(1)
	h.RekeyStatusFinish(context.Background(), rkeyui.sessionID)
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

	if len(rkeyui.refreshArgs[0].Tlfs) != 1 {
		t.Errorf("first refresh call, tlf count = %d, expected 1", len(rkeyui.refreshArgs[0].Tlfs))
	}
}

func (f *fakeRekeyUI) DelegateRekeyUI(ctx context.Context) (int, error) {
	f.sessionID++
	return f.sessionID, nil
}

func (f *fakeRekeyUI) Refresh(ctx context.Context, arg keybase1.RefreshArg) error {
	f.refreshArgs = append(f.refreshArgs, arg)
	return nil
}

func fakeScoreProblemFolders(g *libkb.GlobalContext, existing keybase1.ProblemSet) (keybase1.ProblemSet, error) {
	// always return empty ProblemSet
	return keybase1.ProblemSet{}, nil
}
