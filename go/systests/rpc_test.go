// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

// Test various RPCs that are used mainly in other clients but not by the CLI.

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/service"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
)

func TestRPCs(t *testing.T) {
	tc := setupTest(t, "rpcs")
	tc2 := cloneContext(tc)

	defer tc.Cleanup()

	stopCh := make(chan error)
	svc := service.NewService(tc.G, false)
	startCh := svc.GetStartChannel()
	go func() {
		err := svc.Run()
		if err != nil {
			t.Logf("Running the service produced an error: %v", err)
		}
		stopCh <- err
	}()

	<-startCh

	// Add test RPC methods here.
	stage := func(label string) {
		t.Logf("> Stage: %v", label)
	}
	stage("testIdentifyResolve3")
	testIdentifyResolve3(t, tc2.G)
	stage("testCheckInvitationCode")
	testCheckInvitationCode(t, tc2.G)
	stage("testLoadAllPublicKeysUnverified")
	testLoadAllPublicKeysUnverified(t, tc2.G)
	stage("testLoadUserWithNoKeys")
	testLoadUserWithNoKeys(t, tc2.G)
	stage("test LoadUserPlusKeysV2")
	testLoadUserPlusKeysV2(t, tc2.G)
	stage("testCheckDevicesForUser")
	testCheckDevicesForUser(t, tc2.G)
	stage("testIdentify2")
	testIdentify2(t, tc2.G)
	stage("testMerkle")
	testMerkle(t, tc2.G)
	stage("testConfig")
	testConfig(t, tc2.G)

	if err := client.CtlServiceStop(tc2.G); err != nil {
		t.Fatal(err)
	}

	// If the server failed, it's also an error
	if err := <-stopCh; err != nil {
		t.Fatal(err)
	}
}

func testIdentifyResolve3(t *testing.T, g *libkb.GlobalContext) {

	cli, err := client.GetIdentifyClient(g)
	if err != nil {
		t.Fatalf("failed to get new identifyclient: %v", err)
	}

	// We don't want to hit the cache, since the previous lookup never hit the
	// server.  For Resolve3, we have to, since we need a username.  So test that
	// here.
	if res, err := cli.Resolve3(context.TODO(), "uid:eb72f49f2dde6429e5d78003dae0c919"); err != nil {
		t.Fatalf("Resolve failed: %v\n", err)
	} else if res.Name != "t_tracy" {
		t.Fatalf("Wrong username: %s != 't_tracy", res.Name)
	}

	if res, err := cli.Resolve3(context.TODO(), "t_tracy@rooter"); err != nil {
		t.Fatalf("Resolve3 failed: %v\n", err)
	} else if res.Name != "t_tracy" {
		t.Fatalf("Wrong name: %s != 't_tracy", res.Name)
	} else if !res.Id.AsUserOrBust().Equal(keybase1.UID("eb72f49f2dde6429e5d78003dae0c919")) {
		t.Fatalf("Wrong uid for tracy: %s\n", res.Id)
	}

	if _, err := cli.Resolve3(context.TODO(), "foobag@rooter"); err == nil {
		t.Fatalf("expected an error on a bad resolve, but got none")
	} else if _, ok := err.(libkb.ResolutionError); !ok {
		t.Fatalf("Wrong error: wanted type %T but got (%v, %T)", libkb.ResolutionError{}, err, err)
	}

	if res, err := cli.Resolve3(context.TODO(), "t_tracy"); err != nil {
		t.Fatalf("Resolve3 failed: %v\n", err)
	} else if res.Name != "t_tracy" {
		t.Fatalf("Wrong name: %s != 't_tracy", res.Name)
	} else if !res.Id.AsUserOrBust().Equal(keybase1.UID("eb72f49f2dde6429e5d78003dae0c919")) {
		t.Fatalf("Wrong uid for tracy: %s\n", res.Id)
	}
}

func testCheckInvitationCode(t *testing.T, g *libkb.GlobalContext) {
	cli, err := client.GetSignupClient(g)
	if err != nil {
		t.Fatalf("failed to get a signup client: %v", err)
	}

	err = cli.CheckInvitationCode(context.TODO(), keybase1.CheckInvitationCodeArg{InvitationCode: libkb.TestInvitationCode})
	if err != nil {
		t.Fatalf("Did not expect an error code, but got: %v", err)
	}
	err = cli.CheckInvitationCode(context.TODO(), keybase1.CheckInvitationCodeArg{InvitationCode: "eeoeoeoe333o3"})
	if _, ok := err.(libkb.BadInvitationCodeError); !ok {
		t.Fatalf("Expected an error code, but got %T %v", err, err)
	}
}

