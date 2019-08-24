// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"reflect"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/keybase/client/go/kbfs/favorites"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfsedits"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func favToAddToKBFolder(toAdd favorites.ToAdd) keybase1.Folder {
	handle := toAdd.ToKBFolderHandle()
	return keybase1.Folder{
		Private:    handle.FolderType != keybase1.FolderType_PUBLIC,
		Name:       handle.Name,
		FolderType: handle.FolderType,
		Created:    handle.Created,
	}
}

func favTestInit(t *testing.T, testingDiskCache bool) (
	mockCtrl *gomock.Controller, config *ConfigMock, ctx context.Context) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	if !testingDiskCache {
		config.mockKbpki.EXPECT().GetCurrentSession(gomock.
			Any()).AnyTimes().
			Return(idutil.SessionInfo{
				Name: kbname.NormalizedUsername("tester"),
				UID:  keybase1.MakeTestUID(16),
			}, nil)
	}
	config.mockClock.EXPECT().Now().Return(time.Unix(0, 0)).AnyTimes()
	config.mockRep.EXPECT().
		NotifyFavoritesChanged(gomock.Any()).Return().AnyTimes()

	return mockCtrl, config, context.Background()
}

func favTestShutdown(t *testing.T, mockCtrl *gomock.Controller,
	config *ConfigMock, f *Favorites) {
	if err := f.Shutdown(); err != nil {
		t.Errorf("Couldn't shut down favorites: %v", err)
	}
	config.ctr.CheckForFailures()
	mockCtrl.Finish()
}

func TestFavoritesAddTwice(t *testing.T) {
	mockCtrl, config, ctx := favTestInit(t, false)
	f := NewFavorites(config)
	f.InitForTest()
	defer favTestShutdown(t, mockCtrl, config, f)

	// Call Add twice in a row, but only get one Add KBPKI call
	fav1 := favorites.ToAdd{
		Folder: favorites.Folder{
			Name: "test",
			Type: tlf.Public,
		},
		Data:    favorites.Data{},
		Created: false,
	}
	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), fav1.ToKBFolderHandle()).
		Return(nil)
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).
		Return(keybase1.FavoritesResult{
			FavoriteFolders: []keybase1.Folder{favToAddToKBFolder(fav1)},
		}, nil)
	if err := f.Add(ctx, fav1); err != nil {
		t.Fatalf("Couldn't add favorite: %v", err)
	}

	// A second add shouldn't result in a KBPKI call
	if err := f.Add(ctx, fav1); err != nil {
		t.Fatalf("Couldn't re-add same favorite: %v", err)
	}
}

func TestFavoriteAddCreatedAlwaysGoThrough(t *testing.T) {
	mockCtrl, config, ctx := favTestInit(t, false)
	f := NewFavorites(config)
	f.InitForTest()
	defer favTestShutdown(t, mockCtrl, config, f)

	fav1 := favorites.ToAdd{
		Folder: favorites.Folder{
			Name: "test",
			Type: tlf.Public,
		},
		Data:    favorites.Data{},
		Created: false,
	}
	expected1 := keybase1.FolderHandle{
		Name:       "test",
		FolderType: keybase1.FolderType_PUBLIC,
		Created:    false,
	}
	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), expected1).Return(nil)
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(keybase1.FavoritesResult{
		FavoriteFolders: []keybase1.Folder{favToAddToKBFolder(fav1)},
	}, nil)
	if err := f.Add(ctx, fav1); err != nil {
		t.Fatalf("Couldn't add favorite: %v", err)
	}

	fav2 := favorites.ToAdd{
		Folder: favorites.Folder{
			Name: "test",
			Type: tlf.Public,
		},
		Data:    favorites.Data{},
		Created: true,
	}
	expected2 := keybase1.FolderHandle{
		Name:       "test",
		FolderType: keybase1.FolderType_PUBLIC,
		Created:    true,
	}
	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), expected2).Return(nil)
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(keybase1.FavoritesResult{
		FavoriteFolders: []keybase1.Folder{favToAddToKBFolder(fav2)},
	}, nil)
	if err := f.Add(ctx, fav2); err != nil {
		t.Fatalf("Couldn't add favorite: %v", err)
	}
}

