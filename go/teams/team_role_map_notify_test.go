package teams

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// roleMapAPI stands in for the API server's team/for_user endpoint.
type roleMapAPI struct {
	libkb.API
	res keybase1.TeamRoleMapAndVersion
}

func (a *roleMapAPI) GetDecode(_ libkb.MetaContext, _ libkb.APIArg, w libkb.APIResponseWrapper) error {
	body, err := json.Marshal(map[string]any{
		"status":            map[string]any{"code": libkb.SCOk},
		"teams":             a.res.Teams,
		"user_team_version": a.res.Version,
	})
	if err != nil {
		return err
	}
	return json.Unmarshal(body, w)
}

// rolesListener records teamChanged (roles) and, while block is set, holds each
// one until released.
type rolesListener struct {
	libkb.NoopNotifyListener
	block   bool
	entered chan keybase1.TeamID
	release chan struct{}
}

func (l *rolesListener) TeamChanged(teamID keybase1.TeamID, kinds keybase1.TeamChangedKinds, _ keybase1.UserTeamVersion) {
	if !kinds.Roles {
		return
	}
	l.entered <- teamID
	if l.block {
		<-l.release
	}
}

func setupRoleMapNotifyTest(t *testing.T, block bool) (libkb.TestContext, *rolesListener) {
	tc := libkb.SetupTest(t, "TeamRoleMapNotify", 1)
	tc.G.SetService()
	deviceID, err := libkb.NewDeviceID()
	require.NoError(t, err)
	sigKey, err := libkb.GenerateNaclSigningKeyPair()
	require.NoError(t, err)
	encKey, err := libkb.GenerateNaclDHKeyPair()
	require.NoError(t, err)
	require.NoError(t, tc.G.ActiveDevice.Set(libkb.NewMetaContextForTest(tc),
		keybase1.UserVersion{Uid: libkb.UsernameToUID("testuser"), EldestSeqno: 1}, deviceID, sigKey, encKey,
		"testuser-mac", 0, libkb.KeychainModeNone))
	listener := &rolesListener{
		block:   block,
		entered: make(chan keybase1.TeamID, 10),
		release: make(chan struct{}),
	}
	tc.G.NotifyRouter.AddListener(listener)
	return tc, listener
}

var (
	roleMapTeamA = keybase1.TeamID("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa24")
	roleMapTeamB = keybase1.TeamID("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb24")
)

func roleMapV(version keybase1.UserTeamVersion, a keybase1.TeamRole) keybase1.TeamRoleMapAndVersion {
	return keybase1.TeamRoleMapAndVersion{
		Version: version,
		Teams: map[keybase1.TeamID]keybase1.TeamRolePair{
			roleMapTeamA: {Role: a},
			roleMapTeamB: {Role: keybase1.TeamRole_READER},
		},
	}
}

// A listener still handling a teamChanged (roles) does not hold the role map
// lock: Get and Query work meanwhile.
func TestTeamRoleMapNotifiesWithoutTheLock(t *testing.T) {
	tc, listener := setupRoleMapNotifyTest(t, true)
	defer tc.Cleanup()
	mctx := libkb.NewMetaContextForTest(tc)

	m := NewTeamRoleMapManager()
	tc.G.API = &roleMapAPI{res: roleMapV(1, keybase1.TeamRole_WRITER)}
	_, err := m.Get(mctx, false)
	require.NoError(t, err)

	tc.G.API = &roleMapAPI{res: roleMapV(2, keybase1.TeamRole_ADMIN)}
	updated := make(chan error, 1)
	go func() { updated <- m.Update(mctx, 2) }()
	select {
	case teamID := <-listener.entered:
		require.Equal(t, roleMapTeamA, teamID)
	case <-time.After(10 * time.Second):
		t.Fatal("no teamChanged (roles) sent")
	}

	got := make(chan *keybase1.TeamRoleMapStored, 1)
	go func() { got <- m.Query() }()
	select {
	case stored := <-got:
		require.Equal(t, keybase1.UserTeamVersion(2), stored.Data.Version)
	case <-time.After(5 * time.Second):
		t.Fatal("role map lock held while a teamChanged listener runs")
	}
	close(listener.release)
	require.NoError(t, <-updated)
}

// After a restart the in-memory map is empty; a role change between the map on
// disk and the server's is still announced.
func TestTeamRoleMapNotifiesChangesSinceTheStoredMap(t *testing.T) {
	tc, listener := setupRoleMapNotifyTest(t, false)
	defer tc.Cleanup()
	mctx := libkb.NewMetaContextForTest(tc)

	tc.G.API = &roleMapAPI{res: roleMapV(1, keybase1.TeamRole_WRITER)}
	_, err := NewTeamRoleMapManager().Get(mctx, false)
	require.NoError(t, err)

	restarted := NewTeamRoleMapManager()
	tc.G.API = &roleMapAPI{res: roleMapV(2, keybase1.TeamRole_ADMIN)}
	require.NoError(t, restarted.Update(mctx, 2))
	select {
	case teamID := <-listener.entered:
		require.Equal(t, roleMapTeamA, teamID)
	default:
		t.Fatal("no teamChanged (roles) for the change since the stored map")
	}
	select {
	case teamID := <-listener.entered:
		t.Fatalf("teamChanged (roles) for unchanged team %s", teamID)
	default:
	}
}