func testLoadAllPublicKeysUnverified(t *testing.T, g *libkb.GlobalContext) {

	cli, err := client.GetUserClient(g)
	if err != nil {
		t.Fatalf("failed to get user client: %s", err)
	}

	// t_rosetta
	arg := keybase1.LoadAllPublicKeysUnverifiedArg{Uid: keybase1.UID("b8939251cb3d367e68587acb33a64d19")}
	res, err := cli.LoadAllPublicKeysUnverified(context.TODO(), arg)
	if err != nil {
		t.Fatalf("failed to make load keys call: %s", err)
	}

	if len(res) != 3 {
		t.Fatalf("wrong amount of keys loaded: %d != %d", len(res), 3)
	}

	keys := map[keybase1.KID]bool{
		keybase1.KID("0101fe1183765f256289427d6943cd8bab3b5fe095bcdd27f031ed298da523efd3120a"): true,
		keybase1.KID("0101b5839c4ccaa9d03b3016b9aa73a7e3eafb067f9c86c07a6f2f79cb8558b1c97f0a"): true,
		keybase1.KID("0101188ee7e63ccbd05af498772ab2975ee29df773240d17dde09aecf6c132a5a9a60a"): true,
	}

	for _, key := range res {
		if _, ok := keys[key.KID]; !ok {
			t.Fatalf("unknown key in response: %s", key.KID)
		}
	}
}

func testLoadUserPlusKeysV2(t *testing.T, g *libkb.GlobalContext) {
	cli, err := client.GetUserClient(g)
	if err != nil {
		t.Fatalf("failed to get a user client: %v", err)
	}

	kid := keybase1.KID("012012a40a6b77a9de5e48922262870565900f5689e179761ea8c8debaa586bfd0090a")
	uid := keybase1.UID("359c7644857203be38bfd3bf79bf1819")

	frank, err := cli.LoadUserPlusKeysV2(context.TODO(), keybase1.LoadUserPlusKeysV2Arg{Uid: uid, PollForKID: kid})
	require.NoError(t, err)
	require.NotNil(t, frank)
	require.Equal(t, len(frank.PastIncarnations), 0)
	require.Equal(t, frank.Current.Username, "t_frank")
	_, found := frank.Current.DeviceKeys[kid]
	require.True(t, found)
	require.Nil(t, frank.Current.Reset)
}

func testLoadUserWithNoKeys(t *testing.T, g *libkb.GlobalContext) {
	// The LoadUser class in libkb returns an error by default if the user in
	// question has no keys. The RPC methods that wrap it should suppress this
	// error, by setting the PublicKeyOptional flag.

	cli, err := client.GetUserClient(g)
	if err != nil {
		t.Fatalf("failed to get a user client: %v", err)
	}

	// Check the LoadUserByName RPC. t_ellen is a test user with no keys.
	loadUserByNameArg := keybase1.LoadUserByNameArg{Username: "t_ellen"}
	tEllen, err := cli.LoadUserByName(context.TODO(), loadUserByNameArg)
	if err != nil {
		t.Fatal(err)
	}
	if tEllen.Username != "t_ellen" {
		t.Fatalf("expected t_ellen, saw %s", tEllen.Username)
	}

	// Check the LoadUser RPC.
	loadUserArg := keybase1.LoadUserArg{Uid: tEllen.Uid}
	tEllen2, err := cli.LoadUser(context.TODO(), loadUserArg)
	if err != nil {
		t.Fatal(err)
	}
	if tEllen2.Username != "t_ellen" {
		t.Fatalf("expected t_ellen, saw %s", tEllen2.Username)
	}
}

func testCheckDevicesForUser(t *testing.T, g *libkb.GlobalContext) {
	cli, err := client.GetDeviceClient(g)
	if err != nil {
		t.Fatalf("failed to get a device client: %v", err)
	}
	err = cli.CheckDeviceNameForUser(context.TODO(), keybase1.CheckDeviceNameForUserArg{
		Username:   "t_frank",
		Devicename: "bad $ device $ name",
	})
	if _, ok := err.(libkb.DeviceBadNameError); !ok {
		t.Fatalf("wanted a bad device name error; got %v", err)
	}
	err = cli.CheckDeviceNameForUser(context.TODO(), keybase1.CheckDeviceNameForUserArg{
		Username:   "t_frank",
		Devicename: "go c lient",
	})
	if _, ok := err.(libkb.DeviceNameInUseError); !ok {
		t.Fatalf("wanted a name in use error; got %v", err)
	}
}

func testIdentify2(t *testing.T, g *libkb.GlobalContext) {

	cli, err := client.GetIdentifyClient(g)
	if err != nil {
		t.Fatalf("failed to get new identifyclient: %v", err)
	}

	_, err = cli.Identify2(context.TODO(), keybase1.Identify2Arg{
		UserAssertion:    "t_alice",
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_GUI,
	})
	if err != nil {
		t.Fatalf("Identify2 failed: %v\n", err)
	}

	_, err = cli.Identify2(context.TODO(), keybase1.Identify2Arg{
		UserAssertion:    "t_weriojweroi",
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_GUI,
	})
	if _, ok := err.(libkb.NotFoundError); !ok {
		t.Fatalf("Expected a not-found error, but got: %v (%T)", err, err)
	}
}

