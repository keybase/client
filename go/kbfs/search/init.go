// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"context"
	"path/filepath"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
)

const (
	indexStorageDir    = "kbfs_index"
	bleveIndexDir      = "bleve"
	bserverStorageDir  = "bserver"
	mdserverStorageDir = "mdserver"

	currentIndexVersion = "v1"

	indexBlocksInCache = 100
)

// Params returns a set of default parameters for search-related
// operations.
func Params(kbCtx libkbfs.Context, storageRoot string, uid keybase1.UID) (
	params libkbfs.InitParams, err error) {
	params = libkbfs.DefaultInitParams(kbCtx)
	params.Debug = true
	params.LogToFile = true

	params.EnableJournal = false
	params.DiskCacheMode = libkbfs.DiskCacheModeOff

	// Try to balance not using too much memory vs. the time/CPU it
	// takes to keep pulling in index blocks from the disk.
	params.CleanBlockCacheCapacity =
		uint64(data.MaxBlockSizeBytesDefault) * indexBlocksInCache

	// Make a per-user index for all the TLFs indexed locally by that
	// user.  This means on one hand that the user can get
	// high-quality, ranked search results across all TLFs, all
	// encrypted just for that user; on the other hand, different
	// users with access to the same synced TLFs will have to re-index
	// them.
	params.StorageRoot = filepath.Join(
		storageRoot, indexStorageDir, currentIndexVersion, uid.String())

	params.BServerAddr = "dir:" + filepath.Join(
		params.StorageRoot, bserverStorageDir)
	params.MDServerAddr = "dir:" + filepath.Join(
		params.StorageRoot, mdserverStorageDir)
	params.Mode = libkbfs.InitSingleOpWithQRString

	return params, nil
}

// Init initializes a context and a libkbfs.Config for search
// operations.  The config should be shutdown when it is done being
// used.
func Init(ctx context.Context, kbCtx libkbfs.Context, params libkbfs.InitParams,
	keybaseServiceCn libkbfs.KeybaseServiceCn,
	log logger.Logger, vlogLevel string) (
	context.Context, libkbfs.Config, error) {
	ctx, err := libcontext.NewContextWithCancellationDelayer(
		libcontext.NewContextReplayable(
			ctx, func(ctx context.Context) context.Context {
				return ctx
			}))
	if err != nil {
		return ctx, nil, err
	}

	config, err := libkbfs.InitWithLogPrefix(
		ctx, kbCtx, params, keybaseServiceCn, nil, log, "search")
	if err != nil {
		return ctx, nil, err
	}
	config.SetVLogLevel(vlogLevel)

	return ctx, config, nil
}
