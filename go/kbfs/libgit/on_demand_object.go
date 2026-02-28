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

type onDemandObject struct {
	s           storer.EncodedObjectStorer
	hash        plumbing.Hash
	typeSet     bool
	objType     plumbing.ObjectType
	sizeSet     bool
	size        int64
	recentCache *lru.Cache
}

var _ plumbing.EncodedObject = (*onDemandObject)(nil)

func (odo *onDemandObject) cache() (o plumbing.EncodedObject, err error) {
	if tmp, ok := odo.recentCache.Get(odo.hash); ok {
		o = tmp.(plumbing.EncodedObject)
	} else {
		o, err = odo.s.EncodedObject(odo.objType, odo.hash)
		if err != nil {
			return nil, err
		}
		odo.recentCache.Add(odo.hash, o)
	}

	if !odo.sizeSet {
		odo.size = o.Size()
	}
	if !odo.typeSet {
		odo.objType = o.Type()
	}
	return o, nil
}

func (odo *onDemandObject) cacheIfNeeded() error {
	if odo.size >= 0 {
		return nil
	}
	// TODO: We should be able to read the type and size from the
	// object's header, without loading the entire object itself.
	_, err := odo.cache()
	return err
}

func (odo *onDemandObject) Hash() plumbing.Hash {
	return odo.hash
}

func (odo *onDemandObject) Type() plumbing.ObjectType {
	_ = odo.cacheIfNeeded()
	return odo.objType
}

func (odo *onDemandObject) SetType(ot plumbing.ObjectType) {
	odo.typeSet = true
	odo.objType = ot
}

func (odo *onDemandObject) Size() int64 {
	_ = odo.cacheIfNeeded()
	return odo.size
}

func (odo *onDemandObject) SetSize(s int64) {
	odo.sizeSet = true
	odo.size = s
}

func (odo *onDemandObject) Reader() (io.ReadCloser, error) {
	// Create a new object to stream data from the storer on-demand,
	// without caching the bytes to long-lived memory.  Let the block
	// cache do its job to keep recent data in memory and control
	// total memory usage.
	o, err := odo.cache()
	if err != nil {
		return nil, err
	}
	return o.Reader()
}

func (odo *onDemandObject) Writer() (io.WriteCloser, error) {
	return nil, errors.New("onDemandObject shouldn't be used for writes")
}
