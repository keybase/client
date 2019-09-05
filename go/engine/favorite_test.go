// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"sort"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func makeFave(u1, u2 string) string {
	return strings.Join([]string{u1, u2}, ",")
}

func TestFavoriteAdd(t *testing.T) {
	tc := SetupEngineTest(t, "template")
	defer tc.Cleanup()
	u := CreateAndSignupFakeUser(tc, "fav")
	expectedFaves := newFavorites(u.Username)

	idUI := &FakeIdentifyUI{}
	fave := makeFave(u.Username, "t_bob")
	addfav(fave, keybase1.FolderType_PRIVATE, true, idUI, tc, expectedFaves)
	if !listfav(tc).Equal(*expectedFaves) {
		t.Errorf("bad favorites")
	}

	// Add the same share again. The number shouldn't change.
	addfav(fave, keybase1.FolderType_PRIVATE, true, idUI, tc, nil)
	if !listfav(tc).Equal(*expectedFaves) {
		t.Errorf("bad favorites")
	}

	// Add a public share of the same name, make sure both are represented.
	addfav(fave, keybase1.FolderType_PUBLIC, true, idUI, tc, expectedFaves)
	if !listfav(tc).Equal(*expectedFaves) {
		t.Errorf("bad favorites")
	}
}

// Test adding a favorite with a social assertion.
// Sharing before signup, social assertion user doesn't
// exist yet.
func TestFavoriteAddSocial(t *testing.T) {
	tc := SetupEngineTest(t, "template")
	defer tc.Cleanup()
	u := CreateAndSignupFakeUser(tc, "fav")
	expectedFaves := newFavorites(u.Username)

	idUI := &FakeIdentifyUI{}
	addfav(fmt.Sprintf("bob@twitter,%s", u.Username), keybase1.FolderType_PRIVATE, true, idUI, tc, expectedFaves)
	if !listfav(tc).Equal(*expectedFaves) {
		t.Errorf("bad favorites")
	}

	if idUI.DisplayTLFCount != 1 {
		t.Errorf("DisplayTLFCount: %d, expected 1", idUI.DisplayTLFCount)
	}
	// There's no way to give invites to a user via API, so the
	// only case we can test automatically is the user being
	// out of invites.
	if !idUI.DisplayTLFArg.Throttled {
		t.Errorf("DisplayTLFArg.Throttled not set, expected it to be since user has no invites.")
	}
	if !idUI.DisplayTLFArg.IsPrivate {
		t.Errorf("DisplayTLFArg.IsPrivate not set on a private folder")
	}

	idUI = &FakeIdentifyUI{}
	// Test adding a favorite when not the creator.  Should not call ui for
	// displaying tlf + invite.
	// created flag == false
	addfav(fmt.Sprintf("bobdog@twitter,%s", u.Username), keybase1.FolderType_PRIVATE, false, idUI, tc, expectedFaves)
	if newFaves := listfav(tc); !newFaves.Equal(*expectedFaves) {
		t.Errorf("bad favorites: %s != %s", newFaves, expectedFaves)
	}
	if idUI.DisplayTLFCount != 0 {
		t.Errorf("DisplayTLFCount: %d, expected 0", idUI.DisplayTLFCount)
	}

	idUI = &FakeIdentifyUI{}
	// Make sure ui for displaying tlf + invite not called for non-social
	// assertion TLF.
	addfav(fmt.Sprintf("%s,t_alice", u.Username), keybase1.FolderType_PRIVATE, true, idUI, tc, expectedFaves)
	if newFaves := listfav(tc); !newFaves.Equal(*expectedFaves) {
		t.Errorf("bad favorites: %s != %s", newFaves, expectedFaves)
	}
	if idUI.DisplayTLFCount != 0 {
		t.Errorf("DisplayTLFCount: %d, expected 0", idUI.DisplayTLFCount)
	}

	idUI = &FakeIdentifyUI{}
	// Test adding a public favorite with SBS social assertion
	addfav(fmt.Sprintf("bobdog@twitter,%s", u.Username), keybase1.FolderType_PUBLIC, true, idUI, tc, expectedFaves)
	if newFaves := listfav(tc); !newFaves.Equal(*expectedFaves) {
		t.Errorf("bad favorites: %s != %s", newFaves, expectedFaves)
	}
	if idUI.DisplayTLFCount != 1 {
		t.Errorf("DisplayTLFCount: %d, expected 1", idUI.DisplayTLFCount)
	}
	if idUI.DisplayTLFArg.IsPrivate {
		t.Errorf("DisplayTLFArg.IsPrivate set on a public folder")
	}
}

