// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"io/ioutil"
	"math/rand"
	"os"
	"path/filepath"
	"testing"

	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"github.com/syndtr/goleveldb/leveldb/storage"
	"golang.org/x/net/context"
)

type testDiskQuotaCacheConfig struct {
	codecGetter
	logMaker
}

func newDiskQuotaCacheLocalForTestWithStorage(
	t *testing.T, s storage.Storage) *DiskQuotaCacheLocal {
	cache, err := newDiskQuotaCacheLocalFromStorage(&testDiskQuotaCacheConfig{
		newTestCodecGetter(),
		newTestLogMaker(t),
	}, s, modeTest{modeDefault{}})
	require.NoError(t, err)
	err = cache.WaitUntilStarted()
	require.NoError(t, err)
	return cache
}

func newDiskQuotaCacheLocalForTest(t *testing.T) (
	*DiskQuotaCacheLocal, string) {
	// Use a disk-based level, instead of memory storage, because we
	// want to simulate a restart and memory storages can't be reused.
	tempdir, err := ioutil.TempDir(os.TempDir(), "disk_quota_cache")
	require.NoError(t, err)
	s, err := storage.OpenFile(filepath.Join(tempdir, "quota"), false)
	require.NoError(t, err)

	cache := newDiskQuotaCacheLocalForTestWithStorage(t, s)
	return cache, tempdir
}

func shutdownDiskQuotaCacheTest(cache DiskQuotaCache, tempdir string) {
	cache.Shutdown(context.Background())
	os.RemoveAll(tempdir)
}

func makeRandomQuotaWithUsageWrite(t *testing.T) kbfsblock.QuotaInfo {
	qi := kbfsblock.NewQuotaInfo()
	qi.Total.Bytes[kbfsblock.UsageWrite] = rand.Int63()
	return *qi
}

func TestDiskQuotaCacheCommitAndGet(t *testing.T) {
	t.Parallel()
	t.Log("Test that basic quota cache Put and Get operations work.")
	cache, tempdir := newDiskQuotaCacheLocalForTest(t)
	defer func() {
		shutdownDiskQuotaCacheTest(cache, tempdir)
	}()

	ctx := context.Background()
	id1 := keybase1.MakeTestUID(1).AsUserOrTeam()
	qi1 := makeRandomQuotaWithUsageWrite(t)

	t.Log("Put a quota into the cache.")
	_, err := cache.Get(ctx, id1)
	require.Error(t, err) // not cached yet
	err = cache.Put(ctx, id1, qi1)
	require.NoError(t, err)
	status := cache.Status(ctx)
	require.Equal(t, uint64(1), status.NumQuotas)

	t.Log("Get a quota from the cache.")
	getQI1, err := cache.Get(ctx, id1)
	require.NoError(t, err)
	checkWrite := func(a, b kbfsblock.QuotaInfo) {
		require.Equal(
			t, a.Total.Bytes[kbfsblock.UsageWrite],
			b.Total.Bytes[kbfsblock.UsageWrite])
	}
	checkWrite(qi1, getQI1)

	t.Log("Check the meters.")
	status = cache.Status(ctx)
	require.Equal(t, int64(1), status.Hits.Count)
	require.Equal(t, int64(1), status.Misses.Count)
	require.Equal(t, int64(1), status.Puts.Count)

	t.Log("A second entry.")
	id2 := keybase1.MakeTestTeamID(2, false).AsUserOrTeam()
	qi2 := makeRandomQuotaWithUsageWrite(t)
	err = cache.Put(ctx, id2, qi2)
	require.NoError(t, err)
	getQI2, err := cache.Get(ctx, id2)
	require.NoError(t, err)
	checkWrite(qi2, getQI2)

	t.Log("Override the first user.")
	qi3 := makeRandomQuotaWithUsageWrite(t)
	err = cache.Put(ctx, id1, qi3)
	require.NoError(t, err)
	getQI3, err := cache.Get(ctx, id1)
	require.NoError(t, err)
	checkWrite(qi3, getQI3)

	t.Log("Restart the cache and check the stats")
	cache.Shutdown(ctx)
	s, err := storage.OpenFile(filepath.Join(tempdir, "quota"), false)
	require.NoError(t, err)
	cache = newDiskQuotaCacheLocalForTestWithStorage(t, s)
	status = cache.Status(ctx)
	require.Equal(t, uint64(2), status.NumQuotas)
	getQI3, err = cache.Get(ctx, id1)
	require.NoError(t, err)
	checkWrite(qi3, getQI3)
	getQI2, err = cache.Get(ctx, id2)
	require.NoError(t, err)
	checkWrite(qi2, getQI2)
}
