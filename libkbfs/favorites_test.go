// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

func favTestInit(t *testing.T) (mockCtrl *gomock.Controller,
	config *ConfigMock, ctx context.Context) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	config.mockKbpki.EXPECT().GetCurrentUserInfo(gomock.Any()).AnyTimes().
		Return(libkb.NormalizedUsername("tester"),
			keybase1.MakeTestUID(16), nil)

	return mockCtrl, config, context.Background()
}

func favTestShutdown(mockCtrl *gomock.Controller, config *ConfigMock) {
	config.ctr.CheckForFailures()
	mockCtrl.Finish()
}

func TestFavoritesAddTwice(t *testing.T) {
	mockCtrl, config, ctx := favTestInit(t)
	defer favTestShutdown(mockCtrl, config)

	f := NewFavorites(config)
	// Call Add twice in a row, but only get one Add KBPKI call
	fav1 := favToAdd{Favorite{"test", true}, false}
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(nil, nil)
	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), fav1.toKBFolder()).
		Return(nil)
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
	defer favTestShutdown(mockCtrl, config)

	f := NewFavorites(config)

	fav1 := favToAdd{Favorite{"test", true}, false}
	expected1 := keybase1.Folder{
		Name:    "test",
		Private: false,
		Created: false,
	}
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(nil, nil)
	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), expected1).Return(nil)
	if err := f.Add(ctx, fav1); err != nil {
		t.Fatalf("Couldn't add favorite: %v", err)
	}

	fav2 := favToAdd{Favorite{"test", true}, true}
	expected2 := keybase1.Folder{
		Name:    "test",
		Private: false,
		Created: true,
	}
	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), expected2).Return(nil)
	if err := f.Add(ctx, fav2); err != nil {
		t.Fatalf("Couldn't add favorite: %v", err)
	}
}

func TestFavoritesAddCreated(t *testing.T) {
	mockCtrl, config, ctx := favTestInit(t)
	defer favTestShutdown(mockCtrl, config)

	f := NewFavorites(config)
	// Call Add with created = true
	fav1 := favToAdd{Favorite{"test", true}, true}
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(nil, nil)
	expected := keybase1.Folder{
		Name:    "test",
		Private: false,
		Created: true,
	}
	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), expected).
		Return(nil)
	if err := f.Add(ctx, fav1); err != nil {
		t.Fatalf("Couldn't add favorite: %v", err)
	}
}

func TestFavoritesAddRemoveAdd(t *testing.T) {
	mockCtrl, config, ctx := favTestInit(t)
	defer favTestShutdown(mockCtrl, config)

	f := NewFavorites(config)
	fav1 := favToAdd{Favorite{"test", true}, false}
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(nil, nil)
	folder1 := fav1.toKBFolder()
	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), folder1).
		Times(2).Return(nil)
	config.mockKbpki.EXPECT().FavoriteDelete(gomock.Any(), folder1).
		Return(nil)
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
	defer favTestShutdown(mockCtrl, config)

	// Only one task at a time
	f := newFavoritesWithChan(config, make(chan *favReq, 1))
	// Call Add twice in a row, but only get one Add KBPKI call
	fav1 := favToAdd{Favorite{"test", true}, false}
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(nil, nil)

	c := make(chan struct{})
	// Block until thereare multiple outstanding calls
	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), fav1.toKBFolder()).
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
	defer favTestShutdown(mockCtrl, config)

	// Only one task at a time
	f := newFavoritesWithChan(config, make(chan *favReq, 1))
	// Call Add twice in a row, but only get one Add KBPKI call
	fav1 := favToAdd{Favorite{"test", true}, false}

	// Cancel the first list request
	c := make(chan struct{})
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).
		Do(func(_ context.Context) {
			c <- struct{}{}
		}).Return(nil, context.Canceled)

	f.AddAsync(ctx, fav1) // this will fail
	// Block so the next one doesn't get batched together with this one
	<-c

	// Now make sure the second time around, the favorites get listed
	// and one gets added, even if its context gets added
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(nil, nil)
	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), fav1.toKBFolder()).
		Do(func(_ context.Context, _ keybase1.Folder) {
			c <- struct{}{}
		}).Return(nil)

	f.AddAsync(ctx, fav1) // should work
	<-c
}
