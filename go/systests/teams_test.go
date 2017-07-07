package systests

import (
	"strings"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func TestTeamCreate(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUser("onr")
	tt.addUser("wtr")

	team := tt.users[0].createTeam()
	tt.users[0].addTeamMember(team, tt.users[1].username, keybase1.TeamRole_WRITER)
}

func TestTeamRotateOnRevoke(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUser("onr")
	tt.addUser("wtr")

	team := tt.users[0].createTeam()
	tt.users[0].addTeamMember(team, tt.users[1].username, keybase1.TeamRole_WRITER)

	// get the before state of the team
	before, err := teams.GetForTeamManagementByStringName(context.TODO(), tt.users[0].tc.G, team)
	if err != nil {
		t.Fatal(err)
	}
	if before.Generation() != 1 {
		t.Errorf("generation before rotate: %d, expected 1", before.Generation())
	}
	secretBefore := before.Data.PerTeamKeySeeds[before.Generation()].Seed.ToBytes()

	// User1 should get a gregor that the team he was just added to changed.
	tt.users[1].waitForTeamChagnedGregor(team, keybase1.Seqno(2))
	// User0 should get a (redundant) gregor notification that
	// he just changed the team.
	tt.users[0].waitForTeamChagnedGregor(team, keybase1.Seqno(2))

	tt.users[1].revokePaperKey()
	tt.users[0].waitForRotate(team, keybase1.Seqno(3))

	// check that key was rotated for team
	after, err := teams.GetForTeamManagementByStringName(context.TODO(), tt.users[0].tc.G, team)
	if err != nil {
		t.Fatal(err)
	}
	if after.Generation() != 2 {
		t.Errorf("generation after rotate: %d, expected 2", after.Generation())
	}
	secretAfter := after.Data.PerTeamKeySeeds[after.Generation()].Seed.ToBytes()
	if libkb.SecureByteArrayEq(secretAfter, secretBefore) {
		t.Fatal("team secret did not change when rotated")
	}
}

type teamTester struct {
	t     *testing.T
	users []*userPlusDevice
}

func newTeamTester(t *testing.T) *teamTester {
	return &teamTester{t: t}
}

func (tt *teamTester) addUser(pre string) {
	tctx := setupTest(tt.t, pre)
	var u userPlusDevice
	u.device = &deviceWrapper{tctx: tctx}
	u.device.start(0)

	userInfo := randomUser(pre)
	tc := u.device.tctx
	g := tc.G
	signupUI := signupUI{
		info:         userInfo,
		Contextified: libkb.NewContextified(g),
	}
	g.SetUI(&signupUI)
	signup := client.NewCmdSignupRunner(g)
	signup.SetTest()
	if err := signup.Run(); err != nil {
		tt.t.Fatal(err)
	}
	tt.t.Logf("signed up %s", userInfo.username)

	u.username = userInfo.username
	u.uid = libkb.UsernameToUID(u.username)
	u.tc = tc

	cli, xp, err := client.GetRPCClientWithContext(g)
	if err != nil {
		tt.t.Fatal(err)
	}
	u.deviceClient = keybase1.DeviceClient{Cli: cli}

	// register for notifications
	u.notifications = newTeamNotifyHandler()
	srv := rpc.NewServer(xp, nil)
	if err = srv.Register(keybase1.NotifyTeamProtocol(u.notifications)); err != nil {
		tt.t.Fatal(err)
	}
	ncli := keybase1.NotifyCtlClient{Cli: cli}
	if err = ncli.SetNotifications(context.TODO(), keybase1.NotificationChannels{
		Team: true,
	}); err != nil {
		tt.t.Fatal(err)
	}

	tt.users = append(tt.users, &u)
}

func (tt *teamTester) cleanup() {
	for _, u := range tt.users {
		u.device.tctx.Cleanup()
	}
}

type userPlusDevice struct {
	uid           keybase1.UID
	username      string
	device        *deviceWrapper
	tc            *libkb.TestContext
	deviceClient  keybase1.DeviceClient
	notifications *teamNotifyHandler
}

func (u *userPlusDevice) createTeam() string {
	create := client.NewCmdTeamCreateRunner(u.tc.G)
	name, err := libkb.RandString("tt", 5)
	if err != nil {
		u.tc.T.Fatal(err)
	}
	create.TeamName = strings.ToLower(name)
	if err := create.Run(); err != nil {
		u.tc.T.Fatal(err)
	}
	return create.TeamName
}

func (u *userPlusDevice) addTeamMember(team, username string, role keybase1.TeamRole) {
	add := client.NewCmdTeamAddMemberRunner(u.tc.G)
	add.Team = team
	add.Username = username
	add.Role = role
	add.SkipChatNotification = true // kbfs client currently required to do this...
	if err := add.Run(); err != nil {
		u.tc.T.Fatal(err)
	}
}

func (u *userPlusDevice) revokePaperKey() {
	id := u.paperKeyID()

	runner := client.NewCmdDeviceRemoveRunner(u.tc.G)
	runner.SetIDOrName(id.String())
	if err := runner.Run(); err != nil {
		u.tc.T.Fatal(err)
	}
}

func (u *userPlusDevice) devices() []keybase1.Device {
	d, err := u.deviceClient.DeviceList(context.TODO(), 0)
	if err != nil {
		u.tc.T.Fatal(err)
	}
	return d
}

func (u *userPlusDevice) paperKeyID() keybase1.DeviceID {
	for _, d := range u.devices() {
		if d.Type == libkb.DeviceTypePaper {
			return d.DeviceID
		}
	}
	u.tc.T.Fatal("no paper key found")
	return keybase1.DeviceID("")
}

func (u *userPlusDevice) waitForTeamChagnedGregor(team string, toSeqno keybase1.Seqno) {
	// process 10 team rotations or 10s worth of time
	for i := 0; i < 10; i++ {
		select {
		case arg := <-u.notifications.rotateCh:
			u.tc.T.Logf("membership change received: %+v", arg)
			if arg.TeamName == team && arg.Changes.MembershipChanged && !arg.Changes.KeyRotated && !arg.Changes.Renamed && arg.LatestSeqno == toSeqno {
				u.tc.T.Logf("change matched!")
				return
			}
			u.tc.T.Logf("ignoring change message")
		case <-time.After(1 * time.Second):
		}
	}
	u.tc.T.Fatalf("timed out waiting for team rotate %s", team)
}

func (u *userPlusDevice) waitForRotate(team string, toSeqno keybase1.Seqno) {
	// jump start the clkr queue processing loop
	u.kickTeamRekeyd()

	// process 10 team rotations or 10s worth of time
	for i := 0; i < 10; i++ {
		select {
		case arg := <-u.notifications.rotateCh:
			u.tc.T.Logf("rotate received: %+v", arg)
			if arg.TeamName == team && arg.Changes.KeyRotated && arg.LatestSeqno == toSeqno {
				u.tc.T.Logf("rotate matched!")
				return
			}
			u.tc.T.Logf("ignoring rotate message")
		case <-time.After(1 * time.Second):
		}
	}
	u.tc.T.Fatalf("timed out waiting for team rotate %s", team)
}

func (u *userPlusDevice) kickTeamRekeyd() {
	kickTeamRekeyd(u.tc.G, u.tc.T)
}

func kickTeamRekeyd(g *libkb.GlobalContext, t testing.TB) {
	apiArg := libkb.APIArg{
		Endpoint: "test/accelerate_team_rekeyd",
		Args: libkb.HTTPArgs{
			"timeout": libkb.I{Val: 2000},
		},
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err := g.API.Post(apiArg)
	if err != nil {
		t.Fatalf("Failed to accelerate team rekeyd: %s", err)
	}
}

type teamNotifyHandler struct {
	rotateCh chan keybase1.TeamChangedArg
}

func newTeamNotifyHandler() *teamNotifyHandler {
	return &teamNotifyHandler{
		rotateCh: make(chan keybase1.TeamChangedArg, 1),
	}
}

func (n *teamNotifyHandler) TeamChanged(ctx context.Context, arg keybase1.TeamChangedArg) error {
	n.rotateCh <- arg
	return nil
}
