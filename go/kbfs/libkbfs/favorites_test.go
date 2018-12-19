// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/kbfs/kbfsedits"
	"github.com/stretchr/testify/require"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

func favTestInit(t *testing.T) (mockCtrl *gomock.Controller,
	config *ConfigMock, ctx context.Context) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	config.mockKbpki.EXPECT().GetCurrentSession(gomock.Any()).AnyTimes().
		Return(SessionInfo{
			Name: kbname.NormalizedUsername("tester"),
			UID:  keybase1.MakeTestUID(16),
		}, nil)

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
	mockCtrl, config, ctx := favTestInit(t)
	f := NewFavorites(config)
	f.Initialize(ctx)
	defer favTestShutdown(t, mockCtrl, config, f)

	// Call Add twice in a row, but only get one Add KBPKI call
	fav1 := favToAdd{Favorite{"test", tlf.Public}, false}
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(nil, nil)
	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), fav1.ToKBFolder()).
		Return(nil)
	config.mockKbs.EXPECT().EncryptFavorites(gomock.Any(),
		gomock.Any()).Return(nil, nil)
	config.mockClock.EXPECT().Now().Return(time.Unix(0, 0)).Times(2)
	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(nil, nil).Times(2)
	if err := f.Add(ctx, fav1); err != nil {
		t.Fatalf("Couldn't add favorite: %v", err)
	}

	// A second add shouldn't result in a KBPKI call
	if err := f.Add(ctx, fav1); err != nil {
		t.Fatalf("Couldn't re-add same favorite: %v", err)
	}
}

func TestFavoriteAddCreatedAlwaysGoThrough(t *testing.T) {
	mockCtrl, config, ctx := favTestInit(t)
	f := NewFavorites(config)
	f.Initialize(ctx)
	defer favTestShutdown(t, mockCtrl, config, f)

	fav1 := favToAdd{Favorite{"test", tlf.Public}, false}
	expected1 := keybase1.Folder{
		Name:       "test",
		FolderType: keybase1.FolderType_PUBLIC,
		Created:    false,
	}
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(nil, nil)
	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), expected1).Return(nil)
	config.mockKbs.EXPECT().EncryptFavorites(gomock.Any(),
		gomock.Any()).Return(nil, nil)
	config.mockClock.EXPECT().Now().Return(time.Unix(0, 0)).Times(2)
	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(nil, nil).Times(2)
	if err := f.Add(ctx, fav1); err != nil {
		t.Fatalf("Couldn't add favorite: %v", err)
	}

	fav2 := favToAdd{Favorite{"test", tlf.Public}, true}
	expected2 := keybase1.Folder{
		Name:       "test",
		FolderType: keybase1.FolderType_PUBLIC,
		Created:    true,
	}
	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), expected2).Return(nil)
	if err := f.Add(ctx, fav2); err != nil {
		t.Fatalf("Couldn't add favorite: %v", err)
	}
}

func TestFavoritesAddCreated(t *testing.T) {
	mockCtrl, config, ctx := favTestInit(t)
	f := NewFavorites(config)
	f.Initialize(ctx)
	defer favTestShutdown(t, mockCtrl, config, f)

	// Call Add with created = true
	fav1 := favToAdd{Favorite{"test", tlf.Public}, true}
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(nil, nil)
	config.mockKbs.EXPECT().EncryptFavorites(gomock.Any(),
		gomock.Any()).Return(nil, nil)
	config.mockClock.EXPECT().Now().Return(time.Unix(0, 0))
	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(nil, nil).Times(2)
	expected := keybase1.Folder{
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
	mockCtrl, config, ctx := favTestInit(t)
	f := NewFavorites(config)
	f.Initialize(ctx)
	defer favTestShutdown(t, mockCtrl, config, f)

	fav1 := favToAdd{Favorite{"test", tlf.Public}, false}
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(nil, nil)
	folder1 := fav1.ToKBFolder()
	config.mockKbs.EXPECT().EncryptFavorites(gomock.Any(),
		gomock.Any()).Return(nil, nil)

	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), folder1).
		Times(2).Return(nil)
	config.mockKbpki.EXPECT().FavoriteDelete(gomock.Any(), folder1).
		Return(nil)
	config.mockClock.EXPECT().Now().Return(time.Unix(0, 0)).Times(3)
	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(nil, nil).Times(2)

	if err := f.Add(ctx, fav1); err != nil {
		t.Fatalf("Couldn't add favorite: %v", err)
	}

	if err := f.Delete(ctx, fav1.Favorite); err != nil {
		t.Fatalf("Couldn't delete favorite: %v", err)
	}

	// A second add shouldn't result in a KBPKI call
	if err := f.Add(ctx, fav1); err != nil {
		t.Fatalf("Couldn't re-add same favorite: %v", err)
	}
}

