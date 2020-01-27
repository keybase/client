// Copyright 2020 Keybase Inc. All rights reserved.
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

func TestDocDb(t *testing.T) {
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
	db, err := newDocDb(config, fs)
	require.NoError(t, err)
	dbNeedsShutdown := true
	defer func() {
		if dbNeedsShutdown {
			db.Shutdown(ctx)
		}
	}()

	t.Log("Put some stuff into the db")
	d1 := "1"
	n1 := "a"
	d2 := "2"
	n2 := "b"
	d3 := "3"
	n3 := "b"
	err = db.Put(ctx, d1, "", n1)
	require.NoError(t, err)
	err = db.Put(ctx, d2, d1, n2)
	require.NoError(t, err)
	err = db.Put(ctx, d3, d1, n3)
	require.NoError(t, err)

	t.Log("Close the db to release the lock")
	db.Shutdown(ctx)
	dbNeedsShutdown = false

	t.Log("Read from another device")
	config2 := libkbfs.ConfigAsUser(config, "user1")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	fs2, err := libfs.NewFS(
		ctx, config2, h, data.MasterBranch, "", "", keybase1.MDPriorityNormal)
	require.NoError(t, err)
	db2, err := newDocDb(config, fs2)
	require.NoError(t, err)
	defer db2.Shutdown(ctx)

	gotP1, gotN1, err := db2.Get(ctx, d1)
	require.NoError(t, err)
	require.Equal(t, "", gotP1)
	require.Equal(t, n1, gotN1)
	gotP2, gotN2, err := db2.Get(ctx, d2)
	require.NoError(t, err)
	require.Equal(t, d1, gotP2)
	require.Equal(t, n2, gotN2)
	gotP3, gotN3, err := db2.Get(ctx, d3)
	require.NoError(t, err)
	require.Equal(t, d1, gotP3)
	require.Equal(t, n3, gotN3)
}
