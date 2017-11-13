package systests

import (
	"github.com/keybase/client/go/client"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
	"testing"
	"time"
)

func getHome(t *testing.T, u *userPlusDevice, markViewed bool) keybase1.HomeScreen {
	g := u.tc.G
	cli, err := client.GetHomeClient(g)
	require.NoError(t, err)
	home, err := cli.HomeGetScreen(context.TODO(), markViewed)
	require.NoError(t, err)
	return home
}

func getBadgeState(t *testing.T, u *userPlusDevice) keybase1.BadgeState {
	g := u.tc.G
	cli, err := client.GetBadgerClient(g)
	require.NoError(t, err)
	ret, err := cli.GetBadgeState(context.TODO())
	require.NoError(t, err)
	return ret
}

func assertTodoPresent(t *testing.T, home keybase1.HomeScreen, wanted keybase1.HomeScreenTodoType, isBadged bool) {
	for _, item := range home.Items {
		typ, err := item.Data.T()
		if err != nil {
			t.Fatal(err)
		}
		if typ == keybase1.HomeScreenItemType_TODO {
			todo := item.Data.Todo()
			typ, err := todo.T()
			if err != nil {
				t.Fatal(err)
			}
			if typ == wanted {
				require.Equal(t, item.Badged, isBadged)
				return
			}
		}
	}
	t.Fatalf("Failed to find type %s in %+v", wanted, home)
}

func assertTodoNotPresent(t *testing.T, home keybase1.HomeScreen, wanted keybase1.HomeScreenTodoType) {
	for _, item := range home.Items {
		typ, err := item.Data.T()
		if err != nil {
			t.Fatal(err)
		}
		if typ == keybase1.HomeScreenItemType_TODO {
			todo := item.Data.Todo()
			typ, err := todo.T()
			if err != nil {
				t.Fatal(err)
			}
			if typ == wanted {
				t.Fatalf("Found type %s in %+v, but didn't want to ", wanted, home)
			}
		}
	}
}

func TestHome(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUser("alice")
	alice := tt.users[0]
	g := alice.tc.G
	tt.addUser("wong")
	wong := tt.users[1]

	home := getHome(t, alice, true)
	initialVersion := home.Version
	require.True(t, (initialVersion > 0), "initial version should be > 0")
	assertTodoPresent(t, home, keybase1.HomeScreenTodoType_FOLLOW, true)
	badges := getBadgeState(t, alice)
	g.Log.Debug("Previous badge state: %+v", badges)
	countPre := badges.HomeTodoItems

	iui := newSimpleIdentifyUI()
	iui.confirmRes = keybase1.ConfirmResult{IdentityConfirmed: true, RemoteConfirmed: true, AutoConfirmed: true}
	attachIdentifyUI(t, g, iui)
	alice.track(wong.username)

	// Wait for a gregor message to bust this cache, at most ~10s. Hopeully this is enough for
	// slow CI but you never know.
	wait := 10 * time.Millisecond
	found := false
	for i := 0; i < 10; i++ {
		home = getHome(t, alice, true)
		badges = getBadgeState(t, alice)
		g.Log.Debug("Iter %d of check loop: Home is: %+v; BadgeState is: %+v", i, home, badges)
		if home.Version > initialVersion && badges.HomeTodoItems < countPre {
			found = true
			break
		}
		g.Log.Debug("Didn't get an update; waiting %s more", wait)
		time.Sleep(wait)
		wait = wait * 2
	}
	require.True(t, found, "we found the new version of home (after waiting for the gregor message to refresh us")
	assertTodoNotPresent(t, home, keybase1.HomeScreenTodoType_FOLLOW)
}
