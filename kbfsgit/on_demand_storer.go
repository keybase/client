// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsgit

import (
	lru "github.com/hashicorp/golang-lru"
	"gopkg.in/src-d/go-git.v4/plumbing"
	"gopkg.in/src-d/go-git.v4/storage"
)

// onDemandStorer is a wrapper around a storage.Storer that reads
// encoded objects from disk only when the data is needed, to avoid
// pulling too much data into memory.
type onDemandStorer struct {
	storage.Storer
	recentCache *lru.Cache
}

var _ storage.Storer = (*onDemandStorer)(nil)

func newOnDemandStorer(s storage.Storer) (*onDemandStorer, error) {
	// Track a small number of recent in-memory objects, to improve
	// performance without impacting memory too much.
	recentCache, err := lru.New(10)
	if err != nil {
		return nil, err
	}
	return &onDemandStorer{s, recentCache}, nil
}

func (ods *onDemandStorer) EncodedObject(
	ot plumbing.ObjectType, hash plumbing.Hash) (
	plumbing.EncodedObject, error) {
	o := &onDemandObject{
		s:           ods.Storer,
		hash:        hash,
		objType:     ot,
		size:        -1,
		recentCache: ods.recentCache,
	}

	return o, nil
}