func testMerkle(t *testing.T, g *libkb.GlobalContext) {

	cli, err := client.GetMerkleClient(g)
	if err != nil {
		t.Fatalf("failed to get new merkle client: %v", err)
	}

	root, err := cli.GetCurrentMerkleRoot(context.TODO(), int(-1))
	if err != nil {
		t.Fatalf("GetCurrentMerkleRoot failed: %v\n", err)
	}
	if root.Root.Seqno <= keybase1.Seqno(0) {
		t.Fatalf("Failed basic sanity check")
	}
}

func testConfig(t *testing.T, g *libkb.GlobalContext) {

	cli, err := client.GetConfigClient(g)
	if err != nil {
		t.Fatalf("failed to get new config client: %v", err)
	}
	config, err := cli.GetConfig(context.TODO(), 0)
	if err != nil {
		t.Fatal(err)
	}
	if config.ServerURI == "" {
		t.Fatal("No service URI")
	}
}

func idLiteArg(id keybase1.UserOrTeamID, assertion string) keybase1.IdentifyLiteArg {
	return keybase1.IdentifyLiteArg{
		Id:               id,
		Assertion:        assertion,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	}
}

func TestIdentifyLite(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUser("abc")
	teamName := tt.users[0].createTeam()
	g := tt.users[0].tc.G

	t.Logf("make a team")
	team, err := GetTeamForTestByStringName(context.Background(), g, teamName)
	require.NoError(t, err)

	getTeamName := func(teamID keybase1.TeamID) keybase1.TeamName {
		team, err := teams.Load(context.Background(), g, keybase1.LoadTeamArg{
			ID: teamID,
		})
		require.NoError(t, err)
		return team.Name()
	}

	t.Logf("make an implicit team")
	iTeamCreateName := strings.Join([]string{tt.users[0].username, "bob@github"}, ",")
	iTeam, _, _, err := teams.LookupOrCreateImplicitTeam(context.TODO(), g, iTeamCreateName, false /*isPublic*/)
	require.NoError(t, err)
	iTeamImpName := getTeamName(iTeam.ID)
	require.True(t, iTeamImpName.IsImplicit())
	require.NoError(t, err)

	cli, err := client.GetIdentifyClient(g)
	require.NoError(t, err, "failed to get new identifyclient")

	// test ok assertions
	var units = []struct {
		assertion string
		resID     keybase1.TeamID
		resName   string
	}{
		{
			assertion: "t_alice",
			resName:   "t_alice",
		}, {
			assertion: "team:" + teamName,
			resID:     team.ID,
			resName:   teamName,
		}, {
			assertion: "tid:" + team.ID.String(),
			resID:     team.ID,
			resName:   teamName,
		},
	}
	for _, unit := range units {
		res, err := cli.IdentifyLite(context.Background(), idLiteArg("", unit.assertion))
		require.NoError(t, err, "IdentifyLite (%s) failed", unit.assertion)

		if len(unit.resID) > 0 {
			require.Equal(t, unit.resID.String(), res.Ul.Id.String())
		}

		if len(unit.resName) > 0 {
			require.Equal(t, unit.resName, res.Ul.Name)
		}
	}

	// test identify by assertion and id
	assertions := []string{"team:" + teamName, "tid:" + team.ID.String()}
	for _, assertion := range assertions {
		_, err := cli.IdentifyLite(context.Background(), idLiteArg(team.ID.AsUserOrTeam(), assertion))
		require.NoError(t, err, "IdentifyLite by assertion and id (%s)", assertion)
	}

	// test identify by id only
	_, err = cli.IdentifyLite(context.Background(), idLiteArg(team.ID.AsUserOrTeam(), ""))
	require.NoError(t, err, "IdentifyLite id only")

	// test invalid user format
	_, err = cli.IdentifyLite(context.Background(), idLiteArg("", "__t_alice"))
	require.Error(t, err)
	require.Contains(t, err.Error(), "bad keybase username")

	// test team read error
	assertions = []string{"team:jwkj22111z"}
	for _, assertion := range assertions {
		_, err := cli.IdentifyLite(context.Background(), idLiteArg("", assertion))
		aerr, ok := err.(libkb.AppStatusError)
		if ok {
			if aerr.Code != libkb.SCTeamNotFound {
				t.Fatalf("app status code: %d, expected %d", aerr.Code, libkb.SCTeamNotFound)
			}
		} else {
			require.True(t, regexp.MustCompile("Team .* does not exist").MatchString(err.Error()),
				"Expected an AppStatusError or team-does-not-exist for %s, but got: %v (%T)", assertion, err, err)
		}
	}

	// test not found assertions
	assertions = []string{"t_weriojweroi"}
	for _, assertion := range assertions {
		_, err := cli.IdentifyLite(context.Background(), idLiteArg("", assertion))
		if _, ok := err.(libkb.NotFoundError); !ok {
			t.Fatalf("assertion %s, error: %s (%T), expected libkb.NotFoundError", assertion, err, err)
		}
	}
}

