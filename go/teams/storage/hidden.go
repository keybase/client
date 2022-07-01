package storage

import (
	"fmt"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// HiddenStorage stores Hidden state to disk or memory.
type HiddenStorage struct {
	*storageGeneric
}

// Increment to invalidate the disk cache.
const hiddenDiskStorageVersion = 1
const hiddenMemCacheLRUSize = 200

type hiddenDiskStorageItem struct {
	Version int                       `codec:"V"`
	State   *keybase1.HiddenTeamChain `codec:"S"`
}

var _ teamDataGeneric = (*keybase1.HiddenTeamChain)(nil)
var _ diskItemGeneric = (*hiddenDiskStorageItem)(nil)

func (d *hiddenDiskStorageItem) version() int {
	return d.Version
}
func (d *hiddenDiskStorageItem) value() teamDataGeneric {
	return d.State
}
func (d *hiddenDiskStorageItem) setVersion(i int) {
	d.Version = i
}
func (d *hiddenDiskStorageItem) setValue(v teamDataGeneric) error {
	typed, ok := v.(*keybase1.HiddenTeamChain)
	if !ok {
		return fmt.Errorf("teams/storage.Hidden#Put: Bad object for setValue; got type %T", v)
	}
	d.State = typed
	return nil
}

func NewHiddenStorage(g *libkb.GlobalContext) *HiddenStorage {
	s := newStorageGeneric(g, hiddenMemCacheLRUSize, hiddenDiskStorageVersion, libkb.DBHiddenChainStorage, libkb.EncryptionReasonTeamsHiddenLocalStorage, "hidden", func() diskItemGeneric { return &hiddenDiskStorageItem{} })
	return &HiddenStorage{s}
}

func (s *HiddenStorage) Put(mctx libkb.MetaContext, state *keybase1.HiddenTeamChain) {
	s.storageGeneric.put(mctx, state)
}

// Can return nil.
func (s *HiddenStorage) Get(mctx libkb.MetaContext, teamID keybase1.TeamID, public bool) (state *keybase1.HiddenTeamChain, frozen bool, tombstoned bool) {
	vp := s.storageGeneric.get(mctx, teamID, public)
	if vp == nil {
		return nil, false, false
	}
	ret, ok := vp.(*keybase1.HiddenTeamChain)
	if !ok {
		mctx.Debug("teams.storage/Hidden#Get cast error: %T is wrong type", vp)
	}
	if ret.Frozen {
		mctx.Debug("returning frozen hidden team data")
	}
	if ret.Tombstoned {
		mctx.Debug("returning tombstoned hidden team data")
	}
	s.upgrade(mctx, ret)
	return ret, ret.Frozen, ret.Tombstoned
}

func (s *HiddenStorage) upgrade(mctx libkb.MetaContext, ret *keybase1.HiddenTeamChain) {
	if ret == nil {
		return
	}
	// We added LastFull after the fact, so go back and populate this field if it wasn't
	// read in from the object.
	if ret.Subversion < 1 {
		mctx.Debug("HiddenStorage#upgrade: upgrading from 1.0 to 1.1 (running PopulateLastFull())")
		ret.PopulateLastFull()
		ret.Subversion = 1
	}
}
