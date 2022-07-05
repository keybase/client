package storage

import (
	"fmt"
	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"log"
	"sync"
)

// Merkle stores when a team last polled merkle. Threadsafe.
type Merkle struct {
	sync.Mutex
	lru *lru.Cache
}

// Increment to invalidate the disk cache.
const merkleDiskStorageVersion = 1
const merkleMemCacheLRUSize = 2000

type merkleDiskStorageItem struct {
	Version  int           `codec:"V"`
	PolledAt keybase1.Time `codec:"T"`
}

func NewMerkle() *Merkle {
	nlru, err := lru.New(merkleMemCacheLRUSize)
	if err != nil {
		// lru.New only panics if size <= 0
		log.Panicf("Could not create lru cache: %v", err)
	}
	return &Merkle{
		lru: nlru,
	}
}

func merkleKey(teamID keybase1.TeamID, public bool) libkb.DbKey {
	key := genericStringKey(teamID, public)
	dbKey := libkb.DbKey{
		Typ: libkb.DBTeamMerkleCheck,
		Key: key,
	}
	return dbKey
}

func (s *Merkle) Put(mctx libkb.MetaContext, teamID keybase1.TeamID, public bool, time keybase1.Time) {
	s.Lock()
	defer s.Unlock()
	key := merkleKey(teamID, public)
	s.lru.Add(key.Key, time)
	obj := merkleDiskStorageItem{
		Version:  merkleDiskStorageVersion,
		PolledAt: time,
	}
	mctx.VLogf(libkb.VLog0, "teams/storage.Merkle#Put(%s) <- %d", teamID, time)
	err := mctx.G().LocalDb.PutObj(key, nil, obj)
	if err != nil {
		mctx.Warning("teams/storage.Merkle: Failed to put key %+v: %s", key, err.Error())
	}
}

func (s *Merkle) Get(mctx libkb.MetaContext, teamID keybase1.TeamID, public bool) (polledAt *keybase1.Time) {
	s.Lock()
	defer s.Unlock()
	key := merkleKey(teamID, public)

	report := func(res string, ret *keybase1.Time) {
		var s string
		if ret != nil {
			s = fmt.Sprintf(" -> %d", *ret)
		}
		mctx.VLogf(libkb.VLog0, "teams/storage.Merkle#Get(%s) -> %s%s", teamID, res, s)
	}

	untyped, ok := s.lru.Get(key.Key)
	if ok {
		ret, ok := untyped.(keybase1.Time)
		if ok {
			report("hit mem", &ret)
			return &ret
		}
		mctx.Warning("teams/storage.Merkle: Pulled object at %+v of wrong type: %T", key, untyped)
	}
	var tmp merkleDiskStorageItem
	found, err := mctx.G().LocalDb.GetInto(&tmp, key)
	if !found {
		report("missed", nil)
		return nil
	}
	if err != nil {
		mctx.Warning("teams/storage.Merkle: error fetching %+v from disk: %s", key, err.Error())
	}
	if tmp.Version != merkleDiskStorageVersion {
		mctx.Debug("teams/storage.Merkle: skipping old version %d for key %+v", tmp.Version, key)
		return nil
	}
	report("hit disk", &tmp.PolledAt)
	return &tmp.PolledAt
}