func TestFavoritesAddAsync(t *testing.T) {
	mockCtrl, config, ctx := favTestInit(t)
	// Only one task at a time
	f := newFavoritesWithChan(config, make(chan *favReq, 1))
	f.Initialize(ctx)
	defer favTestShutdown(t, mockCtrl, config, f)

	// Call Add twice in a row, but only get one Add KBPKI call
	fav1 := favToAdd{Favorite{"test", tlf.Public}, false}
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(nil, nil)
	config.mockKbs.EXPECT().EncryptFavorites(gomock.Any(),
		gomock.Any()).Return(nil, nil)
	config.mockClock.EXPECT().Now().Return(time.Unix(0, 0))
	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(nil, nil).Times(2)

	c := make(chan struct{})
	// Block until there are multiple outstanding calls
	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), fav1.ToKBFolder()).
		Do(func(_ context.Context, _ keybase1.Folder) {
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
	mockCtrl, config, ctx := favTestInit(t)
	// Only one task at a time
	f := newFavoritesWithChan(config, make(chan *favReq, 1))
	f.Initialize(ctx)
	defer favTestShutdown(t, mockCtrl, config, f)

	// Call Add twice in a row, but only get one Add KBPKI call
	fav1 := favToAdd{Favorite{"test", tlf.Public}, false}

	// Expect that the favorites will be encrypted to write to disk
	config.mockKbs.EXPECT().EncryptFavorites(gomock.Any(),
		gomock.Any()).Return(nil, nil)
	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(nil, nil).Times(2)
	config.mockClock.EXPECT().Now().Return(time.Unix(0, 0)).Times(1)

	// Cancel the first list request
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).
		Return(nil, context.Canceled)

	f.AddAsync(ctx, fav1) // this will fail
	// Wait so the next one doesn't get batched together with this one
	if err := f.wg.Wait(context.Background()); err != nil {
		t.Fatalf("Couldn't wait on favorites: %v", err)
	}

	// Now make sure the second time around, the favorites get listed
	// and one gets added, even if its context gets added
	c := make(chan struct{})
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(nil, nil)
	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), fav1.ToKBFolder()).
		Do(func(_ context.Context, _ keybase1.Folder) {
			c <- struct{}{}
		}).Return(nil)

	f.AddAsync(ctx, fav1) // should work
	<-c
}

func TestFavoritesControlUserHistory(t *testing.T) {
	mockCtrl, config, ctx := favTestInit(t)
	f := NewFavorites(config)
	f.Initialize(ctx)
	defer favTestShutdown(t, mockCtrl, config, f)

	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(nil, nil)
	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), gomock.Any()).
		Return(nil)
	config.mockKbs.EXPECT().EncryptFavorites(gomock.Any(),
		gomock.Any()).Return(nil, nil)
	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(nil, nil).Times(2)
	config.mockClock.EXPECT().Now().Return(time.Unix(0, 0)).Times(2)
	config.mockKbpki.EXPECT().FavoriteDelete(gomock.Any(), gomock.Any()).
		Return(nil)

	username := "bob"
	tlfName := "alice,bob"
	tlfType := tlf.Private

	// Add a favorite.
	err := f.Add(ctx, favToAdd{Favorite: Favorite{tlfName, tlfType},
		created: true})
	require.NoError(t, err)

	// Put a thing in user history.
	history := kbfsedits.NewTlfHistory()
	err = history.AddNotifications(username, []string{"hello"})
	require.NoError(t, err)
	config.UserHistory().UpdateHistory(tlf.CanonicalName(tlfName), tlfType,
		history, username)

	// Delete the favorite.
	err = f.Delete(ctx, Favorite{tlfName, tlfType})
	require.NoError(t, err)

	// Verify that the user history is now empty.
	userHistory := config.UserHistory().Get(username)
	require.Empty(t, userHistory)
}