// test ResolveIdentifyImplicitTeam with a social assertion
func TestResolveIdentifyImplicitTeamWithSocial(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUser("abc")
	g := tt.users[0].tc.G

	tt.addUser("wong")
	wong := tt.users[1]
	wong.proveRooter()

	getTeamName := func(teamID keybase1.TeamID) keybase1.TeamName {
		team, err := teams.Load(context.Background(), g, keybase1.LoadTeamArg{
			ID: teamID,
		})
		require.NoError(t, err)
		return team.Name()
	}

	iTeamNameCreate := strings.Join([]string{"bob@github", tt.users[0].username, wong.username}, ",")
	// lookup with an assertion
	iTeamNameLookup := strings.Join([]string{"bob@github", tt.users[0].username, wong.username + "@rooter"}, ",")
	// the returned name should be sorted with the logged-in user first
	iTeamNameSorted := strings.Join([]string{tt.users[0].username, "bob@github", wong.username}, ",")

	t.Logf("make an implicit team")
	iTeam, _, _, err := teams.LookupOrCreateImplicitTeam(context.TODO(), g, iTeamNameCreate, false /*isPublic*/)
	require.NoError(t, err)
	iTeamImpName := getTeamName(iTeam.ID)
	require.True(t, iTeamImpName.IsImplicit())

	cli, err := client.GetIdentifyClient(g)
	require.NoError(t, err, "failed to get new identifyclient")

	res, err := cli.ResolveIdentifyImplicitTeam(context.Background(), keybase1.ResolveIdentifyImplicitTeamArg{
		Assertions:       iTeamNameLookup,
		Suffix:           "",
		IsPublic:         false,
		DoIdentifies:     false,
		Create:           true,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_DEFAULT_KBFS,
	})
	require.NoError(t, err)
	require.Equal(t, res.DisplayName, iTeamNameSorted)
	require.Equal(t, res.TeamID, iTeam.ID)
	require.True(t, compareUserVersionSets([]keybase1.UserVersion{tt.users[0].userVersion(), wong.userVersion()}, res.Writers))
	require.Nil(t, res.TrackBreaks, "track breaks")
}

// test ResolveIdentifyImplicitTeam with readers (also with DoIdentifies)
func TestResolveIdentifyImplicitTeamWithReaders(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUser("abc")
	g := tt.users[0].tc.G

	tt.addUser("wong")
	wong := tt.users[1]
	wong.proveRooter()

	iTeamNameCreate := tt.users[0].username + "#" + strings.Join([]string{"bob@github", wong.username}, ",")
	// lookup with an assertion
	iTeamNameLookup := tt.users[0].username + "#" + strings.Join([]string{"bob@github", wong.username + "@rooter"}, ",")

	t.Logf("make an implicit team")
	iTeam, _, _, err := teams.LookupOrCreateImplicitTeam(context.TODO(), g, iTeamNameCreate, false /*isPublic*/)
	require.NoError(t, err)

	cli, err := client.GetIdentifyClient(g)
	require.NoError(t, err, "failed to get new identifyclient")
	attachIdentifyUI(t, g, newSimpleIdentifyUI())

	res, err := cli.ResolveIdentifyImplicitTeam(context.Background(), keybase1.ResolveIdentifyImplicitTeamArg{
		Assertions:       iTeamNameLookup,
		Suffix:           "",
		IsPublic:         false,
		DoIdentifies:     true,
		Create:           false,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_DEFAULT_KBFS,
	})
	require.NoError(t, err, "%v %v", err, spew.Sdump(res))
	require.Equal(t, res.DisplayName, iTeamNameCreate)
	require.Equal(t, res.TeamID, iTeam.ID)
	require.Equal(t, []keybase1.UserVersion{tt.users[0].userVersion()}, res.Writers)
	require.Nil(t, res.TrackBreaks, "track breaks")

	t.Logf("Try getting the public team and fail (has nothing to do with readers)")
	res, err = cli.ResolveIdentifyImplicitTeam(context.Background(), keybase1.ResolveIdentifyImplicitTeamArg{
		Assertions:       iTeamNameCreate,
		Suffix:           "",
		IsPublic:         true,
		DoIdentifies:     false,
		Create:           false,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_DEFAULT_KBFS,
	})
	require.Error(t, err)
	require.Regexp(t, `^Team.*does not exist$`, err.Error())
}

// test ResolveIdentifyImplicitTeam with duplicates
func TestResolveIdentifyImplicitTeamWithDuplicates(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	alice := tt.addUser("abc")
	g := alice.tc.G

	bob := tt.addUser("bob")

	iTeamNameCreate := strings.Join([]string{alice.username, bob.username}, ",")
	// simple duplicate
	iTeamNameLookup1 := strings.Join([]string{alice.username, bob.username, bob.username}, ",")
	// duplicate after resolution
	iTeamNameLookup2 := strings.Join([]string{alice.username, bob.username, bob.username + "@rooter"}, ",")
	// duplicate across reader boundary
	iTeamNameLookup3 := strings.Join([]string{alice.username, bob.username + "@rooter"}, ",") + "#" + bob.username

	t.Logf("make an implicit team")
	iTeam, _, _, err := teams.LookupOrCreateImplicitTeam(context.TODO(), g, iTeamNameCreate, false /*isPublic*/)
	require.NoError(t, err)

	bob.proveRooter()

	cli, err := client.GetIdentifyClient(g)
	require.NoError(t, err, "failed to get new identifyclient")

	for i, lookup := range []string{iTeamNameLookup1, iTeamNameLookup2, iTeamNameLookup3} {
		t.Logf("checking %v: %v", i, lookup)
		res, err := cli.ResolveIdentifyImplicitTeam(context.Background(), keybase1.ResolveIdentifyImplicitTeamArg{
			Assertions:       lookup,
			Suffix:           "",
			IsPublic:         false,
			DoIdentifies:     false,
			Create:           false,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_DEFAULT_KBFS,
		})
		require.NoError(t, err, "%v %v", err, spew.Sdump(res))
		require.Equal(t, res.TeamID, iTeam.ID)
		require.Equal(t, res.DisplayName, iTeamNameCreate)
		require.True(t, compareUserVersionSets([]keybase1.UserVersion{alice.userVersion(), bob.userVersion()}, res.Writers))
		require.Nil(t, res.TrackBreaks, "track breaks")
	}
}

