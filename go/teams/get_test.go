package teams

import (
	"encoding/hex"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func TestTeamGet(t *testing.T) {
	tc := libkb.SetupTest(t, "team", 1)
	tc.Tp.UpgradePerUserKey = true
	defer tc.Cleanup()

	kbtest.CreateAndSignupFakeUser("team", tc.G)

	name := createTeam(tc)

	_, err := Get(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
}

func TestTeamApplicationKey(t *testing.T) {
	tc := libkb.SetupTest(t, "team", 1)
	tc.Tp.UpgradePerUserKey = true
	defer tc.Cleanup()

	kbtest.CreateAndSignupFakeUser("team", tc.G)

	name := createTeam(tc)

	team, err := Get(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}

	chatKey, err := team.ChatKey(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if chatKey.Application != keybase1.TeamApplication_CHAT {
		t.Errorf("key application: %d, expected %d", chatKey.Application, keybase1.TeamApplication_CHAT)
	}
	if chatKey.Generation() != 1 {
		t.Errorf("key generation: %d, expected 1", chatKey.Generation())
	}
	if len(chatKey.Key) != 32 {
		t.Errorf("key length: %d, expected 32", len(chatKey.Key))
	}
}

func TestTeamGetRepeat(t *testing.T) {
	t.Skip("not needed")
	// in order to try to repro in CI, run this 10 times
	for i := 0; i < 10; i++ {
		tc := libkb.SetupTest(t, "team", 1)
		tc.Tp.UpgradePerUserKey = true
		defer tc.Cleanup()

		kbtest.CreateAndSignupFakeUser("team", tc.G)

		name := createTeam(tc)

		_, err := Get(context.TODO(), tc.G, name)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestTeamGetWhileCreate(t *testing.T) {
	t.Skip("this found create team bug")
	tc := libkb.SetupTest(t, "team", 1)
	tc.Tp.UpgradePerUserKey = true
	defer tc.Cleanup()

	kbtest.CreateAndSignupFakeUser("team", tc.G)

	name := createTeam(tc)

	for i := 0; i < 100; i++ {
		go createTeam(tc)
		time.Sleep(10 * time.Millisecond)
	}

	for i := 0; i < 100; i++ {
		_, err := Get(context.TODO(), tc.G, name)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestTeamGetConcurrent(t *testing.T) {
	t.Skip("this is slow but it passes")
	work := make(chan bool)

	for i := 0; i < 10; i++ {
		go func() {
			for x := range work {
				_ = x
				teamGet(t)
			}
		}()
	}

	for j := 0; j < 100; j++ {
		work <- true
	}
}

func teamGet(t *testing.T) {
	tc := libkb.SetupTest(t, "team", 1)
	tc.Tp.UpgradePerUserKey = true
	defer tc.Cleanup()

	kbtest.CreateAndSignupFakeUser("team", tc.G)

	name := createTeam(tc)

	_, err := Get(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
}

func createTeam(tc libkb.TestContext) string {
	b, err := libkb.RandBytes(4)
	if err != nil {
		tc.T.Fatal(err)
	}
	name := hex.EncodeToString(b)
	err = CreateRootTeam(context.TODO(), tc.G, name)
	if err != nil {
		tc.T.Fatal(err)
	}
	return name
}
