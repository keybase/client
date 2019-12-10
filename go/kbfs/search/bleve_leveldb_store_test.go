// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"testing"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestBleveLevelDBStore(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	config := libkbfs.MakeTestConfigOrBust(t, "user1", "user2")
	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), nil, "user1", tlf.Private)
	require.NoError(t, err)
	fs, err := libfs.NewFS(
		ctx, config, h, data.MasterBranch, "", "", keybase1.MDPriorityNormal)
	require.NoError(t, err)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	t.Log("Open a leveldb using a KBFS billy filesystem")
	s, err := newBleveLevelDBStore(fs, false)
	require.NoError(t, err)
	sNeedsClose := true
	defer func() {
		if sNeedsClose {
			err := s.Close()
			require.NoError(t, err)
		}
	}()

	t.Log("Put some stuff into the db")
	w, err := s.Writer()
	require.NoError(t, err)
	b := w.NewBatch()
	key1 := []byte("key1")
	val1 := []byte("val1")
	key2 := []byte("key2")
	val2 := []byte("val2")
	key3 := []byte("otherkey3")
	val3 := []byte("val3")
	b.Set(key1, val1)
	b.Set(key2, val2)
	b.Set(key3, val3)
	err = w.ExecuteBatch(b)
	require.NoError(t, err)

	t.Log("Close the db to release the lock")
	err = w.Close()
	require.NoError(t, err)
	err = s.Close()
	require.NoError(t, err)
	sNeedsClose = false

	t.Log("Read from another device")
	config2 := libkbfs.ConfigAsUser(config, "user1")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	fs2, err := libfs.NewFS(
		ctx, config2, h, data.MasterBranch, "", "", keybase1.MDPriorityNormal)
	require.NoError(t, err)
	s2, err := newBleveLevelDBStore(fs2, false)
	require.NoError(t, err)
	defer func() {
		err := s2.Close()
		require.NoError(t, err)
	}()
	r, err := s2.Reader()
	require.NoError(t, err)
	defer func() {
		err := r.Close()
		require.NoError(t, err)
	}()

	gotVal1, err := r.Get(key1)
	require.NoError(t, err)
	require.Equal(t, val1, gotVal1)
	gotVal2, err := r.Get(key2)
	require.NoError(t, err)
	require.Equal(t, val2, gotVal2)
	gotVal3, err := r.Get(key3)
	require.NoError(t, err)
	require.Equal(t, val3, gotVal3)

	t.Log("Check the iterator, should see two keys")
	i := r.PrefixIterator([]byte("k"))
	require.False(t, i.Valid()) // Next must be called before it's valid.
	i.Next()
	k1 := i.Key()
	require.Equal(t, key1, k1)
	v1 := i.Value()
	require.Equal(t, val1, v1)
	require.True(t, i.Valid())
	i.Next()
	k2 := i.Key()
	require.Equal(t, key2, k2)
	v2 := i.Value()
	require.Equal(t, val2, v2)
	require.True(t, i.Valid())
	i.Next()
	require.False(t, i.Valid())
}
