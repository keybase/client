// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"io"

	lru "github.com/hashicorp/golang-lru"
	"github.com/pkg/errors"
	"gopkg.in/src-d/go-git.v4/plumbing"
	"gopkg.in/src-d/go-git.v4/plumbing/storer"
)

type onDemandDeltaObject struct {
	s           storer.DeltaObjectStorer
	hash        plumbing.Hash
	typeSet     bool
	objType     plumbing.ObjectType
	sizeSet     bool
	size        int64
	baseHash    plumbing.Hash
	actualHash  plumbing.Hash
	actualSize  int64
	recentCache *lru.Cache
}

var _ plumbing.DeltaObject = (*onDemandDeltaObject)(nil)

type notDeltaError struct {
}

func (nde notDeltaError) Error() string {
	return "Not a delta object"
}

func (oddo *onDemandDeltaObject) cache() (o plumbing.DeltaObject, err error) {
	if tmp, ok := oddo.recentCache.Get(oddo.hash); ok {
		o, ok = tmp.(plumbing.DeltaObject)
		if !ok {
			return nil, notDeltaError{}
		}
	} else {
		eo, err := oddo.s.DeltaObject(oddo.objType, oddo.hash)
		if err != nil {
			return nil, err
		}
		oddo.recentCache.Add(oddo.hash, eo)
		o, ok = eo.(plumbing.DeltaObject)
		if !ok {
			return nil, notDeltaError{}
		}
	}

	if !oddo.sizeSet {
		oddo.size = o.Size()
	}
	if !oddo.typeSet {
		oddo.objType = o.Type()
	}
	oddo.baseHash = o.BaseHash()
	oddo.actualHash = o.ActualHash()
	oddo.actualSize = o.ActualSize()
	return o, nil
}

func (oddo *onDemandDeltaObject) cacheIfNeeded() error {
	if oddo.size >= 0 {
		return nil
	}
	// TODDO: We should be able to read the type and size from the
	// object's header, without loading the entire object itself.
	_, err := oddo.cache()
	return err
}

func (oddo *onDemandDeltaObject) Hash() plumbing.Hash {
	return oddo.hash
}

func (oddo *onDemandDeltaObject) Type() plumbing.ObjectType {
	_ = oddo.cacheIfNeeded()
	return oddo.objType
}

func (oddo *onDemandDeltaObject) SetType(ot plumbing.ObjectType) {
	oddo.typeSet = true
	oddo.objType = ot
}

func (oddo *onDemandDeltaObject) Size() int64 {
	_ = oddo.cacheIfNeeded()
	return oddo.size
}

func (oddo *onDemandDeltaObject) SetSize(s int64) {
	oddo.sizeSet = true
	oddo.size = s
}

func (oddo *onDemandDeltaObject) Reader() (io.ReadCloser, error) {
	// Create a new object to stream data from the storer on-demand,
	// without caching the bytes to long-lived memory.  Let the block
	// cache do its job to keep recent data in memory and control
	// total memory usage.
	o, err := oddo.cache()
	if err != nil {
		return nil, err
	}
	return o.Reader()
}

func (oddo *onDemandDeltaObject) Writer() (io.WriteCloser, error) {
	return nil, errors.New("onDemandDeltaObject shouldn't be used for writes")
}

func (oddo *onDemandDeltaObject) BaseHash() plumbing.Hash {
	_ = oddo.cacheIfNeeded()
	return oddo.baseHash
}

func (oddo *onDemandDeltaObject) ActualHash() plumbing.Hash {
	_ = oddo.cacheIfNeeded()
	return oddo.actualHash
}

func (oddo *onDemandDeltaObject) ActualSize() int64 {
	_ = oddo.cacheIfNeeded()
	return oddo.actualSize
}
