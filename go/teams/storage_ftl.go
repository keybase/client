package teams

import (
	"fmt"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// FTLStorage stores FTL state to disk or memory.
type FTLStorage struct {
	*storageGeneric
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

func NewFTLStorage(g *libkb.GlobalContext) *FTLStorage {
	s := newStorageGeneric(g, ftlMemCacheLRUSize, ftlDiskStorageVersion, libkb.DBFTLStorage, libkb.EncryptionReasonTeamsFTLLocalStorage, "ftl", func() diskItemGeneric { return &ftlDiskStorageItem{} })
	return &FTLStorage{s}
}

func (s *FTLStorage) Put(mctx libkb.MetaContext, state *keybase1.FastTeamData) {
	s.storageGeneric.put(mctx, state)
}

// Can return nil.
func (s *FTLStorage) Get(mctx libkb.MetaContext, teamID keybase1.TeamID, public bool) *keybase1.FastTeamData {
	vp := s.storageGeneric.get(mctx, teamID, public)
	if vp == nil {
		return nil
	}
	ret, ok := vp.(*keybase1.FastTeamData)
	if !ok {
		mctx.CDebugf("teams.FTLStorage#Get cast error: %T is wrong type", vp)
	}
	return ret
}
