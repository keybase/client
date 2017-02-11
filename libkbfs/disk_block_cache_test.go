// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"testing"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
	"github.com/syndtr/goleveldb/leveldb/storage"
)

const (
	testDiskBlockCacheMaxBytes uint64 = 1 << 20
)

type testDiskBlockCacheConfig struct {
	codec kbfscodec.Codec
	log   logger.Logger
}

func newTestDiskBlockCacheConfig(t *testing.T) testDiskBlockCacheConfig {
	return testDiskBlockCacheConfig{
		codec: kbfscodec.NewMsgpack(),
		log:   logger.NewTestLogger(t),
	}
}

func (c testDiskBlockCacheConfig) Codec() kbfscodec.Codec {
	return c.codec
}

func (c testDiskBlockCacheConfig) MakeLogger(_ string) logger.Logger {
	return c.log
}

func newDiskBlockCacheStandardForTest(config diskBlockCacheConfig,
	maxBytes uint64) (*DiskBlockCacheStandard, error) {
	blockStorage := storage.NewMemStorage()
	lruStorage := storage.NewMemStorage()
	return newDiskBlockCacheStandardFromStorage(config, blockStorage,
		lruStorage, maxBytes)
}

func initDiskBlockCacheTest(t *testing.T) (DiskBlockCache,
	testDiskBlockCacheConfig) {
	config := newTestDiskBlockCacheConfig(t)
	cache, err := newDiskBlockCacheStandardForTest(config,
		testDiskBlockCacheMaxBytes)
	require.NoError(t, err)
	return cache, config
}

func shutdownDiskBlockCacheTest(cache DiskBlockCache) {
	cache.Shutdown()
}

func TestDiskBlockCachePutAndGet(t *testing.T) {
	cache, config := initDiskBlockCacheTest(t)
	defer shutdownDiskBlockCacheTest(cache)

	tlf1 := tlf.FakeID(0, false)
	ptr1 := makeRandomBlockPointer(t)
	block1 := makeFakeFileBlock(t, false)
	block1Encoded, err := config.Codec().Encode(block1)
	require.NoError(t, err)
	block1ServerHalf, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)

	ctx := context.Background()

	t.Log("Put a block into the cache.")
	err = cache.Put(ctx, tlf1, ptr1.ID, block1Encoded, block1ServerHalf)
	require.NoError(t, err)

	t.Log("Get that block from the cache. Verify that it's the same.")
	buf, serverHalf, err := cache.Get(ctx, tlf1, ptr1.ID)
	require.NoError(t, err)
	require.Equal(t, block1ServerHalf, serverHalf)
	require.Equal(t, block1Encoded, buf)

	t.Log("Attempt to Get a block from the cache that isn't there." +
		" Verify that it fails.")
	ptr2 := makeRandomBlockPointer(t)
	buf, serverHalf, err = cache.Get(ctx, tlf1, ptr2.ID)
	require.EqualError(t, err, NoSuchBlockError{ptr2.ID}.Error())
	require.Equal(t, kbfscrypto.BlockCryptKeyServerHalf{}, serverHalf)
	require.Nil(t, buf)
}
