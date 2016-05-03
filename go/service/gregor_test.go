package service

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/gregor/protocol/gregor1"
)

func TestGregorHandler(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor")
	defer tc.Cleanup()

	h := newGregorHandler(tc.G)
	if h.HandlerName() != "keybase service" {
		t.Errorf("handler name: %q, expected \"keybase service\"", h.HandlerName())
	}

	m := gregor1.Message{
		Oobm_: &gregor1.OutOfBandMessage{
			System_: "kbfs.favorites",
			Body_:   gregor1.Body(`{"action": "delete", "tlf":"/private/t_alice,t_bob"}`),
		},
	}
	if err := h.BroadcastMessage(context.Background(), m); err != nil {
		t.Fatal(err)
	}
}
