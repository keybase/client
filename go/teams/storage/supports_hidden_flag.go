package storage

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// SupportsHiddenFlagStorage stores the supports_hidden_chain flag to disk and memory.
type SupportsHiddenFlagStorage struct {
	*storageGeneric
}

// Increment to invalidate the disk cache.
const supportsHiddenFlagDiskStorageVersion = 1
const supportsHiddenFlagCacheLRUSize = 5000

// HiddenChainSupportState describes whether a team supports the hidden chain or
// not. This information is fetched from the server and cached.
type HiddenChainSupportState struct {
	TeamID     keybase1.TeamID
	State      bool
	CacheUntil time.Time
}

type supportsHiddenFlagDiskStorageItem struct {
	Version int                      `codec:"V"`
	State   *HiddenChainSupportState `codec:"S"`
}

var _ teamDataGeneric = (*HiddenChainSupportState)(nil)
var _ diskItemGeneric = (*supportsHiddenFlagDiskStorageItem)(nil)

func (ss *HiddenChainSupportState) IsPublic() bool {
	return ss.TeamID.IsPublic()
}

func (ss *HiddenChainSupportState) ID() keybase1.TeamID {
	return ss.TeamID
}

func (d *supportsHiddenFlagDiskStorageItem) version() int {
	return d.Version
}
func (d *supportsHiddenFlagDiskStorageItem) value() teamDataGeneric {
	return d.State
}
func (d *supportsHiddenFlagDiskStorageItem) setVersion(i int) {
	d.Version = i
}

func (d *supportsHiddenFlagDiskStorageItem) setValue(v teamDataGeneric) error {
	typed, ok := v.(*HiddenChainSupportState)
	if !ok {
		return fmt.Errorf("teams/storage.supportsHiddenFlagDiskStorageItem#setValue: Bad object; got type %T", v)
	}
	d.State = typed
	return nil
}

func NewSupportsHiddenFlagStorage(g *libkb.GlobalContext) *SupportsHiddenFlagStorage {
	s := newStorageGeneric(
		g,
		supportsHiddenFlagCacheLRUSize,
		supportsHiddenFlagDiskStorageVersion,
		libkb.DBSupportsHiddenFlagStorage,
		libkb.EncryptionReasonTeamsHiddenLocalStorage,
		"hidden flag",
		func() diskItemGeneric { return &supportsHiddenFlagDiskStorageItem{} },
	)
	return &SupportsHiddenFlagStorage{s}
}

func (s *SupportsHiddenFlagStorage) Put(mctx libkb.MetaContext, state *HiddenChainSupportState) {
	s.storageGeneric.put(mctx, state)
}

// Can return nil.
func (s *SupportsHiddenFlagStorage) Get(mctx libkb.MetaContext, teamID keybase1.TeamID) (state *HiddenChainSupportState) {
	vp := s.storageGeneric.get(mctx, teamID, teamID.IsPublic())
	if vp == nil {
		return nil
	}
	ret, ok := vp.(*HiddenChainSupportState)
	if !ok {
		mctx.Debug("teams.storage/SupportsHiddenFlagStorage#Get cast error: %T is wrong type", vp)
		return nil
	}
	return ret
}

func (s *SupportsHiddenFlagStorage) ClearEntryIfFalse(mctx libkb.MetaContext, teamID keybase1.TeamID) {
	if currentState := s.Get(mctx, teamID); currentState != nil && !currentState.State {
		// put an expired cache state, with 0 CacheUntil
		s.Put(mctx, &HiddenChainSupportState{TeamID: teamID, State: false, CacheUntil: time.Time{}})
	}
}