func testResolveImplicitTeam(t *testing.T, g *libkb.GlobalContext, id keybase1.TeamID, isPublic bool, gen keybase1.Seqno) {
	cli, err := client.GetIdentifyClient(g)
	require.NoError(t, err, "failed to get new Identify client")
	arg := keybase1.ResolveImplicitTeamArg{Id: id}
	res, err := cli.ResolveImplicitTeam(context.Background(), arg)
	require.NoError(t, err, "resolve Implicit team worked")
	if gen == keybase1.Seqno(0) {
		require.False(t, strings.Contains(res.Name, "conflicted"), "no conflicts")
	} else {
		require.True(t, strings.Contains(res.Name, "conflicted"), "found conflicted")
		require.True(t, strings.Contains(res.Name, fmt.Sprintf("#%d", int(gen))), "found conflict gen #")
	}
}

// doubleTestResolveImplicitTeam calls testResolveImplicitTeam twice, to make sure it
// it works when we hit the cache (which we will do the second time through).
func doubleTestResolveImplicitTeam(t *testing.T, g *libkb.GlobalContext, id keybase1.TeamID, isPublic bool, gen keybase1.Seqno) {
	testResolveImplicitTeam(t, g, id, isPublic, gen)
	testResolveImplicitTeam(t, g, id, isPublic, gen)
}

func TestResolveIdentifyImplicitTeamWithConflict(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUser("abc")
	g := tt.users[0].tc.G

	tt.addUser("wong")
	wong := tt.users[1]

	iTeamNameCreate1 := strings.Join([]string{tt.users[0].username, wong.username}, ",")
	iTeamNameCreate2 := strings.Join([]string{tt.users[0].username, wong.username + "@rooter"}, ",")

	t.Logf("make the teams")
	iTeam1, _, _, err := teams.LookupOrCreateImplicitTeam(context.TODO(), g, iTeamNameCreate1, false /*isPublic*/)
	require.NoError(t, err)
	iTeam2, _, _, err := teams.LookupOrCreateImplicitTeam(context.TODO(), g, iTeamNameCreate2, false /*isPublic*/)
	require.NoError(t, err)
	require.NotEqual(t, iTeam1.ID, iTeam2.ID)
	t.Logf("t1: %v", iTeam1.ID)
	t.Logf("t2: %v", iTeam2.ID)

	doubleTestResolveImplicitTeam(t, g, iTeam1.ID, false, keybase1.Seqno(0))
	doubleTestResolveImplicitTeam(t, g, iTeam2.ID, false, keybase1.Seqno(0))

	getTeamSeqno := func(teamID keybase1.TeamID) keybase1.Seqno {
		team, err := teams.Load(context.Background(), g, keybase1.LoadTeamArg{
			ID: teamID,
		})
		require.NoError(t, err)
		return team.CurrentSeqno()
	}

	expectedSeqno := getTeamSeqno(iTeam2.ID) + 1

	t.Logf("prove to create the conflict")
	wong.proveRooter()

	tt.users[0].waitForTeamChangedGregor(iTeam2.ID, expectedSeqno)

	cli, err := client.GetIdentifyClient(g)
	require.NoError(t, err, "failed to get new identifyclient")
	iui := newSimpleIdentifyUI()
	attachIdentifyUI(t, g, iui)

	t.Logf("get the conflict winner team")
	res, err := cli.ResolveIdentifyImplicitTeam(context.Background(), keybase1.ResolveIdentifyImplicitTeamArg{
		Assertions:       iTeamNameCreate1,
		Suffix:           "",
		IsPublic:         false,
		DoIdentifies:     true,
		Create:           false,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_DEFAULT_KBFS,
	})
	require.NoError(t, err, "%v %v", err, spew.Sdump(res))
	require.Equal(t, res.DisplayName, iTeamNameCreate1)
	require.Equal(t, res.TeamID, iTeam1.ID)
	require.True(t, compareUserVersionSets([]keybase1.UserVersion{tt.users[0].userVersion(), wong.userVersion()}, res.Writers))
	require.Nil(t, res.TrackBreaks, "track breaks")

	t.Logf("get the conflict winner using the assertion name")
	res, err = cli.ResolveIdentifyImplicitTeam(context.Background(), keybase1.ResolveIdentifyImplicitTeamArg{
		Assertions:       iTeamNameCreate2,
		Suffix:           "",
		IsPublic:         false,
		DoIdentifies:     true,
		Create:           false,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_DEFAULT_KBFS,
	})
	require.NoError(t, err, "%v %v", err, spew.Sdump(res))
	require.Equal(t, res.DisplayName, iTeamNameCreate1)
	require.Equal(t, res.TeamID, iTeam1.ID)
	require.True(t, compareUserVersionSets([]keybase1.UserVersion{tt.users[0].userVersion(), wong.userVersion()}, res.Writers))
	require.Nil(t, res.TrackBreaks, "track breaks")

	t.Logf("find out the conflict suffix")
	iTeamxx, _, _, conflicts, err := teams.LookupImplicitTeamAndConflicts(context.TODO(), g, iTeamNameCreate1, false /*isPublic*/)
	require.NoError(t, err)
	require.Equal(t, iTeamxx.ID, iTeam1.ID)
	require.Len(t, conflicts, 1)

	t.Logf("get the conflict loser")
	res, err = cli.ResolveIdentifyImplicitTeam(context.Background(), keybase1.ResolveIdentifyImplicitTeamArg{
		Assertions:       iTeamNameCreate1,
		Suffix:           libkb.FormatImplicitTeamDisplayNameSuffix(conflicts[0]),
		IsPublic:         false,
		DoIdentifies:     true,
		Create:           false,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_DEFAULT_KBFS,
	})
	require.NoError(t, err, "%v %v", err, spew.Sdump(res))
	require.Equal(t, res.DisplayName, iTeamNameCreate1+" "+libkb.FormatImplicitTeamDisplayNameSuffix(conflicts[0]))
	require.Equal(t, res.TeamID, iTeam2.ID)
	require.True(t, compareUserVersionSets([]keybase1.UserVersion{tt.users[0].userVersion(), wong.userVersion()}, res.Writers))
	require.Nil(t, res.TrackBreaks, "track breaks")

	testResolveImplicitTeam(t, g, iTeam1.ID, false, keybase1.Seqno(0))
	testResolveImplicitTeam(t, g, iTeam2.ID, false, keybase1.Seqno(1))

}

