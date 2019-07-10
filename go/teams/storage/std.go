package storage

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
const diskStorageVersion = 11
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
func (s *Storage) Get(mctx libkb.MetaContext, teamID keybase1.TeamID, public bool) (data *keybase1.TeamData, frozen bool, tombstoned bool) {
	vp := s.storageGeneric.get(mctx, teamID, public)
	if vp == nil {
		return nil, false, false
	}
	ret, ok := vp.(*keybase1.TeamData)
	if !ok {
		mctx.Debug("teams.Storage#Get cast error: %T is wrong type", vp)
		return nil, false, false
	}

	if diskStorageVersion == 10 && ret.Subversion == 0 {
		migrateInvites(mctx, ret.ID(), ret.Chain.ActiveInvites)
		migrateInvites(mctx, ret.ID(), ret.Chain.ObsoleteInvites)
		ret.Subversion = 1
	}

	if diskStorageVersion == 10 && (ret.Subversion == 1 || ret.Chain.MaxPerTeamKeyGeneration == keybase1.PerTeamKeyGeneration(0)) {
		prior := ret.Chain.MaxPerTeamKeyGeneration
		// 2019-06: We added MaxPerTeamKeyGeneration and can hot-patch existing structures
		// pretty easily, so do that rather than blasting away the cache.
		for k := range ret.Chain.PerTeamKeys {
			if k > ret.Chain.MaxPerTeamKeyGeneration {
				ret.Chain.MaxPerTeamKeyGeneration = k
			}
		}
		mctx.Debug("Upgraded MaxPerTeamKeyGeneration to %d in version 10.2 (prior: %d, %d)", ret.Chain.MaxPerTeamKeyGeneration, ret.Subversion, prior)
		ret.Subversion = 2
	}

	if ret.Frozen {
		mctx.Debug("returning frozen team data")
	}
	if ret.Tombstoned {
		mctx.Debug("returning tombstoned team data")
	}
	return ret, ret.Frozen, ret.Tombstoned
}

// migrateInvites converts old 'category unknown' invites into social invites for paramproofs.
func migrateInvites(mctx libkb.MetaContext, teamID keybase1.TeamID, invites map[keybase1.TeamInviteID]keybase1.TeamInvite) {
	for key, invite := range invites {
		category, err := invite.Type.C()
		if err != nil {
			continue
		}
		if category != keybase1.TeamInviteCategory_UNKNOWN {
			continue
		}
		categoryStr := invite.Type.Unknown()
		if mctx.G().GetProofServices().GetServiceType(mctx.Ctx(), categoryStr) == nil {
			continue
		}
		mctx.Debug("migrateInvites repairing teamID:%v inviteID:%v cat:%v", teamID, invite.Id, categoryStr)
		invite.Type = keybase1.NewTeamInviteTypeWithSbs(keybase1.TeamInviteSocialNetwork(categoryStr))
		invites[key] = invite
	}
}