func TestFavoritesAddCreated(t *testing.T) {
	mockCtrl, config, ctx := favTestInit(t, false)
	f := NewFavorites(config)
	f.InitForTest()
	defer favTestShutdown(t, mockCtrl, config, f)

	// Call Add with created = true
	fav1 := favorites.ToAdd{
		Folder: favorites.Folder{
			Name: "test",
			Type: tlf.Public,
		},
		Data:    favorites.Data{},
		Created: true,
	}
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(keybase1.FavoritesResult{}, nil)
	expected := keybase1.FolderHandle{
		Name:       "test",
		FolderType: keybase1.FolderType_PUBLIC,
		Created:    true,
	}
	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), expected).
		Return(nil)
	if err := f.Add(ctx, fav1); err != nil {
		t.Fatalf("Couldn't add favorite: %v", err)
	}
}

func TestFavoritesAddRemoveAdd(t *testing.T) {
	mockCtrl, config, ctx := favTestInit(t, false)
	f := NewFavorites(config)
	f.InitForTest()
	defer favTestShutdown(t, mockCtrl, config, f)

	fav1 := favorites.ToAdd{
		Folder: favorites.Folder{
			Name: "test",
			Type: tlf.Public,
		},
		Data:    favorites.Data{},
		Created: false,
	}

	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), fav1.ToKBFolderHandle()).
		Return(nil)
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(keybase1.FavoritesResult{
		FavoriteFolders: []keybase1.Folder{favToAddToKBFolder(fav1)},
	}, nil)
	if err := f.Add(ctx, fav1); err != nil {
		t.Fatalf("Couldn't add favorite: %v", err)
	}

	config.mockKbpki.EXPECT().FavoriteDelete(gomock.Any(), fav1.ToKBFolderHandle()).
		Return(nil)
	if err := f.Delete(ctx, fav1.Folder); err != nil {
		t.Fatalf("Couldn't delete favorite: %v", err)
	}

	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), fav1.ToKBFolderHandle()).
		Return(nil)
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(keybase1.FavoritesResult{
		FavoriteFolders: []keybase1.Folder{favToAddToKBFolder(fav1)},
	}, nil)
	config.mockKbfs.EXPECT().RefreshEditHistory(gomock.Any()).Return()
	if err := f.Add(ctx, fav1); err != nil {
		t.Fatalf("Couldn't re-add same favorite: %v", err)
	}
}

func TestFavoritesAddAsync(t *testing.T) {
	mockCtrl, config, ctx := favTestInit(t, false)
	// Only one task at a time
	f := newFavoritesWithChan(config, make(chan *favReq, 1))
	f.InitForTest()
	defer favTestShutdown(t, mockCtrl, config, f)

	// Call Add twice in a row, but only get one Add KBPKI call
	fav1 := favorites.ToAdd{
		Folder: favorites.Folder{
			Name: "test",
			Type: tlf.Public,
		},
		Data:    favorites.Data{},
		Created: false,
	}
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(keybase1.FavoritesResult{}, nil)

	c := make(chan struct{})
	// Block until there are multiple outstanding calls
	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), fav1.ToKBFolderHandle()).
		Do(func(_ context.Context, _ keybase1.FolderHandle) {
			<-c
		}).Return(nil)

	// There should only be one FavoriteAdd call for all of these, and
	// none of them should block.
	f.AddAsync(ctx, fav1)
	f.AddAsync(ctx, fav1)
	f.AddAsync(ctx, fav1)
	f.AddAsync(ctx, fav1)
	f.AddAsync(ctx, fav1)
	c <- struct{}{}
}