func TestResolveIdentifyImplicitTeamWithIdentifyFailures(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUser("abc")
	g := tt.users[0].tc.G

	tt.addUser("wong")
	wong := tt.users[1]

	iTeamNameCreate := strings.Join([]string{tt.users[0].username, wong.username}, ",")

	t.Logf("make an implicit team")
	iTeam, _, _, err := teams.LookupOrCreateImplicitTeam(context.TODO(), g, iTeamNameCreate, false /*isPublic*/)
	require.NoError(t, err)

	cli, err := client.GetIdentifyClient(g)
	require.NoError(t, err, "failed to get new identifyclient")
	iui := newSimpleIdentifyUI()
	attachIdentifyUI(t, g, iui)

	t.Logf("try but fail on assertion")
	res, err := cli.ResolveIdentifyImplicitTeam(context.Background(), keybase1.ResolveIdentifyImplicitTeamArg{
		// lookup with a compound assertion, the first part will resolve, the second part will fail
		Assertions:       strings.Join([]string{tt.users[0].username, wong.username + "&&" + wong.username + "@rooter"}, ","),
		Suffix:           "",
		IsPublic:         false,
		DoIdentifies:     true,
		Create:           false,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_DEFAULT_KBFS,
	})
	require.Error(t, err)
	require.IsType(t, libkb.IdentifiesFailedError{}, err, "%v", err)
	require.Equal(t, res.DisplayName, iTeamNameCreate)
	require.Equal(t, res.TeamID, iTeam.ID)
	require.True(t, compareUserVersionSets([]keybase1.UserVersion{tt.users[0].userVersion(), wong.userVersion()}, res.Writers))
	require.Nil(t, res.TrackBreaks, "expect no track breaks")

	t.Logf("prove rooter and track")
	g.ProofCache.DisableDisk()
	wong.proveRooter()
	iui.confirmRes = keybase1.ConfirmResult{IdentityConfirmed: true, RemoteConfirmed: true, AutoConfirmed: true}
	tt.users[0].track(wong.username)
	iui.confirmRes = keybase1.ConfirmResult{}

	t.Logf("make rooter unreachable")
	g.XAPI = &flakeyRooterAPI{orig: g.XAPI, hardFail: true, G: g}
	g.ProofCache.Reset()

	t.Logf("try but fail on tracking (1)")
	res, err = cli.ResolveIdentifyImplicitTeam(context.Background(), keybase1.ResolveIdentifyImplicitTeamArg{
		// lookup by username, but the dead rooter proof fails our tracking
		Assertions:       strings.Join([]string{tt.users[0].username, wong.username}, ","),
		Suffix:           "",
		IsPublic:         false,
		DoIdentifies:     true,
		Create:           false,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_DEFAULT_KBFS,
	})
	require.Error(t, err)
	require.IsType(t, libkb.IdentifiesFailedError{}, err, "%v", err)
	require.Equal(t, res.DisplayName, iTeamNameCreate)
	require.Equal(t, res.TeamID, iTeam.ID)
	require.True(t, compareUserVersionSets([]keybase1.UserVersion{tt.users[0].userVersion(), wong.userVersion()}, res.Writers))
	require.Nil(t, res.TrackBreaks) // counter-intuitively, there are no track breaks when the error is fatal in this mode.

	t.Logf("try but fail on tracking (2)")
	res, err = cli.ResolveIdentifyImplicitTeam(context.Background(), keybase1.ResolveIdentifyImplicitTeamArg{
		// lookup by username, but the dead rooter proof fails our tracking
		Assertions:       strings.Join([]string{tt.users[0].username, wong.username}, ","),
		Suffix:           "",
		IsPublic:         false,
		DoIdentifies:     true,
		Create:           false,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI, // Pass a weird IdentifyBehavior to get TrackBreaks to come out.
	})
	require.Error(t, err)
	require.IsType(t, libkb.IdentifiesFailedError{}, err, "%v", err)
	require.Equal(t, res.DisplayName, iTeamNameCreate)
	require.Equal(t, res.TeamID, iTeam.ID)
	require.True(t, compareUserVersionSets([]keybase1.UserVersion{tt.users[0].userVersion(), wong.userVersion()}, res.Writers))
	// In this mode, in addition to the error TrackBreaks is filled.
	require.NotNil(t, res.TrackBreaks)
	require.NotNil(t, res.TrackBreaks[wong.userVersion()])
	require.Len(t, res.TrackBreaks[wong.userVersion()].Proofs, 1)
	require.Equal(t, keybase1.ProofType_ROOTER, res.TrackBreaks[wong.userVersion()].Proofs[0].RemoteProof.ProofType)
}

