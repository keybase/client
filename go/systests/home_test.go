package systests

import (
	"testing"
	"time"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
)

func getHome(t *testing.T, u *userPlusDevice, markViewed bool) keybase1.HomeScreen {
	g := u.tc.G
	cli, err := client.GetHomeClient(g)
	require.NoError(t, err)
	home, err := cli.HomeGetScreen(context.TODO(), keybase1.HomeGetScreenArg{MarkViewed: markViewed, NumFollowSuggestionsWanted: 10})
	require.NoError(t, err)
	return home
}

func markViewed(t *testing.T, u *userPlusDevice) {
	g := u.tc.G
	cli, err := client.GetHomeClient(g)
	require.NoError(t, err)
	err = cli.HomeMarkViewed(context.TODO())
	require.NoError(t, err)
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
			t.Logf("Checking todo item %v", todo)
			typ, err := todo.T()
			if err != nil {
				t.Fatal(err)
			}
			if typ == wanted {
				require.Equal(t, item.Badged, isBadged)
				return
			}
		} else {
			t.Logf("Non-todo item: %v", typ)
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

func findFollowerInHome(t *testing.T, home keybase1.HomeScreen, f string) (present, badged bool) {
	for _, item := range home.Items {
		typ, err := item.Data.T()
		if err != nil {
			t.Fatal(err)
		}
		if typ != keybase1.HomeScreenItemType_PEOPLE {
			continue
		}
		people := item.Data.People()
		ptyp, err := people.T()
		if err != nil {
			t.Fatal(err)
		}
		switch ptyp {
		case keybase1.HomeScreenPeopleNotificationType_FOLLOWED:
			follow := people.Followed()
			if follow.User.Username == f {
				return true, item.Badged
			}
		case keybase1.HomeScreenPeopleNotificationType_FOLLOWED_MULTI:
			for _, follow := range people.FollowedMulti().Followers {
				if follow.User.Username == f {
					return true, item.Badged
				}
			}
		}
	}
	return false, false
}

func postBio(t *testing.T, u *userPlusDevice) {
	g := u.tc.G
	cli, err := client.GetUserClient(g)
	require.NoError(t, err)
	arg := keybase1.ProfileEditArg{
		FullName: "Boaty McBoatface",
		Location: "The Sea, The Sea",
		Bio:      "Just your average stupidly named vessel",
	}
	err = cli.ProfileEdit(context.TODO(), arg)
	require.NoError(t, err)
}

type homeUI struct {
	refreshed bool
}

func (h *homeUI) HomeUIRefresh(_ context.Context) (err error) {
	h.refreshed = true
	return nil
}

// Wait for a gregor message to fill in the badge state, for at most ~10s.
// Hopefully this is enough for slow CI but you never know.
func pollForTrue(t *testing.T, g *libkb.GlobalContext, poller func(i int) bool) {
	// Hopefully this is enough for slow CI but you never know.
	wait := 10 * time.Millisecond * libkb.CITimeMultiplier(g)
	found := false
	for i := 0; i < 10; i++ {
		if poller(i) {
			found = true
			break
		}
		g.Log.Debug("Didn't get an update; waiting %s more", wait)
		time.Sleep(wait)
		wait *= 2
	}
	require.True(t, found, "whether condition was satisfied after polling ended")
}

func TestHome(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	// Let's add user with paper key, so we burn through "Paper Key" todo
	// item, and then we will still have two todo items lined up next with
	// one badged. This is a bit brittle since if the server-side logic
	// changes, this test will break. But let's leave it for now.
	tt.addUserWithPaper("alice")
	alice := tt.users[0]
	g := alice.tc.G

	home := getHome(t, alice, false)
	initialVersion := home.Version

	require.True(t, (initialVersion > 0), "initial version should be > 0")
	// Our first todo is VERIFY_ALL_EMAIL, that's badged
	assertTodoPresent(t, home, keybase1.HomeScreenTodoType_VERIFY_ALL_EMAIL, true /* isBadged */)
	// followed by BIO todo
	assertTodoPresent(t, home, keybase1.HomeScreenTodoType_BIO, false /* isBadged */)

	var countPre int
	pollForTrue(t, g, func(i int) bool {
		badges := getBadgeState(t, alice)
		g.Log.Debug("Iter loop %d badge state: %+v", i, badges)
		countPre = badges.HomeTodoItems
		return (countPre == 1)
	})

	hui := homeUI{}
	attachHomeUI(t, g, &hui)

	postBio(t, alice)

	pollForTrue(t, g, func(i int) bool {
		home = getHome(t, alice, false)
		badges := getBadgeState(t, alice)
		g.Log.Debug("Iter %d of check loop: Home is: %+v; BadgeState is: %+v", i, home, badges)
		return (home.Version > initialVersion && badges.HomeTodoItems < countPre)
	})

	pollForTrue(t, g, func(i int) bool {
		g.Log.Debug("Iter %d of check loop for home refresh; value is %v", i, hui.refreshed)
		return hui.refreshed
	})

	assertTodoNotPresent(t, home, keybase1.HomeScreenTodoType_BIO)

	tt.addUser("bob")
	bob := tt.users[1]
	iui := newSimpleIdentifyUI()
	attachIdentifyUI(t, bob.tc.G, iui)
	iui.confirmRes = keybase1.ConfirmResult{IdentityConfirmed: true, RemoteConfirmed: true, AutoConfirmed: true}
	bob.track(alice.username)

	var badged bool
	pollForTrue(t, g, func(i int) bool {
		home = getHome(t, alice, false)
		var present bool
		present, badged = findFollowerInHome(t, home, bob.username)
		return present
	})
	require.True(t, badged, "when we find bob, he should be badged")

	// This should clear the badge on bob in the home screen.
	markViewed(t, alice)

	pollForTrue(t, g, func(i int) bool {
		var present bool
		home = getHome(t, alice, false)
		present, badged = findFollowerInHome(t, home, bob.username)
		return present && !badged
	})
}

func attachHomeUI(t *testing.T, g *libkb.GlobalContext, hui keybase1.HomeUIInterface) {
	cli, xp, err := client.GetRPCClientWithContext(g)
	require.NoError(t, err)
	srv := rpc.NewServer(xp, nil)
	err = srv.Register(keybase1.HomeUIProtocol(hui))
	require.NoError(t, err)
	ncli := keybase1.DelegateUiCtlClient{Cli: cli}
	err = ncli.RegisterHomeUI(context.TODO())
	require.NoError(t, err)
}

func TestHomeBlockSpammer(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUserWithPaper("alice")
	alice := tt.users[0]

	tt.addUser("bob")
	bob := tt.users[1]
	tt.addUser("chaz")
	charlie := tt.users[2]

	trackAlice := func(u *userPlusDevice) {
		iui := newSimpleIdentifyUI()
		attachIdentifyUI(t, u.tc.G, iui)
		iui.confirmRes = keybase1.ConfirmResult{IdentityConfirmed: true, RemoteConfirmed: true, AutoConfirmed: true}
		u.track(alice.username)
	}

	trackAlice(bob)
	trackAlice(charlie)

	probeUserInAliceHome := func(u *userPlusDevice, shouldBePresent bool) {
		pollForTrue(t, alice.tc.G, func(i int) bool {
			home := getHome(t, alice, false)
			var present bool
			present, _ = findFollowerInHome(t, home, u.username)
			return (present == shouldBePresent)
		})
	}

	probeUserInAliceHome(bob, true)
	probeUserInAliceHome(charlie, true)

	alice.block(bob.username, true /*chat*/, false /*follow*/)
	probeUserInAliceHome(charlie, true)
	probeUserInAliceHome(bob, false)

	alice.block(charlie.username, false /*chat*/, true /*follow*/)
	probeUserInAliceHome(charlie, false)
	probeUserInAliceHome(bob, false)
}