func TestFavoritesListFailsDuringAddAsync(t *testing.T) {
	mockCtrl, config, ctx := favTestInit(t, false)
	// Only one task at a time
	f := newFavoritesWithChan(config, make(chan *favReq, 1))
	f.InitForTest()
	defer favTestShutdown(t, mockCtrl, config, f)

	// Call Add twice in a row, but only get one Add KBPKI call
	fav1 := favorites.ToAdd{
		Folder: favorites.Folder{
			Name: "test",
			Type: tlf.Public,
		},
		Data:    favorites.Data{},
		Created: false,
	}

	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), fav1.ToKBFolderHandle()).Return(nil)
	// Cancel the first list request
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(keybase1.
		FavoritesResult{}, context.Canceled)

	f.AddAsync(ctx, fav1) // this will fail
	// Wait so the next one doesn't get batched together with this one
	if err := f.wg.Wait(context.Background()); err != nil {
		t.Fatalf("Couldn't wait on favorites: %v", err)
	}

	// Now make sure the second time around, the favorites get listed
	// and one gets added, even if its context gets added
	c := make(chan struct{})
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(keybase1.FavoritesResult{}, nil)
	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), fav1.ToKBFolderHandle()).
		Do(func(_ context.Context, _ keybase1.FolderHandle) {
			c <- struct{}{}
		}).Return(nil)

	f.AddAsync(ctx, fav1) // should work
	<-c
}

func TestFavoritesControlUserHistory(t *testing.T) {
	mockCtrl, config, ctx := favTestInit(t, false)
	f := NewFavorites(config)
	f.Initialize(ctx)
	defer favTestShutdown(t, mockCtrl, config, f)

	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), gomock.Any()).
		Return(nil)
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).
		Return(keybase1.FavoritesResult{}, nil)
	config.mockKbs.EXPECT().EncryptFavorites(gomock.Any(),
		gomock.Any()).Return(nil, nil)
	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(nil, nil).Times(2)
	config.mockKbpki.EXPECT().FavoriteDelete(gomock.Any(), gomock.Any()).
		Return(nil)

	username := "bob"
	tlfName := "alice,bob"
	tlfType := tlf.Private

	// Add a favorite.
	err := f.Add(ctx, favorites.ToAdd{
		Folder: favorites.Folder{
			Name: tlfName,
			Type: tlfType,
		},
		Created: true})
	require.NoError(t, err)

	// Put a thing in user history.
	history := kbfsedits.NewTlfHistory()
	_, err = history.AddNotifications(username, []string{"hello"})
	require.NoError(t, err)
	config.UserHistory().UpdateHistory(tlf.CanonicalName(tlfName), tlfType,
		history, username)

	// Delete the favorite.
	err = f.Delete(ctx, favorites.Folder{Name: tlfName, Type: tlfType})
	require.NoError(t, err)

	// Verify that the user history is now empty.
	userHistory := config.UserHistory().Get(username)
	require.Empty(t, userHistory)
}

func TestFavoritesGetAll(t *testing.T) {
	mockCtrl, config, ctx := favTestInit(t, false)
	f := NewFavorites(config)
	f.Initialize(ctx)
	defer favTestShutdown(t, mockCtrl, config, f)

	// Prep
	teamID := keybase1.MakeTestTeamID(0xdeadbeef, false)
	fol := keybase1.Folder{
		Name:       "fake folder",
		Private:    true,
		Created:    false,
		FolderType: keybase1.FolderType_TEAM,
		TeamID:     &teamID,
	}
	teamID2 := keybase1.MakeTestTeamID(0xabcdef, true)
	fol2 := keybase1.Folder{
		Name:       "another folder",
		Private:    false,
		Created:    false,
		FolderType: keybase1.FolderType_PUBLIC,
		TeamID:     &teamID2,
	}
	teamID3 := keybase1.MakeTestTeamID(0x87654321, false)
	fol3 := keybase1.Folder{
		Name:       "folder three",
		Private:    true,
		Created:    false,
		FolderType: keybase1.FolderType_PRIVATE,
		TeamID:     &teamID3,
	}
	res := keybase1.FavoritesResult{
		IgnoredFolders:  []keybase1.Folder{fol},
		FavoriteFolders: []keybase1.Folder{fol2},
		NewFolders:      []keybase1.Folder{fol3},
	}
	// Mock out the API server.
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(res, nil)
	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(nil, nil).Times(2)
	config.mockKbs.EXPECT().EncryptFavorites(gomock.Any(),
		gomock.Any()).Return(nil, nil)

	// Require that we correctly return the data inserted into the cache by
	// the server.
	res2, err := f.GetAll(ctx)
	require.NoError(t, err)
	require.Equal(t, res.IgnoredFolders, res2.IgnoredFolders)
	require.Equal(t, res.NewFolders, res2.NewFolders)

	// Favorites will have 2 extra: the home TLFs
	require.Len(t, res2.FavoriteFolders, len(res.FavoriteFolders)+2)
	for _, folder := range res.FavoriteFolders {
		found := false
		for _, fav := range res2.FavoriteFolders {
			if reflect.DeepEqual(fav, folder) {
				found = true
			}
		}
		require.True(t, found, "Folder: %v", folder)
	}
}