func TestResolveIdentifyImplicitTeamWithIdentifyBadInput(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUser("abc")
	g := tt.users[0].tc.G

	cli, err := client.GetIdentifyClient(g)
	require.NoError(t, err, "failed to get new identifyclient")
	attachIdentifyUI(t, g, newSimpleIdentifyUI())

	_, err = cli.ResolveIdentifyImplicitTeam(context.Background(), keybase1.ResolveIdentifyImplicitTeamArg{
		Assertions:       "", // blank assertions
		Suffix:           "",
		IsPublic:         false,
		DoIdentifies:     true,
		Create:           true,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_DEFAULT_KBFS,
	})
	require.Error(t, err)
	t.Logf("err: %v", err)

	_, err = cli.ResolveIdentifyImplicitTeam(context.Background(), keybase1.ResolveIdentifyImplicitTeamArg{
		Assertions:       tt.users[0].username,
		Suffix:           "bad suffix",
		IsPublic:         false,
		DoIdentifies:     true,
		Create:           true,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_DEFAULT_KBFS,
	})
	require.Error(t, err)
	t.Logf("err: %v", err)

	_, err = cli.ResolveIdentifyImplicitTeam(context.Background(), keybase1.ResolveIdentifyImplicitTeamArg{
		Assertions:       "malformed #)*$&#) assertion",
		Suffix:           "",
		IsPublic:         true,
		DoIdentifies:     true,
		Create:           false,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_DEFAULT_KBFS,
	})
	require.Error(t, err)
	t.Logf("err: %v", err)
}

// golang
func compareUserVersionSets(xs1 []keybase1.UserVersion, xs2 []keybase1.UserVersion) bool {
	if len(xs1) != len(xs2) {
		return false
	}
	var ys1 []keybase1.UserVersion
	for _, x := range xs1 {
		ys1 = append(ys1, x)
	}
	var ys2 []keybase1.UserVersion
	for _, x := range xs2 {
		ys2 = append(ys2, x)
	}
	cmp := func(a, b keybase1.UserVersion) bool {
		if a.Uid.Equal(b.Uid) {
			return a.EldestSeqno < b.EldestSeqno
		}
		return a.Uid < b.Uid
	}
	sort.Slice(ys1, func(i, j int) bool { return cmp(ys1[i], ys1[j]) })
	sort.Slice(ys2, func(i, j int) bool { return cmp(ys2[i], ys2[j]) })
	for i, y1 := range ys1 {
		if !y1.Eq(ys2[i]) {
			return false
		}
	}
	return true
}

func attachIdentifyUI(t *testing.T, g *libkb.GlobalContext, iui keybase1.IdentifyUiInterface) {
	cli, xp, err := client.GetRPCClientWithContext(g)
	require.NoError(t, err)
	srv := rpc.NewServer(xp, nil)
	err = srv.Register(keybase1.IdentifyUiProtocol(iui))
	require.NoError(t, err)
	ncli := keybase1.DelegateUiCtlClient{Cli: cli}
	err = ncli.RegisterIdentifyUI(context.TODO())
	require.NoError(t, err)
}

