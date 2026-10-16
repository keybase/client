// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// Writes the manifest that makeManifest builds from the share folder and
// returns a handler that reads it.
func setupIncomingShare(t *testing.T, makeManifest func(folder string) []map[string]string) (*IncomingShareHandler, func()) {
	tc := libkb.SetupTest(t, "incoming-share", 1)
	tc.G.Env.Test.MobileSharedHome = t.TempDir()
	folder := IncomingShareFolder(tc.G.Env.GetMobileSharedHome())
	require.NoError(t, os.MkdirAll(folder, 0o700))
	b, err := json.Marshal(makeManifest(folder))
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(folder, "manifest.json"), b, 0o600))
	return NewIncomingShareHandler(nil, tc.G), tc.Cleanup
}

func TestIncomingShareCountsDroppedItems(t *testing.T) {
	var good string
	h, cleanup := setupIncomingShare(t, func(folder string) []map[string]string {
		good = filepath.Join(folder, "guid", "photo.jpg")
		require.NoError(t, os.MkdirAll(filepath.Dir(good), 0o700))
		require.NoError(t, os.WriteFile(good, []byte("jpeg"), 0o600))
		return []map[string]string{
			{"type": "image", "originalPath": good},
			{"type": "error", "error": "loadImage: failed"},
			{"type": "image", "originalPath": filepath.Join(folder, "guid2", "gone.jpg")},
			{"type": "text", "content": "hello"},
		}
	})
	defer cleanup()

	res, err := h.GetIncomingShareItems(context.Background())
	require.NoError(t, err)
	require.Equal(t, 2, res.DroppedCount)
	require.Len(t, res.Items, 2)
	require.Equal(t, keybase1.IncomingShareType_IMAGE, res.Items[0].Type)
	require.Equal(t, good, *res.Items[0].OriginalPath)
	require.Equal(t, 4, *res.Items[0].OriginalSize)
	require.Equal(t, keybase1.IncomingShareType_TEXT, res.Items[1].Type)
	require.Equal(t, "hello", *res.Items[1].Content)
}

func TestIncomingShareAllDroppedIsNotAnError(t *testing.T) {
	h, cleanup := setupIncomingShare(t, func(string) []map[string]string {
		return []map[string]string{{"type": "error", "error": "loadImage: failed"}}
	})
	defer cleanup()

	res, err := h.GetIncomingShareItems(context.Background())
	require.NoError(t, err)
	require.Empty(t, res.Items)
	require.Equal(t, 1, res.DroppedCount)
}

func TestIncomingShareEmptyManifestIsAnError(t *testing.T) {
	h, cleanup := setupIncomingShare(t, func(string) []map[string]string {
		return []map[string]string{}
	})
	defer cleanup()

	_, err := h.GetIncomingShareItems(context.Background())
	require.Error(t, err)
}