func TestFavoritesDiskCache(t *testing.T) {
	mockCtrl, config, ctx := favTestInit(t, true)

	// EXPECT this manually so that we can manually edit the leveldb later
	config.mockKbpki.EXPECT().GetCurrentSession(gomock.
		Any()).Times(3).
		Return(idutil.SessionInfo{
			Name: kbname.NormalizedUsername("tester"),
			UID:  keybase1.MakeTestUID(16),
		}, nil)

	f := NewFavorites(config)

	f.Initialize(ctx)

	// Add a favorite. Expect that it will be encoded to disk.
	fav1 := favorites.Folder{Name: "test", Type: tlf.Public}
	fav1Add := favorites.ToAdd{
		Folder:  fav1,
		Data:    favorites.Data{},
		Created: false,
	}

	var decodedData favoritesCacheForDisk
	var decodedDataFromDisk favoritesCacheEncryptedForDisk
	encodedData := []byte("encoded data")
	encryptedData := []byte("encrypted data")
	diskData := []byte("disk data")
	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), gomock.Any()).Return(nil)
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(keybase1.FavoritesResult{
		FavoriteFolders: []keybase1.Folder{favToAddToKBFolder(fav1Add)},
	}, nil)
	config.mockCodec.EXPECT().Encode(gomock.Any()).Do(func(
		f favoritesCacheForDisk) {
		decodedData = f
	}).Return(
		encodedData,
		nil)
	config.mockKbs.EXPECT().EncryptFavorites(gomock.Any(),
		encodedData).Return(encryptedData, nil)
	config.mockCodec.EXPECT().Encode(gomock.Any()).Do(func(
		f favoritesCacheEncryptedForDisk) {
		decodedDataFromDisk = f
	}).Return(
		diskData,
		nil)

	err := f.Add(ctx, fav1Add)
	require.NoError(t, err)

	key := []byte(string(keybase1.MakeTestUID(16)))
	dataInLeveldb, err := f.diskCache.Get(key, nil)
	require.NoError(t, err)

	// Shut down the favorites cache to remove the favorites from memory.
	err = f.Shutdown()
	require.NoError(t, err)

	// EXPECT this manually so that we can manually edit the leveldb
	config.mockKbpki.EXPECT().GetCurrentSession(gomock.
		Any()).Times(1).
		Return(idutil.SessionInfo{
			Name: kbname.NormalizedUsername("tester"),
			UID:  keybase1.MakeTestUID(16),
		}, nil).Do(func(_ context.Context) {
		err := f.diskCache.Put(key, dataInLeveldb, nil)
		require.NoError(t, err)
	})

	// Make a new favorites cache.
	f = NewFavorites(config)

	// Initialize it from the data we just wrote to disk.
	config.mockCodec.EXPECT().Decode(diskData,
		gomock.Any()).Do(func(_ []byte, disk *favoritesCacheEncryptedForDisk) {
		*disk = decodedDataFromDisk
	}).Return(nil)
	config.mockKbs.EXPECT().DecryptFavorites(gomock.Any(),
		encryptedData).Return(encodedData, nil)
	config.mockCodec.EXPECT().Decode(encodedData,
		gomock.Any()).Do(func(_ []byte, disk *favoritesCacheForDisk) {
		*disk = decodedData
	}).Return(nil)

	// Pretend we are offline and cannot retrieve favorites right now.
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(keybase1.
		FavoritesResult{}, errDisconnected{})
	f.Initialize(ctx)

	// Ensure that the favorite we added before is still present.
	// There should be three favorites total, including the home TLFs.
	faves, err := f.Get(ctx)
	require.NoError(t, err)
	require.Equal(t, len(faves), 3)
	require.Contains(t, faves, fav1)

	// This line not deferred because we need to swap out Favorites instances
	// above.
	favTestShutdown(t, mockCtrl, config, f)
}