func simpleIdentifyUIError(s string) error {
	return fmt.Errorf("simpleIdentifyUI does not support %v", s)
}

type simpleIdentifyUI struct {
	delegated  bool
	confirmRes keybase1.ConfirmResult
}

func newSimpleIdentifyUI() *simpleIdentifyUI {
	return &simpleIdentifyUI{}
}

var _ keybase1.IdentifyUiInterface = (*simpleIdentifyUI)(nil)

func (p *simpleIdentifyUI) DelegateIdentifyUI(context.Context) (int, error) {
	p.delegated = true
	return 1, nil
}
func (p *simpleIdentifyUI) Start(context.Context, keybase1.StartArg) error {
	return nil
}
func (p *simpleIdentifyUI) DisplayKey(context.Context, keybase1.DisplayKeyArg) error {
	return simpleIdentifyUIError("DisplayKey")
}
func (p *simpleIdentifyUI) ReportLastTrack(context.Context, keybase1.ReportLastTrackArg) error {
	return nil
}
func (p *simpleIdentifyUI) LaunchNetworkChecks(_ context.Context, arg keybase1.LaunchNetworkChecksArg) error {
	return nil
}
func (p *simpleIdentifyUI) DisplayTrackStatement(context.Context, keybase1.DisplayTrackStatementArg) error {
	return simpleIdentifyUIError("DisplayTrackStatement")
}
func (p *simpleIdentifyUI) ReportTrackToken(context.Context, keybase1.ReportTrackTokenArg) error {
	return nil
}
func (p *simpleIdentifyUI) FinishWebProofCheck(context.Context, keybase1.FinishWebProofCheckArg) error {
	return simpleIdentifyUIError("FinishWebProofCheck")
}
func (p *simpleIdentifyUI) FinishSocialProofCheck(_ context.Context, arg keybase1.FinishSocialProofCheckArg) error {
	return nil
}
func (p *simpleIdentifyUI) DisplayCryptocurrency(context.Context, keybase1.DisplayCryptocurrencyArg) error {
	return simpleIdentifyUIError("DisplayCryptocurrency")
}
func (p *simpleIdentifyUI) DisplayUserCard(context.Context, keybase1.DisplayUserCardArg) error {
	return nil
}
func (p *simpleIdentifyUI) Confirm(context.Context, keybase1.ConfirmArg) (res keybase1.ConfirmResult, err error) {
	return p.confirmRes, nil
}
func (p *simpleIdentifyUI) Cancel(context.Context, int) error {
	return nil
}
func (p *simpleIdentifyUI) Finish(context.Context, int) error {
	return nil
}
func (p *simpleIdentifyUI) Dismiss(context.Context, keybase1.DismissArg) error {
	return simpleIdentifyUIError("Dismiss")
}
func (p *simpleIdentifyUI) DisplayTLFCreateWithInvite(context.Context, keybase1.DisplayTLFCreateWithInviteArg) error {
	return simpleIdentifyUIError("DisplayTLFCreateWithInvite")
}

// copied from engine tests
type flakeyRooterAPI struct {
	orig     libkb.ExternalAPI
	flakeOut bool
	hardFail bool
	G        *libkb.GlobalContext
}

func newFlakeyRooterAPI(x libkb.ExternalAPI) *flakeyRooterAPI {
	return &flakeyRooterAPI{
		orig: x,
	}
}

func (e *flakeyRooterAPI) GetText(arg libkb.APIArg) (*libkb.ExternalTextRes, error) {
	e.G.Log.Debug("| flakeyRooterAPI.GetText, hard = %v, flake = %v", e.hardFail, e.flakeOut)
	return e.orig.GetText(arg)
}

func (e *flakeyRooterAPI) Get(m libkb.MetaContext, arg libkb.APIArg) (res *libkb.ExternalAPIRes, err error) {
	m.CDebugf("| flakeyRooterAPI.Get, hard = %v, flake = %v", e.hardFail, e.flakeOut)
	// Show an error if we're in flakey mode
	if strings.Contains(arg.Endpoint, "rooter") {
		if e.hardFail {
			return &libkb.ExternalAPIRes{HTTPStatus: 404}, &libkb.APIError{Msg: "NotFound", Code: 404}
		}
		if e.flakeOut {
			return &libkb.ExternalAPIRes{HTTPStatus: 429}, &libkb.APIError{Msg: "Ratelimited", Code: 429}
		}
	}

	return e.orig.Get(m, arg)
}

func (e *flakeyRooterAPI) GetHTML(arg libkb.APIArg) (res *libkb.ExternalHTMLRes, err error) {
	e.G.Log.Debug("| flakeyRooterAPI.GetHTML, hard = %v, flake = %v", e.hardFail, e.flakeOut)
	return e.orig.GetHTML(arg)
}

func (e *flakeyRooterAPI) Post(arg libkb.APIArg) (res *libkb.ExternalAPIRes, err error) {
	return e.orig.Post(arg)
}

func (e *flakeyRooterAPI) PostHTML(arg libkb.APIArg) (res *libkb.ExternalHTMLRes, err error) {
	return e.orig.PostHTML(arg)
}
