// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libquarantine

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

type testXattrStorageConfig struct {
	codec       kbfscodec.Codec
	log         logger.Logger
	storageRoot string
}

func (t *testXattrStorageConfig) Codec() kbfscodec.Codec {
	return t.codec
}
func (t *testXattrStorageConfig) MakeLogger(module string) logger.Logger {
	return t.log
}
func (t *testXattrStorageConfig) StorageRoot() string {
	return t.storageRoot
}

func makeXattrStorageForTest(t *testing.T) (xattrStorage XattrStorage, tempdir string) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "xattr_test")
	config := testXattrStorageConfig{
		codec:       kbfscodec.NewMsgpack(),
		log:         logger.NewTestLogger(t),
		storageRoot: tempdir,
	}
	s, err := NewDiskXattrStorage(&config)
	require.NoError(t, err)
	return s, tempdir
}

func shutdownXattrStorageTest(xattrStorage XattrStorage, tempdir string) {
	xattrStorage.Shutdown()
	os.RemoveAll(tempdir)
}

func TestDiskXattr(t *testing.T) {
	t.Parallel()
	t.Log("Test creating disk Xattr storage")
	xattrStorage, tempdir := makeXattrStorageForTest(t)
	defer shutdownXattrStorageTest(xattrStorage, tempdir)

	ctx := context.Background()
	blockID := kbfsblock.FakeID(23)

	t.Log("Test getting non-existent xattr")
	v, err := xattrStorage.Get(ctx, blockID, XattrAppleQuarantine)
	require.Equal(t, ldberrors.ErrNotFound, err)

	value := []byte("rational irrationality")

	t.Log("Test setting xattr")
	err = xattrStorage.Set(ctx, blockID, XattrAppleQuarantine, value)
	require.NoError(t, err)

	t.Log("Test getting xattr")
	v, err = xattrStorage.Get(ctx, blockID, XattrAppleQuarantine)
	require.NoError(t, err)
	require.Equal(t, value, v)

}
