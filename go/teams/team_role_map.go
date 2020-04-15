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
	libkb.NoopNotifyListener
	sync.Mutex
	lastKnownVersion *keybase1.UserTeamVersion
	state            *keybase1.TeamRoleMapStored
	reachabilityCh   chan keybase1.Reachability
}

func NewTeamRoleMapManagerAndInstall(g *libkb.GlobalContext) {
	r := NewTeamRoleMapManager()
	g.SetTeamRoleMapManager(r)
	if g.NotifyRouter != nil {
		g.NotifyRouter.AddListener(r)
	}
}

func NewTeamRoleMapManager() *TeamRoleMapManager {
	return &TeamRoleMapManager{
		reachabilityCh: make(chan keybase1.Reachability),
	}
}

var _ libkb.TeamRoleMapManager = (*TeamRoleMapManager)(nil)

// Reachability should be called whenever the reachability status of the app changes
// (via NotifyRouter). If we happen to be waiting on a timer to do a refresh, then break
// out and refresh it.
func (t *TeamRoleMapManager) Reachability(r keybase1.Reachability) {
	if r.Reachable == keybase1.Reachable_NO {
		return
	}
	select {
	case t.reachabilityCh <- r:
	default:
	}
}

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

func (t *TeamRoleMapManager) wait(mctx libkb.MetaContext, dur time.Duration) {
	select {
	case <-mctx.G().Clock().After(dur):
		mctx.Debug("Waited the full %s duration", dur)
	case r := <-t.reachabilityCh:
		mctx.Debug("short-circuited wait since we came back online (%s)", r.Reachable)
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

func backoffInitial(doBackoff bool) time.Duration {
	if !doBackoff {
		return time.Duration(0)
	}
	return 2 * time.Minute
}

func backoffIncrease(d time.Duration) time.Duration {
	d = time.Duration(float64(d) * 1.25)
	max := 10 * time.Minute
	if d > max {
		d = max
	}
	return d
}

func (t *TeamRoleMapManager) loadDelayedRetry(mctx libkb.MetaContext, backoff time.Duration) {
	mctx = mctx.WithLogTag("TRMM-LDR")
	var err error
	defer mctx.Trace("TeamRoleMapManager#loadDelayedRetry", &err)()

	if backoff == time.Duration(0) {
		mctx.Debug("Not retrying, no backoff specified")
		return
	}

	mctx.Debug("delayed retry: sleeping for %s backoff", backoff)
	t.wait(mctx, backoff)

	t.Lock()
	defer t.Unlock()
	if t.isLoadedAndFresh(mctx) {
		mctx.Debug("delayed retry: TeamRoleMap was fresh, so nothing to do")
		return
	}

	// Note that we are passing retryOnFail=true, meaning we're going to keep the retry attempt
	// going if we fail again (but with a bigger backoff parameter).
	err = t.load(mctx, backoffIncrease(backoff))
	if err != nil {
		mctx.Debug("delayed retry: exiting on error: %s", err)
		return
	}

	// If we're here, it's because someone called #Get(_,true), meaning they wanted a retry
	// on failure, and there was a failure. In that case, we call back to them
	// (via sendNotification), and they will reattempt the Get(), hopefully succeeding this time.
	t.sendNotification(mctx, t.state.Data.Version)
}

func (t *TeamRoleMapManager) sendNotification(mctx libkb.MetaContext, version keybase1.UserTeamVersion) {
	mctx.G().NotifyRouter.HandleTeamRoleMapChanged(mctx.Ctx(), version)
}

func (t *TeamRoleMapManager) load(mctx libkb.MetaContext, retryOnFailBackoff time.Duration) (err error) {
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
		go t.loadDelayedRetry(mctx.BackgroundWithLogTags(), retryOnFailBackoff)
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

// Get is called from the frontend to refresh its view of the TeamRoleMap state. The unfortunate
// case is when the
func (t *TeamRoleMapManager) Get(mctx libkb.MetaContext, retryOnFail bool) (res keybase1.TeamRoleMapAndVersion, err error) {
	defer mctx.Trace("TeamRoleMapManager#Get", &err)()
	t.Lock()
	defer t.Unlock()
	err = t.load(mctx, backoffInitial(retryOnFail))
	if err != nil {
		return res, err
	}
	return t.state.Data, nil
}

func (t *TeamRoleMapManager) Update(mctx libkb.MetaContext, version keybase1.UserTeamVersion) (err error) {
	defer mctx.Trace(fmt.Sprintf("TeamRoleMapManager#Update(%d)", version), &err)()
	t.Lock()
	defer t.Unlock()
	t.lastKnownVersion = &version
	if t.isLoadedAndFresh(mctx) {
		mctx.Debug("Swallowing update for TeamRoleMap to version %d, since it's already loaded and fresh", version)
		return nil
	}
	t.sendNotification(mctx, version)
	return t.load(mctx, backoffInitial(false))
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
