package teams

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/lru"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// Increment to invalidate the disk cache.
const diskStorageVersionConflictInfo = 1

type conflictID struct {
	isPublic bool
	id       keybase1.TeamID
}

func (i conflictID) MemKey() string {
	prefix := "r"
	if i.isPublic {
		prefix = "u"
	}
	return fmt.Sprintf("%s%s", prefix, i.id)
}

func (i conflictID) DbKey() libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.ObjType(libkb.DBImplicitTeamConflictInfo),
		Key: i.MemKey(),
	}
}

var _ libkb.LRUKeyer = conflictID{}

type rawGetConflictInfo struct {
	Status       libkb.AppStatus                    `json:"status"`
	ConflictInfo *keybase1.ImplicitTeamConflictInfo `json:"conflict_info"`
}

func (r *rawGetConflictInfo) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

func GetConflictInfo(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID, isFullyResolved bool, name keybase1.ImplicitTeamDisplayName) (ret keybase1.ImplicitTeamDisplayName, err error) {
	mctx := libkb.NewMetaContext(ctx, g)
	defer mctx.TraceTimed(fmt.Sprintf("GetConflictInfo(%s,%v)", id, name), func() error { return err })()

	ret = name.DeepCopy()

	key := conflictID{name.IsPublic, id}
	cv, err := g.GetImplicitTeamConflictInfoCacher().Get(ctx, g, key)
	if err != nil {
		mctx.Debug("In fetching from cache: %s", err.Error())
	}
	if cv != nil {
		if p, ok := cv.(*keybase1.ImplicitTeamConflictInfo); ok {
			if p.IsConflict() {
				ret.ConflictInfo = p
			}
			return ret, nil
		}
		mctx.Debug("Bad element of wrong type from cache: %T", cv)
	}

	displayName, err := FormatImplicitTeamDisplayName(ctx, g, name)
	if err != nil {
		return ret, err
	}

	arg := libkb.NewAPIArg("team/conflict_info")
	arg.SessionType = libkb.APISessionTypeREQUIRED
	if name.IsPublic {
		arg.SessionType = libkb.APISessionTypeOPTIONAL
	}
	arg.Args = libkb.HTTPArgs{
		"tid":          libkb.S{Val: string(id)},
		"display_name": libkb.S{Val: displayName},
		"public":       libkb.B{Val: name.IsPublic},
	}
	var raw rawGetConflictInfo
	if err = mctx.G().API.GetDecode(mctx, arg, &raw); err != nil {
		return ret, err
	}

	ci := raw.ConflictInfo
	ret.ConflictInfo = ci

	// If the team is not fully resolved, and there isn't a conflict, there might
	// still become a conflict in the future, so we decide not to cache it.
	// Otherwise, the answer stays true indefinitely, so we can cache the value
	// without fear of staleness.
	if isFullyResolved || ci.IsConflict() {
		tmpErr := mctx.G().GetImplicitTeamConflictInfoCacher().Put(ctx, g, key, ci)
		if tmpErr != nil {
			mctx.Debug("Failed to cached implicit team conflict info: %s", tmpErr.Error())
		}
	}

	return ret, nil
}

func NewImplicitTeamConflictInfoCache(g *libkb.GlobalContext) *lru.Cache {
	return lru.NewLRU(g, libkb.ImplicitTeamConflictInfoCacheSize, diskStorageVersionConflictInfo, keybase1.ImplicitTeamConflictInfo{})
}

func NewImplicitTeamConflictInfoCacheAndInstall(g *libkb.GlobalContext) {
	cache := NewImplicitTeamConflictInfoCache(g)
	g.SetImplicitTeamConflictInfoCacher(cache)
	g.AddLogoutHook(cache, "implicitTeamConflictInfoCache")
	g.AddDbNukeHook(cache, "implicitTeamConflictInfoCache")
}
