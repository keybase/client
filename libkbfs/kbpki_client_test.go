package libkbfs

// XXX these tests are not good.  I made them to develop kbkpi_client, but
// they will only work for me with my daemon, users, etc.
//
// Because of this, I set them all to skip for now.

import (
	"github.com/keybase/client/go/libkb"
	"sync"
	"testing"
)

var once sync.Once

func setup() {
	once.Do(func() {
		libkb.G.Init()
		libkb.G.ConfigureConfig()
		libkb.G.ConfigureSocketInfo()
	})
}

func TestClientResolveAssertion(t *testing.T) {
	t.Skip()
	setup()
	c := NewKBPKIClient()
	u, err := c.ResolveAssertion("pc")
	if err != nil {
		t.Fatal(err)
	}
	if u == nil {
		t.Fatal("nil user")
	}
}

func TestClientGetUser(t *testing.T) {
	t.Skip()
	setup()
	c := NewKBPKIClient()
	uid, err := libkb.UidFromHex("eb0dc47af5eec0e6b94135445cedf700")
	if err != nil {
		t.Fatal(err)
	}
	u, err := c.GetUser(*uid)
	if err != nil {
		t.Fatal(err)
	}
	if u == nil {
		t.Fatal("nil user")
	}
}
