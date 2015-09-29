package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

func TestFavoriteAdd(t *testing.T) {
	tc := SetupEngineTest(t, "template")
	defer tc.Cleanup()

	if err := addfav("t_alice,t_bob", tc); err != nil {
		t.Fatal(err)
	}
	if len(tc.G.FavoriteCache.List()) != 1 {
		t.Errorf("cache len: %d, expected 1", len(tc.G.FavoriteCache.List()))
	}
}

func TestFavoriteDelete(t *testing.T) {
	tc := SetupEngineTest(t, "template")
	defer tc.Cleanup()

	if err := addfav("t_alice,t_bob", tc); err != nil {
		t.Fatal(err)
	}
	if err := addfav("t_alice,t_charlie", tc); err != nil {
		t.Fatal(err)
	}
	if len(tc.G.FavoriteCache.List()) != 2 {
		t.Errorf("cache len: %d, expected 2", len(tc.G.FavoriteCache.List()))
	}
	if err := rmfav("t_alice,t_bob", tc); err != nil {
		t.Fatal(err)
	}
	if len(tc.G.FavoriteCache.List()) != 1 {
		t.Errorf("cache len: %d, expected 1", len(tc.G.FavoriteCache.List()))
	}
	if tc.G.FavoriteCache.List()[0].Name != "t_alice,t_charlie" {
		t.Errorf("cache entry: %q, expected %q", tc.G.FavoriteCache.List()[0].Name, "t_alice,t_charlie")
	}
}

func TestFavoriteList(t *testing.T) {
	tc := SetupEngineTest(t, "template")
	defer tc.Cleanup()

	if err := addfav("t_alice,t_charlie", tc); err != nil {
		t.Fatal(err)
	}
	if err := addfav("t_alice,t_bob", tc); err != nil {
		t.Fatal(err)
	}

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

func addfav(name string, tc libkb.TestContext) error {
	ctx := &Context{}
	arg := keybase1.FavoriteAddArg{
		Folder: keybase1.Folder{Name: name},
	}
	eng := NewFavoriteAdd(&arg, tc.G)
	return RunEngine(eng, ctx)
}

func rmfav(name string, tc libkb.TestContext) error {
	ctx := &Context{}
	arg := keybase1.FavoriteDeleteArg{
		Folder: keybase1.Folder{Name: name},
	}
	eng := NewFavoriteDelete(&arg, tc.G)
	return RunEngine(eng, ctx)
}
