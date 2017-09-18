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
	"github.com/stretchr/testify/require"
)

func TestTeamCreate(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUser("onr")
	tt.addUser("wtr")

	team := tt.users[0].createTeam()
	tt.users[0].addTeamMember(team, tt.users[1].username, keybase1.TeamRole_WRITER)
}

func TestTeamBustCache(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUser("onr")
	tt.addUser("adm")
	tt.addUser("wtr")

	team := tt.users[0].createTeam()
	tt.users[0].addTeamMember(team, tt.users[1].username, keybase1.TeamRole_ADMIN)

	before, err := GetTeamForTestByStringName(context.TODO(), tt.users[0].tc.G, team)
	require.NoError(t, err)
	beforeSeqno := before.CurrentSeqno()
	tt.users[1].addTeamMember(team, tt.users[2].username, keybase1.TeamRole_WRITER)

	// Poll for an update, we should get it as soon as gregor tells us to bust our cache.
	backoff := 100 * time.Millisecond
	found := false
	for i := 0; i < 10; i++ {
		after, err := teams.Load(context.TODO(), tt.users[0].tc.G, keybase1.LoadTeamArg{
			Name:    team,
			StaleOK: true,
		})
		require.NoError(t, err)
		if after.CurrentSeqno() > beforeSeqno {
			t.Logf("Found new seqno %d at poll loop iter %d", after.CurrentSeqno(), i)
			found = true
			break
		}
		t.Logf("Still at old generation %d at poll loop iter %d", beforeSeqno, i)
		time.Sleep(backoff)
		backoff += backoff / 2
	}
	require.True(t, found)
}

