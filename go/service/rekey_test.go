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

func TestRekeyNeededMessageNoScores(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 1)
	defer tc.Cleanup()

	tc.G.SetService()

	kbUID := keybase1.MakeTestUID(1)
	gUID := gregor1.UID(kbUID.ToBytes())
	did, err := libkb.NewDeviceID()
	if err != nil {
		t.Fatal(err)
	}
	tc.G.Env.GetConfigWriter().SetUserConfig(libkb.NewUserConfig(kbUID, "", nil, did), true)

	h, err := newGregorHandler(tc.G)
	if err != nil {
		t.Fatal(err)
	}

	rekeyHandler := NewRekeyUIHandler(tc.G, 0)
	rekeyHandler.alwaysAlive = true
	h.PushHandler(rekeyHandler)

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
					Body_:     gregor1.Body(`[]`),
				},
			},
		},
	}

	if err := h.BroadcastMessage(context.Background(), m); err != nil {
		t.Fatal(err)
	}
}

const rekeyTLFs = `[
{ 
	"tlf": {
		"tlfid": "folder", 
		"name": "folder name", 
		"writers": ["t_alice"], 
		"readers": ["t_alice"], 
		"isPrivate": true
	},
	"problemUsers": [
		{
			"user": {
				"uid": "295a7eea607af32040647123732bc819",
				"username": "t_alice"
			},
			"problemDevices": [
				{
					"type": "mobile",
					"name": "phone",
					"deviceID": "1212121212"
				}
			]
		}
	],
	"score": 300,
	"solutions": ["13131313"]
}
]`

func TestRekeyNeededMessageWithScores(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 1)
	defer tc.Cleanup()

	tc.G.SetService()

	rkeyui := &fakeRekeyUI{}
	router := fakeUIRouter{
		rekeyUI: rkeyui,
	}
	tc.G.SetUIRouter(&router)

	clock := clockwork.NewFakeClock()
	tc.G.Clock = clock

	kbUID := keybase1.MakeTestUID(1)
	gUID := gregor1.UID(kbUID.ToBytes())
	did, err := libkb.NewDeviceID()
	if err != nil {
		t.Fatal(err)
	}
	tc.G.Env.GetConfigWriter().SetUserConfig(libkb.NewUserConfig(kbUID, "", nil, did), true)

	h, err := newGregorHandler(tc.G)
	if err != nil {
		t.Fatal(err)
	}

	rekeyHandler := NewRekeyUIHandler(tc.G, 0)
	rekeyHandler.alwaysAlive = true
	h.PushHandler(rekeyHandler)

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
					Body_:     gregor1.Body(rekeyTLFs),
				},
			},
		},
	}

	go func() {
		clock.BlockUntil(1)
		clock.Advance(3 * time.Second)
	}()

	if err := h.BroadcastMessage(context.Background(), m); err != nil {
		t.Fatal(err)
	}

	if len(rkeyui.refreshArgs) != 2 {
		t.Fatalf("rkeyui refresh calls: %d, expected 2", len(rkeyui.refreshArgs))
	}

	if len(rkeyui.refreshArgs[0].Tlfs) != 1 {
		t.Errorf("first refresh call, tlf count = %d, expected 1", len(rkeyui.refreshArgs[0].Tlfs))
	}
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

	tc.G.SetService()

	rkeyui := &fakeRekeyUI{}
	router := fakeUIRouter{
		rekeyUI: rkeyui,
	}
	tc.G.SetUIRouter(&router)

	clock := clockwork.NewFakeClock()
	tc.G.Clock = clock

	kbUID := keybase1.MakeTestUID(1)
	gUID := gregor1.UID(kbUID.ToBytes())
	did, err := libkb.NewDeviceID()
	if err != nil {
		t.Fatal(err)
	}
	tc.G.Env.GetConfigWriter().SetUserConfig(libkb.NewUserConfig(kbUID, "", nil, did), true)

	h, err := newGregorHandler(tc.G)
	if err != nil {
		t.Fatal(err)
	}

	rekeyHandler := NewRekeyUIHandler(tc.G, 0)
	rekeyHandler.alwaysAlive = true
	h.PushHandler(rekeyHandler)

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
					Body_:     gregor1.Body(rekeyTLFs),
				},
			},
		},
	}

	go func() {
		clock.BlockUntil(1)
		clock.Advance(3 * time.Second)
	}()

	if err := h.BroadcastMessage(context.Background(), m); err != nil {
		t.Fatal(err)
	}

	if len(rkeyui.refreshArgs) != 2 {
		t.Fatalf("rkeyui refresh calls: %d, expected 2", len(rkeyui.refreshArgs))
	}

	if len(rkeyui.refreshArgs[0].Tlfs) != 1 {
		t.Errorf("first refresh call, tlf count = %d, expected 1", len(rkeyui.refreshArgs[0].Tlfs))
	}
	if len(rkeyui.refreshArgs[1].Tlfs) != 0 {
		t.Errorf("second/final refresh call, tlf count = %d, expected 0", len(rkeyui.refreshArgs[1].Tlfs))
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
