// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	lru "github.com/hashicorp/golang-lru"
	"github.com/pkg/errors"
	"gopkg.in/src-d/go-git.v4/plumbing"
	"gopkg.in/src-d/go-git.v4/plumbing/storer"
	"gopkg.in/src-d/go-git.v4/storage"
)

// OnDemandStorer is a wrapper around a storage.Storer that reads
// encoded objects from disk only when the data is needed, to avoid
// pulling too much data into memory.
type OnDemandStorer struct {
	storage.Storer
	recentCache *lru.Cache
}

var _ storage.Storer = (*OnDemandStorer)(nil)
var _ storer.DeltaObjectStorer = (*OnDemandStorer)(nil)

// NewOnDemandStorer constructs an on-demand storage layer on top of
// an existing `Storer`.
func NewOnDemandStorer(s storage.Storer) (*OnDemandStorer, error) {
	// Track a small number of recent in-memory objects, to improve
	// performance without impacting memory too much.
	//
	// LRU is very helpful here because of the way delta compression
	// works. It first sorts the objects by type and descending size,
	// and then compares each object to a sliding window of previous
	// objects to find a good match. By default in git, the sliding
	// window for compression is 10, and it's good to have a
	// slightly larger cache size than that to avoid thrashing.
	//
	// To avoid memory pressure, it might be nice to additionally
	// consider capping the total size of this cache (e.g., with
	// github.com/keybase/cache). However, since the set in use is
	// based on the sliding window, it seems like that should be the
	// limiting factor. Eventually we might hit some repo where
	// there's a set of large objects that can overrun memory, but at
	// the limit that could be any two objects, and then the
	// compression algorithm in go-git is worthless.  So for now,
	// let's just limit by number of entries, and add size-limits
	// later if needed.
	recentCache, err := lru.New(25)
	if err != nil {
		return nil, err
	}
	return &OnDemandStorer{s, recentCache}, nil
}

// EncodedObject implements the storage.Storer interface for OnDemandStorer.
func (ods *OnDemandStorer) EncodedObject(
	ot plumbing.ObjectType, hash plumbing.Hash) (
	plumbing.EncodedObject, error) {
	o := &onDemandObject{
		s:           ods.Storer,
		hash:        hash,
		objType:     ot,
		size:        -1,
		recentCache: ods.recentCache,
	}
	// If the object is missing, we need to return an error for that
	// here.  But don't read all the object data from disk by calling
	// `Storer.EncodedObject()` or `o.cache()`.  Instead use a
	// KBFS-specific `HasEncodedObject()` method that just tells us
	// whether or not the object exists.
	err := ods.Storer.HasEncodedObject(hash)
	if err != nil {
		return nil, err
	}

	return o, nil
}

// DeltaObject implements the storer.DeltaObjectStorer interface for
// OnDemandStorer.
func (ods *OnDemandStorer) DeltaObject(
	ot plumbing.ObjectType, hash plumbing.Hash) (
	plumbing.EncodedObject, error) {
	edos, ok := ods.Storer.(storer.DeltaObjectStorer)
	if !ok {
		return nil, errors.New("Not a delta storer")
	}
	o := &onDemandDeltaObject{
		s:           edos,
		hash:        hash,
		objType:     ot,
		size:        -1,
		recentCache: ods.recentCache,
	}
	// Need to see if this is a delta object, which means reading all
	// the data.
	_, err := o.cache()
	_, notDelta := err.(notDeltaError)
	if notDelta {
		return ods.EncodedObject(ot, hash)
	} else if err != nil {
		return nil, err
	}
	return o, nil
}
