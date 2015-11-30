// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

func TestFavoriteAdd(t *testing.T) {
	tc := SetupEngineTest(t, "template")
	defer tc.Cleanup()
	CreateAndSignupFakeUser(tc, "fav")

	addfav("t_alice,t_bob", true, tc)
	if len(listfav(tc)) != 1 {
		t.Errorf("favorites len: %d, expected 1", len(listfav(tc)))
	}

	// Add the same share again. The number shouldn't change.
	addfav("t_alice,t_bob", true, tc)
	if len(listfav(tc)) != 1 {
		t.Errorf("favorites len: %d, expected 1", len(listfav(tc)))
	}

	// Add a public share of the same name, make sure both are represented.
	addfav("t_alice,t_bob", false, tc)
	if len(listfav(tc)) != 2 {
		t.Errorf("favorites len: %d, expected 2", len(listfav(tc)))
	}
}

func TestFavoriteDelete(t *testing.T) {
	tc := SetupEngineTest(t, "template")
	defer tc.Cleanup()
	CreateAndSignupFakeUser(tc, "fav")

	addfav("t_alice,t_bob", true, tc)
	addfav("t_alice,t_charlie", true, tc)
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

	addfav("t_alice,t_charlie", true, tc)
	addfav("t_alice,t_bob", true, tc)

	ctx := &Context{}
	eng := NewFavoriteList(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	favs := eng.Favorites()
	if len(favs) != 2 {
		t.Fatalf("num favs: %d, expected 2", len(favs))
	}
	if favs[0].Name != "t_alice,t_bob" {
		t.Errorf("fav 0: %q, expected t_alice,t_bob", favs[0].Name)
	}
	if favs[1].Name != "t_alice,t_charlie" {
		t.Errorf("fav 1: %q, expected t_alice,t_charlie", favs[1].Name)
	}
}

func addfav(name string, private bool, tc libkb.TestContext) {
	ctx := &Context{}
	arg := keybase1.FavoriteAddArg{
		Folder: keybase1.Folder{Name: name, Private: private},
	}
	eng := NewFavoriteAdd(&arg, tc.G)
	err := RunEngine(eng, ctx)
	if err != nil {
		tc.T.Fatal(err)
	}
}

func rmfav(name string, private bool, tc libkb.TestContext) {
	ctx := &Context{}
	arg := keybase1.FavoriteDeleteArg{
		Folder: keybase1.Folder{Name: name, Private: private},
	}
	eng := NewFavoriteDelete(&arg, tc.G)
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
	return eng.Favorites()
}
