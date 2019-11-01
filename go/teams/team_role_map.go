package teams

import (
	"errors"
	"fmt"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"sync"
	"time"
)

type TeamRoleMapManager struct {
	sync.Mutex
	lastKnownVersion *keybase1.UserTeamVersion
	state            *keybase1.TeamRoleMapStored
}

func NewTeamRoleMapManagerAndInstall(g *libkb.GlobalContext) {
	r := &TeamRoleMapManager{}
	g.SetTeamRoleMapManager(r)
}

var _ libkb.TeamRoleMapManager = (*TeamRoleMapManager)(nil)

func (t *TeamRoleMapManager) isFresh(m libkb.MetaContext, state *keybase1.TeamRoleMapStored) bool {
	if t.lastKnownVersion != nil && *t.lastKnownVersion > state.Data.Version {
		m.Debug("TeamRoleMap version is stale (%d > %d)", *t.lastKnownVersion, state.Data.Version)
		return false
	}
	tm := state.CachedAt.Time()
	diff := m.G().Clock().Now().Sub(tm)
	if diff >= 48*time.Hour {
		m.Debug("TeamRoleMap isn't fresh, it's %s old", diff)
		return false
	}
	return true
}

func (t *TeamRoleMapManager) dbKey(mctx libkb.MetaContext, uid keybase1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBTeamRoleMap,
		Key: string(uid),
	}
}

func (t *TeamRoleMapManager) loadFromDB(mctx libkb.MetaContext, uid keybase1.UID) (err error) {
	var obj keybase1.TeamRoleMapStored
	var found bool
	found, err = mctx.G().LocalDb.GetInto(&obj, t.dbKey(mctx, uid))
	if err != nil {
		mctx.Debug("Error fetching TeamRoleMap from disk: %s", err)
		return err
	}
	if !found {
		mctx.Debug("No stored TeamRoleMap for %s", uid)
		return nil
	}
	t.state = &obj
	return nil
}

func (t *TeamRoleMapManager) storeToDB(mctx libkb.MetaContext, uid keybase1.UID) (err error) {
	return mctx.G().LocalDb.PutObj(t.dbKey(mctx, uid), nil, *t.state)
}

func (t *TeamRoleMapManager) isLoadedAndFresh(mctx libkb.MetaContext) bool {
	return t.state != nil && t.isFresh(mctx, t.state)
}

func (t *TeamRoleMapManager) load(mctx libkb.MetaContext) (err error) {
	uid := mctx.CurrentUID()
	if uid.IsNil() {
		return errors.New("cannot get TeamRoleMap for a logged out user")
	}

	if t.isLoadedAndFresh(mctx) {
		return nil
	}

	if t.state == nil {
		_ = t.loadFromDB(mctx, uid)
	}

	if t.isLoadedAndFresh(mctx) {
		mctx.Debug("Loaded fresh TeamRoleMap from DB")
		return nil
	}

	type apiResType struct {
		keybase1.TeamRoleMapAndVersion
		libkb.AppStatusEmbed
	}
	var apiRes apiResType

	arg := libkb.NewAPIArg("team/for_user")
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.RetryCount = 3
	arg.AppStatusCodes = []int{libkb.SCOk, libkb.SCNoUpdate}
	arg.Args = libkb.HTTPArgs{
		"compact": libkb.B{Val: true},
	}
	var currVersion keybase1.UserTeamVersion
	if t.state != nil {
		currVersion = t.state.Data.Version
		arg.Args["user_team_version"] = libkb.I{Val: int(currVersion)}
	}
	err = mctx.G().API.GetDecode(mctx, arg, &apiRes)
	if err != nil {
		mctx.Debug("failed to TeamRoleMap from server: %s", err)
		return err
	}

	if apiRes.Status.Code == libkb.SCNoUpdate {
		t.lastKnownVersion = &currVersion
		mctx.Debug("TeamRoleMap was fresh at version %d", currVersion)
		return nil
	}

	t.state = &keybase1.TeamRoleMapStored{
		Data:     apiRes.TeamRoleMapAndVersion,
		CachedAt: keybase1.ToTime(mctx.G().Clock().Now()),
	}
	t.lastKnownVersion = &t.state.Data.Version
	_ = t.storeToDB(mctx, uid)
	mctx.Debug("Updating TeamRoleMap to version %d", t.state.Data.Version)

	return nil
}

func (t *TeamRoleMapManager) Get(mctx libkb.MetaContext) (res keybase1.TeamRoleMapAndVersion, err error) {
	defer mctx.Trace("TeamRoleMapManager#Get", func() error { return err })()
	t.Lock()
	defer t.Unlock()
	err = t.load(mctx)
	if err != nil {
		return res, err
	}
	return t.state.Data, nil
}

func (t *TeamRoleMapManager) Update(mctx libkb.MetaContext, version keybase1.UserTeamVersion) (err error) {
	defer mctx.Trace(fmt.Sprintf("TeamRoleMapManager#Update(%d)", version), func() error { return err })()
	t.Lock()
	defer t.Unlock()
	t.lastKnownVersion = &version
	if t.isLoadedAndFresh(mctx) {
		mctx.Debug("Swallowing update for TeamRoleMap to version %d, since it's already loaded and fresh", version)
		return nil
	}
	mctx.G().NotifyRouter.HandleTeamRoleMapChanged(mctx.Ctx(), version)
	return t.load(mctx)
}

func (t *TeamRoleMapManager) FlushCache() {
	t.Lock()
	defer t.Unlock()
	t.state = nil
}

// Query the state of the team role list manager -- only should be used in testing, as it's
// not exposed in the geenric libkb.TeamRoleMapManager interface. For testing, we want to see if
// the update path is actually updating the team, so we want to be able to query what's in the manager
// without going to disk or network if it's stale.
func (t *TeamRoleMapManager) Query() *keybase1.TeamRoleMapStored {
	t.Lock()
	defer t.Unlock()
	if t.state == nil {
		return nil
	}
	tmp := t.state.DeepCopy()
	return &tmp
}
