package teams

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// Storage stores TeamData's on memory and disk. Threadsafe. For the standard loader,
// which does a complete but slower load. Compare to FTLStorage which stores the
// Fast-loaded team state.
type Storage struct {
	*storageGeneric
}

// Increment to invalidate the disk cache.
const diskStorageVersion = 10
const memCacheLRUSize = 200

type DiskStorageItem struct {
	Version int                `codec:"V"`
	State   *keybase1.TeamData `codec:"S"`
}

var _ teamDataGeneric = (*keybase1.TeamData)(nil)
var _ diskItemGeneric = (*DiskStorageItem)(nil)

func (d *DiskStorageItem) version() int {
	return d.Version
}
func (d *DiskStorageItem) value() teamDataGeneric {
	return d.State
}
func (d *DiskStorageItem) setVersion(i int) {
	d.Version = i
}
func (d *DiskStorageItem) setValue(v teamDataGeneric) error {
	typed, ok := v.(*keybase1.TeamData)
	if !ok {
		return fmt.Errorf("teams.Storage#Put: Bad object for setValue; got type %T", v)
	}
	d.State = typed
	return nil
}

func NewStorage(g *libkb.GlobalContext) *Storage {
	s := newStorageGeneric(g, memCacheLRUSize, diskStorageVersion, libkb.DBSlowTeamsAlias, libkb.EncryptionReasonTeamsLocalStorage, "slow", func() diskItemGeneric { return &DiskStorageItem{} })
	return &Storage{s}
}

func (s *Storage) Put(mctx libkb.MetaContext, state *keybase1.TeamData) {
	s.storageGeneric.put(mctx, state)
}

// Can return nil.
func (s *Storage) Get(mctx libkb.MetaContext, teamID keybase1.TeamID, public bool) *keybase1.TeamData {
	vp := s.storageGeneric.get(mctx, teamID, public)
	if vp == nil {
		return nil
	}
	ret, ok := vp.(*keybase1.TeamData)
	if !ok {
		mctx.Debug("teams.Storage#Get cast error: %T is wrong type", vp)
	}
	return ret
}
