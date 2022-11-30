// Copyright 2020 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"context"
	"errors"
	"fmt"

	"os"
	"path"
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
	"github.com/keybase/client/go/protocol/keybase1"
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
	err = i.refreshBatch(ctx)
	require.NoError(t, err)
	if newFile {
		ids, err := i.blocksDb.GetNextDocIDs(1)
		require.NoError(t, err)
		dirDoneFn, err := i.indexChild(ctx, rootNode, "", namePPS, ids[0], 1)
		require.NoError(t, err)
		require.NotNil(t, dirDoneFn)
	} else {
		dirDoneFn, err := i.updateChild(
			ctx, rootNode, "", namePPS, oldMD.BlockInfo.BlockPointer, 1)
		require.NoError(t, err)
		require.NotNil(t, dirDoneFn)
	}
	err = i.flushBatch(ctx)
	require.NoError(t, err)

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

func testSearch(t *testing.T, i *Indexer, word string, expected int) {
	query := bleve.NewQueryStringQuery(word)
	request := bleve.NewSearchRequest(query)
	result, err := i.index.Search(request)
	require.NoError(t, err)
	require.Len(t, result.Hits, expected)
}

func testKVStoreName(testName string) string {
	return fmt.Sprintf(
		"%s_%s_%d", kvstoreNamePrefix, testName, time.Now().UnixNano())
}

func TestIndexFile(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	config := libkbfs.MakeTestConfigOrBust(t, "user1", "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	tempdir, err := os.MkdirTemp("", "indexTest")
	require.NoError(t, err)
	defer os.RemoveAll(tempdir)
	config.SetStorageRoot(tempdir)

	i, err := newIndexerWithConfigInit(
		config, testInitConfig, testKVStoreName("TestIndexFile"))
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

	t.Log("Search for plaintext")
	testSearch(t, i, "dolor", 1)

	t.Log("Search for lower-case")
	testSearch(t, i, "lorem", 1)

	t.Log("Search for html")
	testSearch(t, i, "condimentum", 1)

	t.Log("Search for word in html tag, which shouldn't be indexed")
	testSearch(t, i, "neque", 0)

	t.Log("Search for shared word")
	testSearch(t, i, "sit", 2)

	t.Log("Re-index a file using the same docID")
	aNamePPS := data.NewPathPartString(aName, nil)
	aNode, _, err := kbfsOps.Lookup(ctx, rootNode, aNamePPS)
	require.NoError(t, err)
	const aNewText = "Ut feugiat dolor in tortor viverra, ac egestas justo " +
		"tincidunt."
	writeFile(ctx, t, kbfsOps, i, rootNode, aNode, aName, aNewText, false)

	t.Log("Search for old and new words")
	testSearch(t, i, "dolor", 1) // two hits in same doc
	testSearch(t, i, "tortor", 1)

	t.Log("Add a hit in a filename")
	const dText = "Cras volutpat mi in purus interdum, sit amet luctus " +
		"velit accumsan."
	const dName = "dolor.txt"
	writeNewFile(ctx, t, kbfsOps, i, rootNode, dName, dText)
	testSearch(t, i, "dolor", 2)

	t.Log("Rename the file")
	const newDName = "neque.txt"
	newDNamePPS := data.NewPathPartString(newDName, nil)
	err = kbfsOps.Rename(
		ctx, rootNode, data.NewPathPartString(dName, nil), rootNode,
		newDNamePPS)
	require.NoError(t, err)
	err = i.refreshBatch(ctx)
	require.NoError(t, err)
	err = i.renameChild(ctx, rootNode, "", newDNamePPS, 1)
	require.NoError(t, err)
	err = i.flushBatch(ctx)
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)
	testSearch(t, i, "dolor", 1)
	testSearch(t, i, "neque", 1)

	t.Log("Delete a file")
	md, err := kbfsOps.GetNodeMetadata(ctx, aNode)
	require.NoError(t, err)
	err = kbfsOps.RemoveEntry(ctx, rootNode, aNamePPS)
	require.NoError(t, err)
	err = i.refreshBatch(ctx)
	require.NoError(t, err)
	err = i.deleteFromUnrefs(
		ctx, rootNode.GetFolderBranch().Tlf,
		[]data.BlockPointer{md.BlockInfo.BlockPointer})
	require.NoError(t, err)
	err = i.flushBatch(ctx)
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)
	testSearch(t, i, "tortor", 0)
}

