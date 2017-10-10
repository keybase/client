package systests

import (
	"strings"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/engine"
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

func TestImplicitTeamRotateOnRevokePrivate(t *testing.T) {
	testImplicitTeamRotateOnRevoke(t, false)
}

func TestImplicitTeamRotateOnRevokePublic(t *testing.T) {
	t.Skip("Test skipped until CORE-6322: public team support")
	testImplicitTeamRotateOnRevoke(t, true)
}

func testImplicitTeamRotateOnRevoke(t *testing.T, public bool) {
	t.Logf("public: %v", public)
	tt := newTeamTester(t)
	defer tt.cleanup()

	alice := tt.addUser("alice")

	tt.addUser("bob")
	bob := tt.users[1]

	iTeamName := strings.Join([]string{alice.username, bob.username}, ",")

	t.Logf("make an implicit team")
	team, err := alice.lookupImplicitTeam(true /*create*/, iTeamName, public)
	require.NoError(t, err)

	// get the before state of the team
	before, err := GetTeamForTestByID(context.TODO(), alice.tc.G, team, public)
	require.NoError(t, err)
	require.Equal(t, keybase1.PerTeamKeyGeneration(1), before.Generation())
	secretBefore := before.Data.PerTeamKeySeeds[before.Generation()].Seed.ToBytes()

	bob.revokePaperKey()
	alice.waitForRotateByID(team, keybase1.Seqno(2))

	// check that key was rotated for team
	after, err := GetTeamForTestByID(context.TODO(), alice.tc.G, team, public)
	require.NoError(t, err)
	require.Equal(t, keybase1.PerTeamKeyGeneration(2), after.Generation(), "generation after rotate")

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

	u.tc = tc
	u.userInfo = userInfo
	u.username = userInfo.username
	u.passphrase = userInfo.passphrase
	u.uid = libkb.UsernameToUID(u.username)

	cli, xp, err := client.GetRPCClientWithContext(g)
	if err != nil {
		tt.t.Fatal(err)
	}

	u.deviceClient = keybase1.DeviceClient{Cli: cli}
	u.device.userClient = keybase1.UserClient{Cli: cli}

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

	devices, backups := u.device.loadEncryptionKIDs()
	require.Len(tt.t, devices, 1, "devices")
	u.device.deviceKey.KID = devices[0]
	require.True(tt.t, u.device.deviceKey.KID.Exists())
	require.Len(tt.t, backups, 1, "backup keys")
	u.backupKey = backups[0]
	u.backupKey.secret = signupUI.info.displayedPaperKey

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
	passphrase    string
	userInfo      *signupInfo
	backupKey     backupKey
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
	u.tc.T.Fatalf("timed out waiting for team rotate %s", teamID)
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

// TODO this should use ID instead
func (u *userPlusDevice) waitForRotate(team string, toSeqno keybase1.Seqno) {
	u.tc.T.Logf("waiting for team rotate %s", team)

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

func (u *userPlusDevice) waitForRotateByID(teamID keybase1.TeamID, toSeqno keybase1.Seqno) {
	u.tc.T.Logf("waiting for team rotate %s", teamID)

	// jump start the clkr queue processing loop
	u.kickTeamRekeyd()

	// process 10 team rotations or 10s worth of time
	for i := 0; i < 10; i++ {
		select {
		case arg := <-u.notifications.rotateCh:
			u.tc.T.Logf("rotate received: %+v", arg)
			if arg.TeamID.Eq(teamID) && arg.Changes.KeyRotated && arg.LatestSeqno == toSeqno {
				u.tc.T.Logf("rotate matched!")
				return
			}
			u.tc.T.Logf("ignoring rotate message")
		case <-time.After(1 * time.Second):
		}
	}
	u.tc.T.Fatalf("timed out waiting for team rotate %s", teamID)
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
	var res keybase1.LookupImplicitTeamRes
	if create {
		res, err = cli.LookupOrCreateImplicitTeam(context.TODO(), keybase1.LookupOrCreateImplicitTeamArg{Name: displayName, Public: public})
	} else {
		res, err = cli.LookupImplicitTeam(context.TODO(), keybase1.LookupImplicitTeamArg{Name: displayName, Public: public})
	}

	return res.TeamID, err
}

func (u *userPlusDevice) newSecretUI() *libkb.TestSecretUI {
	return &libkb.TestSecretUI{Passphrase: u.passphrase}
}

func (u *userPlusDevice) provisionNewDevice() *deviceWrapper {
	tc := setupTest(u.tc.T, "sub")
	t := tc.T
	g := tc.G

	device := &deviceWrapper{tctx: tc}
	device.start(0)

	// ui for provisioning
	ui := &rekeyProvisionUI{username: u.username, backupKey: u.backupKey}
	// var loginClient keybase1.LoginClient
	{
		_, xp, err := client.GetRPCClientWithContext(g)
		require.NoError(t, err)
		srv := rpc.NewServer(xp, nil)
		protocols := []rpc.Protocol{
			keybase1.LoginUiProtocol(ui),
			keybase1.SecretUiProtocol(ui),
			keybase1.ProvisionUiProtocol(ui),
		}
		for _, prot := range protocols {
			err = srv.Register(prot)
			require.NoError(t, err)
		}
		// loginClient = keybase1.LoginClient{Cli: cli}
		// _ = loginClient
	}

	// g.SetUI(ui)

	cmd := client.NewCmdLoginRunner(g)
	err := cmd.Run()
	require.NoError(t, err, "login")

	// Clear the paper key.
	err = g.LoginState().Account(func(a *libkb.Account) {
		a.ClearPaperKeys()
	}, "provisionNewDevice")
	require.NoError(t, err, "clear paper key")

	skey, err := g.ActiveDevice.SigningKey()
	require.NoError(t, err)
	device.deviceKey.KID = skey.GetKID()
	require.True(t, device.deviceKey.KID.Exists())

	return device
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

func GetTeamForTestByID(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID, public bool) (*teams.Team, error) {
	return teams.Load(ctx, g, keybase1.LoadTeamArg{
		ID:          id,
		Public:      public,
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

// Test that we can still load a valid link a signed by a now-revoked device.
func TestTeamSignedByRevokedDevice(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	// the signer
	alice := tt.addUser("alice")

	// the loader
	bob := tt.addUser("bob")

	teamName := alice.createTeam()
	alice.addTeamMember(teamName, bob.username, keybase1.TeamRole_ADMIN)

	t.Logf("alice revokes the device used to sign team links")
	var revokedKID keybase1.KID
	{
		devices, _ := getActiveDevicesAndKeys(alice.tc, alice.username)
		var target *libkb.Device
		for _, device := range devices {
			if device.Type != libkb.DeviceTypePaper {
				target = device
			}
		}
		require.NotNil(t, target)
		revokedKID = target.Kid

		revokeEngine := engine.NewRevokeDeviceEngine(engine.RevokeDeviceEngineArgs{
			ID:        target.ID,
			ForceSelf: true,
			ForceLast: false,
		}, alice.tc.G)
		ectx := &engine.Context{
			LogUI:    alice.tc.G.Log,
			SecretUI: alice.newSecretUI(),
		}
		err := engine.RunEngine(revokeEngine, ectx)
		require.NoError(t, err)
	}

	t.Logf("bob updates cache of alice's info")
	{
		arg := libkb.NewLoadUserArg(bob.tc.G).WithUID(alice.uid).WithPublicKeyOptional().WithForcePoll(true)
		_, _, err := bob.tc.G.GetUPAKLoader().LoadV2(arg)
		require.NoError(t, err)
	}

	t.Logf("bob should see alice's key is revoked")
	{
		_, pubKey, _, err := bob.tc.G.GetUPAKLoader().LoadKeyV2(context.TODO(), alice.uid, revokedKID)
		require.NoError(t, err)
		t.Logf("%v", spew.Sdump(pubKey))
		require.NotNil(t, pubKey.Base.Revocation, "key should be revoked: %v", revokedKID)
	}

	t.Logf("bob loads the team")
	_, err := teams.Load(context.TODO(), bob.tc.G, keybase1.LoadTeamArg{
		Name:            teamName,
		ForceRepoll:     true,
		ForceFullReload: true, // don't use the cache
	})
	require.NoError(t, err)
}

// Another test of loading a team with a valid link signed by a now-revoked device.
// The previous test didn't catch a bug.
// In this test at the time when the device is revoked the team sigchain points to
// a link that was signed by a never-revoked device and is subsequent to the link
// signed by the revoked device.
func TestTeamSignedByRevokedDevice2(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	// the signer
	alice := tt.addUser("alice")
	aliced2 := alice.provisionNewDevice()

	// the loader
	bob := tt.addUser("bob")

	teamName := alice.createTeam()

	t.Logf("sign a link with the to-be-revoked device (aliced2)")
	{
		eng := client.NewCmdTeamAddMemberRunner(aliced2.tctx.G)
		eng.Team = teamName
		eng.Username = bob.username
		eng.Role = keybase1.TeamRole_ADMIN
		err := eng.Run()
		require.NoError(t, err)
	}

	alice.changeTeamMember(teamName, bob.username, keybase1.TeamRole_ADMIN)

	t.Logf("alice revokes a device used to sign team links (alice2)")
	revokedKID := aliced2.KID()
	require.True(t, revokedKID.Exists())
	{
		devices, _ := getActiveDevicesAndKeys(alice.tc, alice.username)
		var target *libkb.Device
		for _, device := range devices {
			t.Logf("scan device: ID:%v KID:%v", device.ID, device.Kid)
			if device.Kid.Equal(revokedKID) {
				target = device
			}
		}
		require.NotNil(t, target)

		revokeEngine := engine.NewRevokeDeviceEngine(engine.RevokeDeviceEngineArgs{
			ID:        target.ID,
			ForceSelf: true,
			ForceLast: false,
		}, alice.tc.G)
		ectx := &engine.Context{
			LogUI:    alice.tc.G.Log,
			SecretUI: alice.newSecretUI(),
		}
		err := engine.RunEngine(revokeEngine, ectx)
		require.NoError(t, err)
	}

	t.Logf("bob updates cache of alice's info")
	{
		arg := libkb.NewLoadUserArg(bob.tc.G).WithUID(alice.uid).WithPublicKeyOptional().WithForcePoll(true)
		_, _, err := bob.tc.G.GetUPAKLoader().LoadV2(arg)
		require.NoError(t, err)
	}

	t.Logf("bob should see alice's key is revoked")
	{
		_, pubKey, _, err := bob.tc.G.GetUPAKLoader().LoadKeyV2(context.TODO(), alice.uid, revokedKID)
		require.NoError(t, err)
		t.Logf("%v", spew.Sdump(pubKey))
		require.NotNil(t, pubKey.Base.Revocation, "key should be revoked: %v", revokedKID)
	}

	t.Logf("bob loads the team")
	_, err := teams.Load(context.TODO(), bob.tc.G, keybase1.LoadTeamArg{
		Name:            teamName,
		ForceRepoll:     true,
		ForceFullReload: true, // don't use the cache
	})
	require.NoError(t, err)
}

func TestImpTeamLookupWithTrackingFailure(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	alice := tt.addUser("alice")
	g := tt.users[0].tc.G

	tt.addUser("wong")
	wong := tt.users[1]

	iTeamNameCreate := strings.Join([]string{alice.username, wong.username}, ",")

	t.Logf("make an implicit team")
	team, err := alice.lookupImplicitTeam(true /*create*/, iTeamNameCreate, false /*isPublic*/)
	require.NoError(t, err)

	iui := newSimpleIdentifyUI()
	attachIdentifyUI(t, g, iui)

	t.Logf("prove rooter and track")
	g.ProofCache.DisableDisk()
	wong.proveRooter()
	iui.confirmRes = keybase1.ConfirmResult{IdentityConfirmed: true, RemoteConfirmed: true, AutoConfirmed: true}
	tt.users[0].track(wong.username)
	iui.confirmRes = keybase1.ConfirmResult{}

	t.Logf("make rooter unreachable")
	g.XAPI = &flakeyRooterAPI{orig: g.XAPI, hardFail: true, G: g}
	g.ProofCache.Reset()

	t.Logf("lookup the implicit team while full identify is failing")
	team2, err := alice.lookupImplicitTeam(true /*create*/, iTeamNameCreate, false /*isPublic*/)
	require.NoError(t, err)
	require.Equal(t, team, team2)
}
