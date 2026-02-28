// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"testing"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"github.com/syndtr/goleveldb/leveldb"
)

func TestLevelDBWithFS(t *testing.T) {
	ctx, _, fs := makeFS(t, "")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, fs.config)

	t.Log("Open a leveldb using a KBFS billy filesystem")
	s, err := OpenLevelDBStorage(fs, false)
	require.NoError(t, err)
	sNeedsClose := true
	defer func() {
		if sNeedsClose {
			err := s.Close()
			require.NoError(t, err)
		}
	}()
	db, err := leveldb.Open(s, nil)
	require.NoError(t, err)
	dbNeedsClose := true
	defer func() {
		if dbNeedsClose {
			err := db.Close()
			require.NoError(t, err)
		}
	}()

	t.Log("Put some stuff into the db")
	key1 := []byte("key1")
	val1 := []byte("val1")
	key2 := []byte("key2")
	val2 := []byte("val2")
	err = db.Put(key1, val1, nil)
	require.NoError(t, err)
	err = db.Put(key2, val2, nil)
	require.NoError(t, err)

	t.Log("Close the db to release the lock")
	err = db.Close()
	require.NoError(t, err)
	dbNeedsClose = false
	err = s.Close()
	require.NoError(t, err)
	sNeedsClose = false

	t.Log("Read from another device")
	config2 := libkbfs.ConfigAsUser(fs.config.(*libkbfs.ConfigLocal), "user1")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	h, err := tlfhandle.ParseHandle(
		ctx, config2.KBPKI(), config2.MDOps(), nil, "user1", tlf.Private)
	require.NoError(t, err)
	fs2, err := NewFS(
		ctx, config2, h, data.MasterBranch, "", "", keybase1.MDPriorityNormal)
	require.NoError(t, err)
	s2, err := OpenLevelDBStorage(fs2, false)
	require.NoError(t, err)
	defer func() {
		err := s2.Close()
		require.NoError(t, err)
	}()
	db2, err := leveldb.Open(s2, nil)
	require.NoError(t, err)
	defer func() {
		err := db2.Close()
		require.NoError(t, err)
	}()

	gotVal1, err := db2.Get(key1, nil)
	require.NoError(t, err)
	require.Equal(t, val1, gotVal1)
	gotVal2, err := db2.Get(key2, nil)
	require.NoError(t, err)
	require.Equal(t, val2, gotVal2)
}
