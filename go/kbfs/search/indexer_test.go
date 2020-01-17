// Copyright 2020 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"testing"
	"time"

	"github.com/blevesearch/bleve"
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/logger"
	"github.com/stretchr/testify/require"
)

func testInitConfig(
	ctx context.Context, config libkbfs.Config, session idutil.SessionInfo,
	log logger.Logger) (
	newCtx context.Context, newConfig libkbfs.Config,
	configShutdown func(context.Context) error, err error) {
	configLocal, ok := config.(*libkbfs.ConfigLocal)
	if !ok {
		panic(fmt.Sprintf("Wrong config type: %T", config))
	}

	newConfig = libkbfs.ConfigAsUserWithMode(
		configLocal, session.Name, libkbfs.InitSingleOp)

	kbCtx := config.KbContext()
	params, err := Params(kbCtx, config.StorageRoot(), session.UID)
	if err != nil {
		return nil, nil, nil, err
	}
	newConfig.(*libkbfs.ConfigLocal).SetStorageRoot(params.StorageRoot)

	// We use disk-based servers here, instead of memory-based ones
	// which would normally be preferrable in a test, because bleve
	// writes out a config file during kvstore-registration that needs
	// to persist across the multiple indexer instances that will be
	// made during the test (one on startup, and one when the user
	// login notification is triggered).  If we use mem-based storage,
	// the config file is lost when the first indexer instance is
	// destroyed, and bleve won't work after that.
	mdserver, err := libkbfs.MakeDiskMDServer(config, params.StorageRoot)
	if err != nil {
		return nil, nil, nil, err
	}
	newConfig.SetMDServer(mdserver)

	bserver := libkbfs.MakeDiskBlockServer(config, params.StorageRoot)
	newConfig.SetBlockServer(bserver)

	newCtx, err = libcontext.NewContextWithCancellationDelayer(
		libkbfs.CtxWithRandomIDReplayable(
			ctx, ctxIDKey, ctxOpID, newConfig.MakeLogger("")))
	if err != nil {
		return nil, nil, nil, err
	}

	return newCtx, newConfig, func(context.Context) error {
		mdserver.Shutdown()
		bserver.Shutdown(ctx)
		return nil
	}, nil
}

func writeFile(
	ctx context.Context, t *testing.T, kbfsOps libkbfs.KBFSOps, i *Indexer,
	rootNode, node libkbfs.Node, name, text string, newFile bool) {
	oldMD, err := kbfsOps.GetNodeMetadata(ctx, node)
	require.NoError(t, err)

	err = kbfsOps.Write(ctx, node, []byte(text), 0)
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)

	t.Log("Wait for index to load")
	err = i.waitForIndex(ctx)
	require.NoError(t, err)

	t.Log("Index the file")
	namePPS := data.NewPathPartString(name, nil)
	if newFile {
		ids, err := i.blocksDb.GetNextDocIDs(1)
		require.NoError(t, err)
		usedDocID, err := i.indexChild(ctx, rootNode, "", namePPS, ids[0], 1)
		require.NoError(t, err)
		require.True(t, usedDocID)
	} else {
		err := i.updateChild(
			ctx, rootNode, "", namePPS, oldMD.BlockInfo.BlockPointer, 1)
		require.NoError(t, err)
	}

	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)
}

func writeNewFile(
	ctx context.Context, t *testing.T, kbfsOps libkbfs.KBFSOps, i *Indexer,
	rootNode libkbfs.Node, name, text string) {
	t.Logf("Making file %s", name)
	namePPS := data.NewPathPartString(name, nil)
	n, _, err := kbfsOps.CreateFile(
		ctx, rootNode, namePPS, false, libkbfs.NoExcl)
	require.NoError(t, err)
	writeFile(ctx, t, kbfsOps, i, rootNode, n, name, text, true)
}

func TestIndexFile(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	config := libkbfs.MakeTestConfigOrBust(t, "user1", "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	tempdir, err := ioutil.TempDir("", "indexTest")
	require.NoError(t, err)
	defer os.RemoveAll(tempdir)
	config.SetStorageRoot(tempdir)

	i, err := newIndexerWithConfigInit(config, testInitConfig)
	require.NoError(t, err)
	defer func() {
		err := i.Shutdown(ctx)
		require.NoError(t, err)
	}()

	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), nil, "user1", tlf.Private)
	require.NoError(t, err)
	kbfsOps := config.KBFSOps()
	rootNode, _, err := kbfsOps.GetOrCreateRootNode(ctx, h, data.MasterBranch)
	require.NoError(t, err)
	const aText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit."
	const aName = "a"
	writeNewFile(ctx, t, kbfsOps, i, rootNode, aName, aText)
	const bHTML = "Mauris et <a href=neque>sit</a> amet nisi " +
		"<b>condimentum</b> fringilla vel non augue"
	writeNewFile(ctx, t, kbfsOps, i, rootNode, "b.html", bHTML)

	search := func(word string, expected int) {
		query := bleve.NewQueryStringQuery(word)
		request := bleve.NewSearchRequest(query)
		result, err := i.index.Search(request)
		require.NoError(t, err)
		require.Len(t, result.Hits, expected)
	}

	t.Log("Search for plaintext")
	search("dolor", 1)

	t.Log("Search for lower-case")
	search("lorem", 1)

	t.Log("Search for html")
	search("condimentum", 1)

	t.Log("Search for word in html tag, which shouldn't be indexed")
	search("neque", 0)

	t.Log("Search for shared word")
	search("sit", 2)

	t.Log("Re-index a file using the same docID")
	aNode, _, err := kbfsOps.Lookup(
		ctx, rootNode, data.NewPathPartString(aName, nil))
	require.NoError(t, err)
	const aNewText = "Ut feugiat dolor in tortor viverra, ac egestas justo " +
		"tincidunt."
	writeFile(ctx, t, kbfsOps, i, rootNode, aNode, aName, aNewText, false)

	t.Log("Search for old and new words")
	search("dolor", 1) // two hits in same doc
	search("tortor", 1)
}