func makeSingleDirTreeToIndex(
	ctx context.Context, t *testing.T, kbfsOps libkbfs.KBFSOps,
	rootNode libkbfs.Node, dirName, text1, text2 string) {
	dirNamePPS := data.NewPathPartString(dirName, nil)
	dirNode, _, err := kbfsOps.CreateDir(ctx, rootNode, dirNamePPS)
	require.NoError(t, err)
	f1Name := dirName + "_file1"
	f1NamePPS := data.NewPathPartString(f1Name, nil)
	f1Node, _, err := kbfsOps.CreateFile(
		ctx, dirNode, f1NamePPS, false, libkbfs.NoExcl)
	require.NoError(t, err)
	err = kbfsOps.Write(ctx, f1Node, []byte(text1), 0)
	require.NoError(t, err)
	f2Name := dirName + "_file2"
	f2NamePPS := data.NewPathPartString(f2Name, nil)
	f2Node, _, err := kbfsOps.CreateFile(
		ctx, dirNode, f2NamePPS, false, libkbfs.NoExcl)
	require.NoError(t, err)
	err = kbfsOps.Write(ctx, f2Node, []byte(text2), 0)
	require.NoError(t, err)
}

func makeDirTreesToIndex(
	ctx context.Context, t *testing.T, kbfsOps libkbfs.KBFSOps,
	rootNode libkbfs.Node) (names []string) {
	aName := "alpha"
	const a1Text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit."
	const a2Text = "Mauris et neque sit amet nisi condimentum fringilla " +
		"vel non augue"
	makeSingleDirTreeToIndex(ctx, t, kbfsOps, rootNode, aName, a1Text, a2Text)

	bName := "beta"
	const b1Text = "Ut feugiat dolor in tortor viverra, ac egestas justo " +
		"tincidunt."
	const b2Text = "Cras volutpat mi in purus interdum, sit amet luctus " +
		"velit accumsan."
	makeSingleDirTreeToIndex(ctx, t, kbfsOps, rootNode, bName, b1Text, b2Text)
	err := kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)
	return []string{aName, bName}
}

func TestFullIndexSyncedTlf(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	config := libkbfs.MakeTestConfigOrBust(t, "user1", "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	tempdir, err := os.MkdirTemp("", "indexTest")
	require.NoError(t, err)
	defer os.RemoveAll(tempdir)
	config.SetStorageRoot(tempdir)

	err = config.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	config.SetDiskCacheMode(libkbfs.DiskCacheModeLocal)
	err = config.MakeDiskBlockCacheIfNotExists()
	require.NoError(t, err)
	err = config.MakeDiskMDCacheIfNotExists()
	require.NoError(t, err)

	i, err := newIndexerWithConfigInit(
		config, testInitConfig, testKVStoreName("TestFullIndexSyncedTlf"))
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

	t.Log("Create two dirs with two files each")
	names := makeDirTreesToIndex(ctx, t, kbfsOps, rootNode)

	t.Log("Wait for index to load")
	err = i.waitForIndex(ctx)
	require.NoError(t, err)

	ch := make(chan error)
	i.fullIndexCB = func() error {
		select {
		case err := <-ch:
			return err
		case <-ctx.Done():
			return ctx.Err()
		}
	}

	t.Log("Enable syncing")
	_, err = kbfsOps.SetSyncConfig(
		ctx, rootNode.GetFolderBranch().Tlf, keybase1.FolderSyncConfig{
			Mode: keybase1.FolderSyncMode_ENABLED,
		})
	require.NoError(t, err)
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)

	t.Log("Index the root node and first full dir, but fail the first child " +
		"of the second dir")
	sendToIndexer := func(err error) {
		select {
		case ch <- err:
		case <-ctx.Done():
		}
	}
	sendToIndexer(nil) // alpha
	sendToIndexer(nil) // alpha1
	sendToIndexer(nil) // alpha2
	sendToIndexer(nil) // beta
	err = errors.New("STOP")
	sendToIndexer(err)

	err = i.waitForSyncs(ctx)
	require.NoError(t, err)

	t.Log("New write will resume the interrupted indexer -- 2 children left " +
		"to index on the old view, then 3 on the new view")

	oName := "omega"
	const o1Text = "Sed ullamcorper consectetur velit eget dapibus."
	const o2Text = "Praesent feugiat feugiat dui, at egestas lacus pretium vel."
	makeSingleDirTreeToIndex(ctx, t, kbfsOps, rootNode, oName, o1Text, o2Text)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)

	sendToIndexer(nil) // alpha (already done)
	sendToIndexer(nil) // beta (name indexed, but dir not done yet)
	sendToIndexer(nil) // beta1
	sendToIndexer(nil) // beta2
	// Incremental update.
	sendToIndexer(nil) // omega
	sendToIndexer(nil) // omega1
	sendToIndexer(nil) // omega2

	err = i.waitForSyncs(ctx)
	require.NoError(t, err)

	t.Log("Check searches")
	testSearch(t, i, "dolor", 2)
	testSearch(t, i, "feugiat", 2)
	testSearch(t, i, names[0], 3) // Child nodes have "alpha" in their name too
	testSearch(t, i, "file1", 3)
	testSearch(t, i, "omega", 3)
	testSearch(t, i, "ullamcorper", 1)

	t.Log("Test a rename and a delete")
	newName := "gamma"
	newNamePPS := data.NewPathPartString(newName, nil)
	err = kbfsOps.Rename(
		ctx, rootNode, data.NewPathPartString(names[0], nil), rootNode,
		newNamePPS)
	require.NoError(t, err)
	dirNode, _, err := kbfsOps.Lookup(ctx, rootNode, newNamePPS)
	require.NoError(t, err)
	err = kbfsOps.RemoveEntry(
		ctx, dirNode, data.NewPathPartString(names[0]+"_file1", nil))
	require.NoError(t, err)
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)

	sendToIndexer(nil) // gamma dir update

	err = i.waitForSyncs(ctx)
	require.NoError(t, err)

	t.Log("Check searches")
	testSearch(t, i, "dolor", 1)
	testSearch(t, i, names[0], 1)
	testSearch(t, i, newName, 1)
}