func TestTeamRotateOnRevoke(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUser("onr")
	tt.addUser("wtr")

	team := tt.users[0].createTeam()
	tt.users[0].addTeamMember(team, tt.users[1].username, keybase1.TeamRole_WRITER)

	// get the before state of the team
	before, err := GetTeamForTestByStringName(context.TODO(), tt.users[0].tc.G, team)
	if err != nil {
		t.Fatal(err)
	}
	if before.Generation() != 1 {
		t.Errorf("generation before rotate: %d, expected 1", before.Generation())
	}
	secretBefore := before.Data.PerTeamKeySeeds[before.Generation()].Seed.ToBytes()

	// User1 should get a gregor that the team he was just added to changed.
	tt.users[1].waitForTeamChangedGregor(team, keybase1.Seqno(2))
	// User0 should get a (redundant) gregor notification that
	// he just changed the team.
	tt.users[0].waitForTeamChangedGregor(team, keybase1.Seqno(2))

	tt.users[1].revokePaperKey()
	tt.users[0].waitForRotate(team, keybase1.Seqno(3))

	// check that key was rotated for team
	after, err := GetTeamForTestByStringName(context.TODO(), tt.users[0].tc.G, team)
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

func (tt *teamTester) addUser(pre string) *userPlusDevice {
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

	u.teamsClient = keybase1.TeamsClient{Cli: cli}

	g.ConfigureConfig()

	tt.users = append(tt.users, &u)
	return &u
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
	teamsClient   keybase1.TeamsClient
	notifications *teamNotifyHandler
}

func (u *userPlusDevice) createTeam() string {
	create := client.NewCmdTeamCreateRunner(u.tc.G)
	nameStr, err := libkb.RandString("tt", 5)
	if err != nil {
		u.tc.T.Fatal(err)
	}
	name, err := keybase1.TeamNameFromString(strings.ToLower(nameStr))
	if err != nil {
		u.tc.T.Fatal(err)
	}
	create.TeamName = name
	if err := create.Run(); err != nil {
		u.tc.T.Fatal(err)
	}
	return create.TeamName.String()
}

func (u *userPlusDevice) createTeam2() (teamID keybase1.TeamID, teamName keybase1.TeamName) {
	name := u.createTeam()
	team, err := teams.Load(context.Background(), u.tc.G, keybase1.LoadTeamArg{
		Name: name,
	})
	require.NoError(u.tc.T, err)
	return team.ID, team.Name()
}

func (u *userPlusDevice) addTeamMember(team, username string, role keybase1.TeamRole) {
	add := client.NewCmdTeamAddMemberRunner(u.tc.G)
	add.Team = team
	add.Username = username
	add.Role = role
	if err := add.Run(); err != nil {
		u.tc.T.Fatal(err)
	}
}

func (u *userPlusDevice) changeTeamMember(team, username string, role keybase1.TeamRole) {
	change := client.NewCmdTeamEditMemberRunner(u.tc.G)
	change.Team = team
	change.Username = username
	change.Role = keybase1.TeamRole_OWNER
	if err := change.Run(); err != nil {
		u.tc.T.Fatal(err)
	}
}

func (u *userPlusDevice) addTeamMemberEmail(team, email string, role keybase1.TeamRole) {
	add := client.NewCmdTeamAddMemberRunner(u.tc.G)
	add.Team = team
	add.Email = email
	add.Role = role
	if err := add.Run(); err != nil {
		u.tc.T.Fatal(err)
	}
}

func (u *userPlusDevice) readInviteEmails(email string) []string {
	arg := libkb.NewAPIArg("test/team/get_tokens")
	arg.Args = libkb.NewHTTPArgs()
	arg.Args.Add("email", libkb.S{Val: email})
	res, err := u.tc.G.API.Get(arg)
	if err != nil {
		u.tc.T.Fatal(err)
	}
	tokens := res.Body.AtKey("tokens")
	n, err := tokens.Len()
	if err != nil {
		u.tc.T.Fatal(err)
	}
	if n == 0 {
		u.tc.T.Fatalf("no invite tokens for %s", email)
	}

	exp := make([]string, n)
	for i := 0; i < n; i++ {
		token, err := tokens.AtIndex(i).GetString()
		if err != nil {
			u.tc.T.Fatal(err)
		}
		exp[i] = token
	}

	return exp
}

func (u *userPlusDevice) acceptEmailInvite(token string) {
	c := client.NewCmdTeamAcceptInviteRunner(u.tc.G)
	c.Token = token
	if err := c.Run(); err != nil {
		u.tc.T.Fatal(err)
	}
}

func (u *userPlusDevice) acceptInviteOrRequestAccess(tokenOrName string) {
	err := teams.TeamAcceptInviteOrRequestAccess(context.TODO(), u.tc.G, tokenOrName)
	require.NoError(u.tc.T, err)
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

func (u *userPlusDevice) userVersion() keybase1.UserVersion {
	return keybase1.UserVersion{Uid: u.uid, EldestSeqno: 1}
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

func (u *userPlusDevice) waitForTeamChangedGregor(team string, toSeqno keybase1.Seqno) {
	// process 10 team rotations or 10s worth of time
	for i := 0; i < 10; i++ {
		select {
		case arg := <-u.notifications.rotateCh:
			u.tc.T.Logf("membership change received: %+v", arg)
			if arg.TeamName == team && arg.Changes.MembershipChanged && !arg.Changes.KeyRotated && !arg.Changes.Renamed && arg.LatestSeqno == toSeqno {
				u.tc.T.Logf("change matched!")
				return
			}
			u.tc.T.Logf("ignoring change message (expected team = %q, seqno = %d)", team, toSeqno)
		case <-time.After(1 * time.Second):
		}
	}
	u.tc.T.Fatalf("timed out waiting for team rotate %s", team)
}

func (u *userPlusDevice) waitForTeamIDChangedGregor(teamID keybase1.TeamID, toSeqno keybase1.Seqno) {
	// process 10 team rotations or 10s worth of time
	for i := 0; i < 10; i++ {
		select {
		case arg := <-u.notifications.rotateCh:
			u.tc.T.Logf("membership change received: %+v", arg)
			if arg.TeamID.Eq(teamID) && arg.Changes.MembershipChanged && !arg.Changes.KeyRotated && !arg.Changes.Renamed && arg.LatestSeqno == toSeqno {
				u.tc.T.Logf("change matched!")
				return
			}
			u.tc.T.Logf("ignoring change message (expected teamID = %q, seqno = %d)", teamID.String(), toSeqno)
		case <-time.After(1 * time.Second):
		}
	}
	u.tc.T.Fatalf("timed out waiting for team rotate %s", teamID.String())
}

func (u *userPlusDevice) drainGregor() {
	for i := 0; i < 1000; i++ {
		select {
		case <-u.notifications.rotateCh:
			u.tc.T.Logf("dropped notification")
			// drop
		case <-time.After(500 * time.Millisecond):
			u.tc.T.Logf("no notification received, drain complete")
			return
		}
	}
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

func (u *userPlusDevice) waitForTeamChangedAndRotated(team string, toSeqno keybase1.Seqno) {
	// process 10 team rotations or 10s worth of time
	for i := 0; i < 10; i++ {
		select {
		case arg := <-u.notifications.rotateCh:
			u.tc.T.Logf("membership change received: %+v", arg)
			if arg.TeamName == team && arg.Changes.MembershipChanged && arg.Changes.KeyRotated && !arg.Changes.Renamed && arg.LatestSeqno == toSeqno {
				u.tc.T.Logf("change matched!")
				return
			}
			u.tc.T.Logf("ignoring change message (expected team = %q, seqno = %d)", team, toSeqno)
		case <-time.After(1 * time.Second):
		}
	}
	u.tc.T.Fatalf("timed out waiting for team rotate %s", team)
}

func (u *userPlusDevice) proveRooter() {
	cmd := client.NewCmdProveRooterRunner(u.tc.G, u.username)
	if err := cmd.Run(); err != nil {
		u.tc.T.Fatal(err)
	}
}

func (u *userPlusDevice) track(username string) {
	trackCmd := client.NewCmdTrackRunner(u.tc.G)
	trackCmd.SetUser(username)
	trackCmd.SetOptions(keybase1.TrackOptions{BypassConfirm: true})
	err := trackCmd.Run()
	require.NoError(u.tc.T, err)
}

func (u *userPlusDevice) getTeamSeqno(teamID keybase1.TeamID) keybase1.Seqno {
	team, err := teams.Load(context.Background(), u.tc.G, keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(u.tc.T, err)
	return team.CurrentSeqno()
}

func (u *userPlusDevice) kickTeamRekeyd() {
	kickTeamRekeyd(u.tc.G, u.tc.T)
}

func (u *userPlusDevice) lookupImplicitTeam(create bool, displayName string, public bool) (keybase1.TeamID, error) {
	cli := u.teamsClient
	var err error
	var teamID keybase1.TeamID
	if create {
		teamID, err = cli.LookupOrCreateImplicitTeam(context.TODO(), keybase1.LookupOrCreateImplicitTeamArg{Name: displayName, Public: public})
	} else {
		teamID, err = cli.LookupImplicitTeam(context.TODO(), keybase1.LookupImplicitTeamArg{Name: displayName, Public: public})
	}

	return teamID, err
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

func GetTeamForTestByStringName(ctx context.Context, g *libkb.GlobalContext, name string) (*teams.Team, error) {
	return teams.Load(ctx, g, keybase1.LoadTeamArg{
		Name:        name,
		ForceRepoll: true,
	})
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

func (n *teamNotifyHandler) TeamDeleted(ctx context.Context, teamID keybase1.TeamID) error {
	return nil
}

func TestGetTeamRootID(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUser("onr")

	t.Logf("create a team")
	parentName, err := keybase1.TeamNameFromString(tt.users[0].createTeam())
	require.NoError(t, err)

	parentID := parentName.ToTeamID()

	t.Logf("create a subteam")
	subteamID, err := teams.CreateSubteam(context.TODO(), tt.users[0].tc.G, "mysubteam", parentName)
	require.NoError(t, err)

	subteamName, err := parentName.Append("mysubteam")

	t.Logf("create a sub-subteam")
	subteamID2, err := teams.CreateSubteam(context.TODO(), tt.users[0].tc.G, "teamofsubs", subteamName)
	require.NoError(t, err)

	getAndCompare := func(id keybase1.TeamID) {
		retID, err := teams.GetRootID(context.TODO(), tt.users[0].tc.G, id)
		require.NoError(t, err)
		require.Equal(t, parentID, retID)
	}

	getAndCompare(*subteamID)
	getAndCompare(*subteamID2)
	getAndCompare(parentID)
}
