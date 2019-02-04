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
	// Note(maxtaco) 2018.10.08 --- Note a bug here, that we used the `libkb.DBChatInbox` type here.
	// That's a copy-paste bug, but we get away with it since we have a `tid:` prefix that
	// disambiguates these entries from true Chat entries. We're not going to fix it now
	// since it would kill the team cache, but sometime in the future we should fix it.
	s := newStorageGeneric(g, memCacheLRUSize, diskStorageVersion, libkb.DBChatInbox, libkb.EncryptionReasonTeamsLocalStorage, "slow", func() diskItemGeneric { return &DiskStorageItem{} })
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
		mctx.CDebugf("teams.Storage#Get cast error: %T is wrong type", vp)
	}
	return ret
}
