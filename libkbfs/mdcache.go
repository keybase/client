package libkbfs

import (
	lru "github.com/hashicorp/golang-lru"
)

type MDCacheStandard struct {
	lru *lru.Cache
}

func NewMDCacheStandard(capacity int) *MDCacheStandard {
	tmp, err := lru.New(capacity)
	if err != nil {
		return nil
	}
	return &MDCacheStandard{tmp}
}

func (md *MDCacheStandard) Get(id MDId) (*RootMetadata, error) {
	if tmp, ok := md.lru.Get(id); ok {
		if rmd, ok := tmp.(*RootMetadata); ok {
			return rmd, nil
		} else {
			return nil, &BadMDError{id}
		}
	}
	return nil, &NoSuchMDError{id}
}

func (md *MDCacheStandard) Put(id MDId, rmd *RootMetadata) error {
	md.lru.Add(id, rmd)
	return nil
}