func TestFavoriteIgnore(t *testing.T) {
	tc := SetupEngineTest(t, "template")
	defer tc.Cleanup()
	u := CreateAndSignupFakeUser(tc, "fav")

	expectedFaves := newFavorites(u.Username)

	idUI := &FakeIdentifyUI{}
	addfav(makeFave(u.Username, "t_bob"), keybase1.FolderType_PRIVATE, true, idUI, tc, expectedFaves)
	addfav(makeFave(u.Username, "t_charlie"), keybase1.FolderType_PRIVATE, true, idUI, tc, expectedFaves)
	if !listfav(tc).Equal(*expectedFaves) {
		t.Errorf("bad favorites")
	}
	rmfav(makeFave(u.Username, "t_bob"), keybase1.FolderType_PRIVATE, tc, expectedFaves)
	if !listfav(tc).Equal(*expectedFaves) {
		t.Errorf("bad favorites")
	}
}

func TestFavoriteList(t *testing.T) {
	tc := SetupEngineTest(t, "template")
	defer tc.Cleanup()
	u := CreateAndSignupFakeUser(tc, "fav")
	expectedFaves := newFavorites(u.Username)

	idUI := &FakeIdentifyUI{}
	addfav(makeFave(u.Username, "t_charlie"), keybase1.FolderType_PRIVATE, true, idUI, tc, expectedFaves)
	addfav(makeFave(u.Username, "t_bob"), keybase1.FolderType_PRIVATE, true, idUI, tc, expectedFaves)

	eng := NewFavoriteList(tc.G)
	m := NewMetaContextForTest(tc)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}
	favs := eng.Result().FavoriteFolders
	if !newFavoritesFromServer(favs).Equal(*expectedFaves) {
		t.Errorf("bad favorites")
	}
}

func addfav(name string, folderType keybase1.FolderType, created bool, idUI libkb.IdentifyUI, tc libkb.TestContext, expectedFaves *favorites) {
	uis := libkb.UIs{
		IdentifyUI: idUI,
	}
	arg := keybase1.FavoriteAddArg{
		Folder: keybase1.FolderHandle{Name: name, FolderType: folderType, Created: created},
	}
	eng := NewFavoriteAdd(tc.G, &arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	if err != nil {
		tc.T.Fatal(err)
	}
	eng.Wait()
	if expectedFaves != nil {
		expectedFaves.Push(keybase1.Folder{Name: name, FolderType: folderType})
	}
}

func rmfav(name string, folderType keybase1.FolderType, tc libkb.TestContext, expectedFaves *favorites) {
	arg := keybase1.FavoriteIgnoreArg{
		Folder: keybase1.FolderHandle{Name: name, FolderType: folderType},
	}
	eng := NewFavoriteIgnore(tc.G, &arg)
	m := libkb.NewMetaContextForTest(tc)
	err := RunEngine2(m, eng)
	if err != nil {
		tc.T.Fatal(err)
	}
	if expectedFaves != nil {
		expectedFaves.Remove(keybase1.Folder{Name: name, FolderType: folderType})
	}
}

func listfav(tc libkb.TestContext) *favorites {
	eng := NewFavoriteList(tc.G)
	m := libkb.NewMetaContextForTest(tc)
	err := RunEngine2(m, eng)
	if err != nil {
		tc.T.Fatal(err)
	}
	return newFavoritesFromServer(eng.Result().FavoriteFolders)
}

type favorites struct {
	m map[string]bool
}

func newFavorites(un string) *favorites {
	ret := &favorites{
		m: make(map[string]bool),
	}
	for _, f := range defaultFaves(un) {
		ret.Push(f)
	}
	return ret
}

func newFavoritesFromServer(v []keybase1.Folder) *favorites {
	ret := &favorites{
		m: make(map[string]bool),
	}
	for _, f := range v {
		ret.Push(f)
	}
	return ret
}

func (v *favorites) Push(f keybase1.Folder) {
	k := makeKey(f)
	if !v.m[k] {
		v.m[k] = true
	}
}

func (v *favorites) Remove(f keybase1.Folder) {
	delete(v.m, makeKey(f))
}

func (v favorites) Equal(b favorites) bool {
	for k := range v.m {
		if !b.m[k] {
			return false
		}
	}
	for k := range b.m {
		if !v.m[k] {
			return false
		}
	}
	return true
}

func makeKey(f keybase1.Folder) string {
	return fmt.Sprintf("%s:%v", f.Name, f.FolderType)
}

func defaultFaves(un string) []keybase1.Folder {
	return []keybase1.Folder{
		{Name: un, FolderType: keybase1.FolderType_PRIVATE},
		{Name: un, FolderType: keybase1.FolderType_PUBLIC},
	}
}

func (v *favorites) String() string {
	var s []string
	for f := range v.m {
		s = append(s, f)
	}
	sort.Strings(s)
	return strings.Join(s, ";")
}