func TestFullIndexSearch(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	config := libkbfs.MakeTestConfigOrBust(t, "user1", "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	tempdir, err := os.MkdirTemp("", "indexTest")
	require.NoError(t, err)
	defer os.RemoveAll(tempdir)
	config.SetStorageRoot(tempdir)

	err = config.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	config.SetDiskCacheMode(libkbfs.DiskCacheModeLocal)
	err = config.MakeDiskBlockCacheIfNotExists()
	require.NoError(t, err)
	err = config.MakeDiskMDCacheIfNotExists()
	require.NoError(t, err)

	i, err := newIndexerWithConfigInit(
		config, testInitConfig, testKVStoreName("TestFullIndexSyncedTlf"))
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

	t.Log("Create two dirs with two files each")
	names := makeDirTreesToIndex(ctx, t, kbfsOps, rootNode)

	t.Log("Wait for index to load")
	err = i.waitForIndex(ctx)
	require.NoError(t, err)

	t.Log("Enable syncing")
	_, err = kbfsOps.SetSyncConfig(
		ctx, rootNode.GetFolderBranch().Tlf, keybase1.FolderSyncConfig{
			Mode: keybase1.FolderSyncMode_ENABLED,
		})
	require.NoError(t, err)
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)

	err = i.waitForSyncs(ctx)
	require.NoError(t, err)

	t.Log("Search!")
	checkSearch := func(
		query string, numResults, start int, expectedResults map[string]bool) {
		results, _, err := i.Search(ctx, query, numResults, start)
		require.NoError(t, err)
		for _, r := range results {
			_, ok := expectedResults[r.Path]
			require.True(t, ok, r.Path)
			delete(expectedResults, r.Path)
		}
		require.Len(t, expectedResults, 0)
	}

	userPath := func(dir, child string) string {
		return path.Clean("/keybase/private/user1/" + dir + "/" + child)
	}

	checkSearch("dolor", 10, 0, map[string]bool{
		userPath(names[0], names[0]+"_file1"): true,
		userPath(names[1], names[1]+"_file1"): true,
	})

	checkSearch(names[0], 10, 0, map[string]bool{
		userPath(names[0], ""):                true,
		userPath(names[0], names[0]+"_file1"): true,
		userPath(names[0], names[0]+"_file2"): true,
	})

	t.Log("Try partial results")
	results, nextResult, err := i.Search(ctx, names[0], 2, 0)
	require.NoError(t, err)
	require.Len(t, results, 2)
	require.Equal(t, 2, nextResult)
	results2, nextResult2, err := i.Search(ctx, names[0], 2, nextResult)
	require.NoError(t, err)
	require.Len(t, results2, 1)
	require.Equal(t, -1, nextResult2)
}
