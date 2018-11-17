// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"io/ioutil"
	"os"
	"testing"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/stretchr/testify/require"
	ldberrors "github.com/syndtr/goleveldb/leveldb/errors"
)

type testDiskBlockMetadataStoreConfig struct {
	codec       kbfscodec.Codec
	log         logger.Logger
	storageRoot string
}

func (t *testDiskBlockMetadataStoreConfig) Codec() kbfscodec.Codec {
	return t.codec
}
func (t *testDiskBlockMetadataStoreConfig) MakeLogger(
	module string) logger.Logger {
	return t.log
}
func (t *testDiskBlockMetadataStoreConfig) StorageRoot() string {
	return t.storageRoot
}

func makeDiskBlockMetadataStoreForTest(t *testing.T) (
	diskBlockMetadataStore DiskBlockMetadataStore, tempdir string) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "xattr_test")
	config := testDiskBlockMetadataStoreConfig{
		codec:       kbfscodec.NewMsgpack(),
		log:         logger.NewTestLogger(t),
		storageRoot: tempdir,
	}
	s, err := newDiskBlockMetadataStore(&config)
	require.NoError(t, err)
	return s, tempdir
}

func shutdownDiskBlockMetadataStoreTest(
	diskBlockMetadataStore DiskBlockMetadataStore, tempdir string) {
	diskBlockMetadataStore.Shutdown()
	os.RemoveAll(tempdir)
}

func TestDiskXattr(t *testing.T) {
	t.Parallel()
	t.Log("Test creating disk Xattr storage")
	diskBlockMetadataStore, tempdir := makeDiskBlockMetadataStoreForTest(t)
	defer shutdownDiskBlockMetadataStoreTest(diskBlockMetadataStore, tempdir)

	ctx := context.Background()
	blockID := kbfsblock.FakeID(23)

	t.Log("Test getting non-existent xattr")
	v, err := diskBlockMetadataStore.GetXattr(
		ctx, blockID, XattrAppleQuarantine)
	require.Equal(t, ldberrors.ErrNotFound, err)

	value := []byte("rational irrationality")

	t.Log("Test setting xattr")
	err = diskBlockMetadataStore.SetXattr(
		ctx, blockID, XattrAppleQuarantine, value)
	require.NoError(t, err)

	t.Log("Test getting xattr")
	v, err = diskBlockMetadataStore.GetXattr(ctx, blockID, XattrAppleQuarantine)
	require.NoError(t, err)
	require.Equal(t, value, v)

}
