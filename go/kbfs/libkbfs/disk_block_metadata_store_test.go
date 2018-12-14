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
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	ldberrors "github.com/syndtr/goleveldb/leveldb/errors"
)

type testBlockMetadataStoreConfig struct {
	codec       kbfscodec.Codec
	log         logger.Logger
	storageRoot string
}

func (t *testBlockMetadataStoreConfig) Codec() kbfscodec.Codec {
	return t.codec
}
func (t *testBlockMetadataStoreConfig) MakeLogger(
	module string) logger.Logger {
	return t.log
}
func (t *testBlockMetadataStoreConfig) StorageRoot() string {
	return t.storageRoot
}

func makeBlockMetadataStoreForTest(t *testing.T) (
	blockMetadataStore BlockMetadataStore, tempdir string) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "xattr_test")
	config := testBlockMetadataStoreConfig{
		codec:       kbfscodec.NewMsgpack(),
		log:         logger.NewTestLogger(t),
		storageRoot: tempdir,
	}
	s, err := newDiskBlockMetadataStore(&config)
	require.NoError(t, err)
	return s, tempdir
}

func shutdownBlockMetadataStoreTest(
	blockMetadataStore BlockMetadataStore, tempdir string) {
	blockMetadataStore.Shutdown()
	os.RemoveAll(tempdir)
}

func TestDiskXattr(t *testing.T) {
	t.Parallel()
	t.Log("Test creating disk Xattr storage")
	blockMetadataStore, tempdir := makeBlockMetadataStoreForTest(t)
	defer shutdownBlockMetadataStoreTest(blockMetadataStore, tempdir)

	xattrStore := NewXattrStoreFromBlockMetadataStore(blockMetadataStore)

	ctx := context.Background()
	blockID := kbfsblock.FakeID(23)

	t.Log("Test getting non-existent xattr")
	v, err := xattrStore.GetXattr(
		ctx, blockID, XattrAppleQuarantine)
	require.Equal(t, ldberrors.ErrNotFound, errors.Cause(err))

	value := []byte("rational irrationality")

	t.Log("Test setting xattr")
	err = xattrStore.SetXattr(
		ctx, blockID, XattrAppleQuarantine, value)
	require.NoError(t, err)

	t.Log("Test getting xattr")
	v, err = xattrStore.GetXattr(ctx, blockID, XattrAppleQuarantine)
	require.NoError(t, err)
	require.Equal(t, value, v)

}
