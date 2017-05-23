package teams

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
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
	name, err := kbtest.CreateTeam(tc.G)
	if err != nil {
		tc.T.Fatal(err)
	}
	return name
}
