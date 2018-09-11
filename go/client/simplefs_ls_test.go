// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"math/rand"
	"testing"

	"github.com/stretchr/testify/require"
)

func testLSSortByName(t *testing.T, expectedOrder []string) {
	listings := make([]Listing, len(expectedOrder))
	perm := rand.Perm(len(expectedOrder))
	for i, v := range perm {
		listings[v] = Listing{
			name: expectedOrder[i],
		}
	}

	sortListings(listings, ListOptions{})
	for i, expectedName := range expectedOrder {
		require.Equal(t, expectedName, listings[i].name)
	}
}

func TestLSSortByName(t *testing.T) {
	testLSSortByName(t, []string{"bar", "baz", "foo"})
	testLSSortByName(t, []string{"bar", "Bar", "foo", "Foo"})
	testLSSortByName(t, []string{
		"._.DS_Store",
		"._bg.jpg",
		".DS_Store",
		"bg.jpg",
		"hihihi",
		"IMG_0187.JPG",
		"index.html",
		"me",
		"o_o",
		"O_O",
		"ssh-keys.pub",
		"stamp",
		"test",
		"test.md",
	})
}
