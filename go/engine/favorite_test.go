// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

func TestFavoriteAdd(t *testing.T) {
	tc := SetupEngineTest(t, "template")
	defer tc.Cleanup()
	CreateAndSignupFakeUser(tc, "fav")

	idUI := &FakeIdentifyUI{}
	addfav("t_alice,t_bob", true, true, idUI, tc)
	if len(listfav(tc)) != 3 {
		t.Errorf("favorites len: %d, expected 3", len(listfav(tc)))
	}

	// Add the same share again. The number shouldn't change.
	addfav("t_alice,t_bob", true, true, idUI, tc)
	if len(listfav(tc)) != 3 {
		t.Errorf("favorites len: %d, expected 3", len(listfav(tc)))
	}

	// Add a public share of the same name, make sure both are represented.
	addfav("t_alice,t_bob", false, true, idUI, tc)
	if len(listfav(tc)) != 4 {
		t.Errorf("favorites len: %d, expected 4", len(listfav(tc)))
	}
}

// Test adding a favorite with a social assertion.
// Sharing before signup, social assertion user doesn't
// exist yet.
func TestFavoriteAddSocial(t *testing.T) {
	tc := SetupEngineTest(t, "template")
	defer tc.Cleanup()
	u := CreateAndSignupFakeUser(tc, "fav")

	idUI := &FakeIdentifyUI{}
	addfav(fmt.Sprintf("%s,bob@twitter", u.Username), true, true, idUI, tc)
	if len(listfav(tc)) != 3 {
		t.Errorf("favorites len: %d, expected 3", len(listfav(tc)))
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
	addfav(fmt.Sprintf("%s,bobdog@twitter", u.Username), true, false, idUI, tc)
	if len(listfav(tc)) != 4 {
		t.Errorf("favorites len: %d, expected 4", len(listfav(tc)))
	}
	if idUI.DisplayTLFCount != 0 {
		t.Errorf("DisplayTLFCount: %d, expected 0", idUI.DisplayTLFCount)
	}

	idUI = &FakeIdentifyUI{}
	// Make sure ui for displaying tlf + invite not called for non-social
	// assertion TLF.
	addfav(fmt.Sprintf("%s,t_alice", u.Username), true, true, idUI, tc)
	if len(listfav(tc)) != 5 {
		t.Errorf("favorites len: %d, expected 5", len(listfav(tc)))
	}
	if idUI.DisplayTLFCount != 0 {
		t.Errorf("DisplayTLFCount: %d, expected 0", idUI.DisplayTLFCount)
	}

	idUI = &FakeIdentifyUI{}
	// Test adding a public favorite with SBS social assertion
	addfav(fmt.Sprintf("%s,bobdog@twitter", u.Username), false, true, idUI, tc)
	if len(listfav(tc)) != 6 {
		t.Errorf("favorites len: %d, expected 6", len(listfav(tc)))
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
	CreateAndSignupFakeUser(tc, "fav")

	idUI := &FakeIdentifyUI{}
	addfav("t_alice,t_bob", true, true, idUI, tc)
	addfav("t_alice,t_charlie", true, true, idUI, tc)
	if len(listfav(tc)) != 2 {
		t.Errorf("favorites len: %d, expected 2", len(listfav(tc)))
	}
	rmfav("t_alice,t_bob", true, tc)
	if len(listfav(tc)) != 1 {
		t.Errorf("favorites len: %d, expected 1", len(listfav(tc)))
	}
	if listfav(tc)[0].Name != "t_alice,t_charlie" {
		t.Errorf("favorites entry: %q, expected %q", listfav(tc)[0].Name, "t_alice,t_charlie")
	}
}

func TestFavoriteList(t *testing.T) {
	tc := SetupEngineTest(t, "template")
	defer tc.Cleanup()
	CreateAndSignupFakeUser(tc, "fav")

	idUI := &FakeIdentifyUI{}
	addfav("t_alice,t_charlie", true, true, idUI, tc)
	addfav("t_alice,t_bob", true, true, idUI, tc)

	ctx := &Context{}
	eng := NewFavoriteList(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	favs := eng.Result().FavoriteFolders
	if len(favs) != 4 {
		t.Fatalf("num favs: %d, expected 4", len(favs))
	}
	if favs[0].Name != "t_alice,t_bob" {
		t.Errorf("fav 0: %q, expected t_alice,t_bob", favs[0].Name)
	}
	if favs[1].Name != "t_alice,t_charlie" {
		t.Errorf("fav 1: %q, expected t_alice,t_charlie", favs[1].Name)
	}
}

func addfav(name string, private, created bool, idUI libkb.IdentifyUI, tc libkb.TestContext) {
	ctx := &Context{
		IdentifyUI: idUI,
	}
	arg := keybase1.FavoriteAddArg{
		Folder: keybase1.Folder{Name: name, Private: private, Created: created},
	}
	eng := NewFavoriteAdd(&arg, tc.G)
	err := RunEngine(eng, ctx)
	if err != nil {
		tc.T.Fatal(err)
	}
	eng.Wait()
}

func rmfav(name string, private bool, tc libkb.TestContext) {
	ctx := &Context{}
	arg := keybase1.FavoriteIgnoreArg{
		Folder: keybase1.Folder{Name: name, Private: private},
	}
	eng := NewFavoriteIgnore(&arg, tc.G)
	err := RunEngine(eng, ctx)
	if err != nil {
		tc.T.Fatal(err)
	}
}

func listfav(tc libkb.TestContext) []keybase1.Folder {
	ctx := &Context{}
	eng := NewFavoriteList(tc.G)
	err := RunEngine(eng, ctx)
	if err != nil {
		tc.T.Fatal(err)
	}
	return eng.Result().FavoriteFolders
}

// func defaultFaves(un string) []keybase1.Folder {
// 	return []keybase1.Folder{
// 		keybase1.Folder{ name : un, private : false },
// 		keybase1.Folder{ name : un, private : true },
// 	}
// }
//
// func hasDupes(folders []keybase1.Folder) {
// 	tab := make(map[string]bool)
// 	for folder := range folders {
//
// 	}
// }
//
// func compareFaves(a []keybase1.Folder, b.keybase1.Folder[]) {
//
// }
