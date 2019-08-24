package storage

import (
	"fmt"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type FTLStorageUpgrader func(mctx libkb.MetaContext, state *keybase1.FastTeamData) (changed bool, err error)

// FTLStorage stores FTL state to disk or memory.
type FTLStorage struct {
	*storageGeneric
	upgrader FTLStorageUpgrader
}

// Increment to invalidate the disk cache.
const ftlDiskStorageVersion = 10
const ftlMemCacheLRUSize = 200

type ftlDiskStorageItem struct {
	Version int                    `codec:"V"`
	State   *keybase1.FastTeamData `codec:"S"`
}

var _ teamDataGeneric = (*keybase1.FastTeamData)(nil)
var _ diskItemGeneric = (*ftlDiskStorageItem)(nil)

func (d *ftlDiskStorageItem) version() int {
	return d.Version
}
func (d *ftlDiskStorageItem) value() teamDataGeneric {
	return d.State
}
func (d *ftlDiskStorageItem) setVersion(i int) {
	d.Version = i
}
func (d *ftlDiskStorageItem) setValue(v teamDataGeneric) error {
	typed, ok := v.(*keybase1.FastTeamData)
	if !ok {
		return fmt.Errorf("teams.FTLStorage#Put: Bad object for setValue; got type %T", v)
	}
	d.State = typed
	return nil
}

func NewFTLStorage(g *libkb.GlobalContext, upgrader FTLStorageUpgrader) *FTLStorage {
	s := newStorageGeneric(g, ftlMemCacheLRUSize, ftlDiskStorageVersion, libkb.DBFTLStorage, libkb.EncryptionReasonTeamsFTLLocalStorage, "ftl", func() diskItemGeneric { return &ftlDiskStorageItem{} })
	return &FTLStorage{storageGeneric: s, upgrader: upgrader}
}

func (s *FTLStorage) Put(mctx libkb.MetaContext, state *keybase1.FastTeamData) {
	s.storageGeneric.put(mctx, state)
}

// Can return nil.
func (s *FTLStorage) Get(mctx libkb.MetaContext, teamID keybase1.TeamID, public bool) (data *keybase1.FastTeamData, frozen bool, tombstoned bool) {
	vp := s.storageGeneric.get(mctx, teamID, public)
	if vp == nil {
		return nil, false, false
	}
	ret, ok := vp.(*keybase1.FastTeamData)
	if !ok {
		mctx.Debug("teams.FTLStorage#Get cast error: %T is wrong type", vp)
		return nil, false, false
	}

	changed, err := s.upgrader(mctx, ret)
	if err != nil {
		mctx.Debug("error in upgrade of stored object: %s", err)
		return nil, false, false
	}

	if changed {
		// Put the upgraded object directly into the store.
		s.Put(mctx, ret)
	}

	if ret.Frozen {
		mctx.Debug("returning frozen fast team data")
	}
	if ret.Tombstoned {
		mctx.Debug("returning tombstoned fast team data")
	}
	return ret, ret.Frozen, ret.Tombstoned
}
