// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"os"

	lru "github.com/hashicorp/golang-lru"
	"gopkg.in/src-d/go-git.v4/plumbing"
)

type browserCacheEntryType int

const (
	_ browserCacheEntryType = iota
	fileInfoBrowserCacheEntry
	childrenPathsBrowserCacheEntry
)

type sharedInBrowserCache interface {
	setFileInfo(
		commitHash plumbing.Hash, entryPathRelativeToRepoRoot string,
		fi os.FileInfo)
	setChildrenPaths(
		commitHash plumbing.Hash, entryPathRelativeToRepoRoot string,
		childrenPathsRelativeToRepoRoot []string)
	getFileInfo(
		commitHash plumbing.Hash, entryPathRelativeToRepoRoot string) (
		fi os.FileInfo, ok bool)
	getChildrenFileInfos(
		commitHash plumbing.Hash, entryPathRelativeToRepoRoot string) (
		fis []os.FileInfo, ok bool)
}

type noopSharedInBrowserCache struct{}

func (noopSharedInBrowserCache) setFileInfo(
	plumbing.Hash, string, os.FileInfo) {
}
func (noopSharedInBrowserCache) setChildrenPaths(
	plumbing.Hash, string, []string) {
}
func (noopSharedInBrowserCache) getFileInfo(
	plumbing.Hash, string) (os.FileInfo, bool) {
	return nil, false
}
func (noopSharedInBrowserCache) getChildrenFileInfos(
	plumbing.Hash, string) ([]os.FileInfo, bool) {
	return nil, false
}

type gitBrowserCacheKey struct {
	commitHash   plumbing.Hash
	relativePath string // relative path
	entryType    browserCacheEntryType
}

type lruSharedInBrowserCache struct {
	cache *lru.Cache
}

const lruSharedInBrowserCacheSize = 1 << 16 // ~ 64 thousand entries

func newLRUSharedInBrowserCache() (lruSharedInBrowserCache, error) {
	cache, err := lru.New(lruSharedInBrowserCacheSize)
	if err != nil {
		return lruSharedInBrowserCache{}, err
	}
	return lruSharedInBrowserCache{cache: cache}, nil
}

func (c lruSharedInBrowserCache) setFileInfo(
	commitHash plumbing.Hash, entryPathRelativeToRepoRoot string,
	fi os.FileInfo) {
	c.cache.Add(
		gitBrowserCacheKey{
			commitHash:   commitHash,
			relativePath: entryPathRelativeToRepoRoot,
			entryType:    fileInfoBrowserCacheEntry,
		},
		fi,
	)
}

func (c lruSharedInBrowserCache) setChildrenPaths(
	commitHash plumbing.Hash, entryPathRelativeToRepoRoot string,
	childrenPathsRelativeToRepoRoot []string) {
	c.cache.Add(
		gitBrowserCacheKey{
			commitHash:   commitHash,
			relativePath: entryPathRelativeToRepoRoot,
			entryType:    childrenPathsBrowserCacheEntry,
		},
		childrenPathsRelativeToRepoRoot,
	)
}

func (c lruSharedInBrowserCache) getFileInfo(
	commitHash plumbing.Hash, entryPathRelativeToRepoRoot string) (
	fi os.FileInfo, ok bool) {
	entry, ok := c.cache.Get(
		gitBrowserCacheKey{
			commitHash:   commitHash,
			relativePath: entryPathRelativeToRepoRoot,
			entryType:    fileInfoBrowserCacheEntry,
		},
	)
	if !ok {
		return nil, false
	}
	if fi, ok = entry.(os.FileInfo); !ok {
		panic("rogue entry in lruSharedInBrowserCache")
	}
	return fi, true
}

func (c lruSharedInBrowserCache) getChildrenFileInfos(
	commitHash plumbing.Hash, entryPathRelativeToRepoRoot string) (
	fis []os.FileInfo, ok bool) {
	entry, ok := c.cache.Get(
		gitBrowserCacheKey{
			commitHash:   commitHash,
			relativePath: entryPathRelativeToRepoRoot,
			entryType:    childrenPathsBrowserCacheEntry,
		},
	)
	if !ok {
		return nil, false
	}
	var paths []string
	if paths, ok = entry.([]string); !ok {
		panic("rogue entry in lruSharedInBrowserCache")
	}
	for _, p := range paths {
		fi, ok := c.getFileInfo(commitHash, p)
		if !ok {
			return nil, false
		}
		fis = append(fis, fi)
	}
	return fis, true
}
