// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"bytes"
	"crypto/rand"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
	"github.com/syndtr/goleveldb/leveldb/storage"
	"golang.org/x/net/context"
)

type testDiskMDCacheConfig struct {
	codecGetter
	logMaker
}

func newDiskMDCacheLocalForTestWithStorage(
	t *testing.T, s storage.Storage) *DiskMDCacheLocal {
	cache, err := newDiskMDCacheLocalFromStorage(&testDiskMDCacheConfig{
		newTestCodecGetter(),
		newTestLogMaker(t),
	}, s)
	if err != nil {
		fmt.Println(err.Error())
	}
	require.NoError(t, err)
	err = cache.WaitUntilStarted()
	require.NoError(t, err)
	return cache
}

func newDiskMDCacheLocalForTest(t *testing.T) (*DiskMDCacheLocal, string) {
	// Use a disk-based level, instead of memory storage, because we
	// want to simulate a restart and memory storages can't be reused.
	tempdir, err := ioutil.TempDir(os.TempDir(), "disk_md_cache")
	require.NoError(t, err)
	s, err := storage.OpenFile(filepath.Join(tempdir, "heads"), false)
	require.NoError(t, err)

	cache := newDiskMDCacheLocalForTestWithStorage(t, s)
	return cache, tempdir
}

func shutdownDiskMDCacheTest(cache DiskMDCache, tempdir string) {
	cache.Shutdown(context.Background())
	os.RemoveAll(tempdir)
}

func makeRandomMDBuf(t *testing.T) []byte {
	b := make([]byte, 10)
	_, err := rand.Read(b)
	require.NoError(t, err)
	return b
}

func TestDiskMDCacheCommitAndGet(t *testing.T) {
	t.Parallel()
	t.Log("Test that basic MD cache Put and Get operations work.")
	cache, tempdir := newDiskMDCacheLocalForTest(t)
	defer func() {
		shutdownDiskMDCacheTest(cache, tempdir)
	}()
	clock := newTestClockNow()

	tlf1 := tlf.FakeID(0, tlf.Private)
	ctx := context.Background()

	buf := makeRandomMDBuf(t)
	now := clock.Now()
	rev := kbfsmd.Revision(1)

	t.Log("Put an MD into the cache.")
	err := cache.Stage(ctx, tlf1, rev, buf, kbfsmd.ImplicitTeamsVer, now)
	require.NoError(t, err)
	_, _, _, err = cache.Get(ctx, tlf1)
	require.Error(t, err) // not commited yet
	status := cache.Status(ctx)
	require.Equal(t, uint64(0), status.NumMDs)
	require.Equal(t, uint64(1), status.NumStaged)
	err = cache.Commit(ctx, tlf1, rev)
	require.NoError(t, err)
	status = cache.Status(ctx)
	require.Equal(t, uint64(1), status.NumMDs)
	require.Equal(t, uint64(0), status.NumStaged)

	t.Log("Get an MD from the cache.")
	clock.Add(1 * time.Minute)
	getBuf, getVer, getTime, err := cache.Get(ctx, tlf1)
	require.NoError(t, err)
	require.True(t, bytes.Equal(buf, getBuf))
	require.Equal(t, kbfsmd.ImplicitTeamsVer, getVer)
	require.True(t, now.Equal(getTime))

	t.Log("Check the meters.")
	status = cache.Status(ctx)
	require.Equal(t, int64(1), status.Hits.Count)
	require.Equal(t, int64(1), status.Misses.Count)
	require.Equal(t, int64(1), status.Puts.Count)

	t.Log("A second TLF")
	tlf2 := tlf.FakeID(0, tlf.Public)
	now2 := clock.Now()
	buf2 := makeRandomMDBuf(t)
	err = cache.Stage(ctx, tlf2, rev, buf2, kbfsmd.ImplicitTeamsVer, now2)
	require.NoError(t, err)
	err = cache.Commit(ctx, tlf2, rev)
	require.NoError(t, err)
	getBuf2, getVer2, getTime2, err := cache.Get(ctx, tlf2)
	require.NoError(t, err)
	require.True(t, bytes.Equal(buf2, getBuf2))
	require.Equal(t, kbfsmd.ImplicitTeamsVer, getVer2)
	require.True(t, now2.Equal(getTime2))

	t.Log("Override the first TLF")
	now3 := clock.Now()
	buf3 := makeRandomMDBuf(t)
	err = cache.Stage(ctx, tlf1, rev, buf3, kbfsmd.ImplicitTeamsVer, now3)
	require.NoError(t, err)
	err = cache.Commit(ctx, tlf1, rev)
	require.NoError(t, err)
	getBuf3, getVer3, getTime3, err := cache.Get(ctx, tlf1)
	require.NoError(t, err)
	require.True(t, bytes.Equal(buf3, getBuf3))
	require.Equal(t, kbfsmd.ImplicitTeamsVer, getVer3)
	require.True(t, now2.Equal(getTime3))

	t.Log("Restart the cache and check the stats")
	cache.Shutdown(ctx)
	s, err := storage.OpenFile(filepath.Join(tempdir, "heads"), false)
	require.NoError(t, err)
	cache = newDiskMDCacheLocalForTestWithStorage(t, s)
	status = cache.Status(ctx)
	require.Equal(t, uint64(2), status.NumMDs)
	require.Equal(t, uint64(0), status.NumStaged)
}
