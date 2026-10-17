// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	clockwork "github.com/keybase/clockwork"
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

// The extension writes an empty manifest when the user cancels the share.
func TestIncomingShareEmptyManifestIsNothingToShare(t *testing.T) {
	h, cleanup := setupIncomingShare(t, func(string) []map[string]string {
		return []map[string]string{}
	})
	defer cleanup()

	res, err := h.GetIncomingShareItems(context.Background())
	require.NoError(t, err)
	require.Empty(t, res.Items)
	require.Zero(t, res.DroppedCount)
}

func writeIncomingShareManifest(t *testing.T, h *IncomingShareHandler, items []map[string]string) {
	b, err := json.Marshal(items)
	require.NoError(t, err)
	folder := IncomingShareFolder(h.G().Env.GetMobileSharedHome())
	require.NoError(t, os.WriteFile(filepath.Join(folder, "manifest.json"), b, 0o600))
}

func incomingShareText(t *testing.T, h *IncomingShareHandler) string {
	res, err := h.GetIncomingShareItems(context.Background())
	require.NoError(t, err)
	require.Zero(t, res.DroppedCount)
	if len(res.Items) == 0 {
		return ""
	}
	require.Len(t, res.Items, 1)
	return *res.Items[0].Content
}

func TestIncomingShareIsReadOnce(t *testing.T) {
	h, cleanup := setupIncomingShare(t, func(string) []map[string]string {
		return []map[string]string{{"type": "text", "content": "hello"}}
	})
	defer cleanup()
	clock := clockwork.NewFakeClock()
	h.G().SetClock(clock)
	folder := IncomingShareFolder(h.G().Env.GetMobileSharedHome())

	require.Equal(t, "hello", incomingShareText(t, h))

	// Neither the manifest nor the claimed copy is left behind.
	entries, err := os.ReadDir(folder)
	require.NoError(t, err)
	require.Empty(t, entries)

	// A reload of an answer the app threw away gets the share again.
	clock.Advance(incomingShareRepeatWindow - time.Second)
	require.Equal(t, "hello", incomingShareText(t, h))

	// A replayed incoming-share link later on gets nothing, without an error.
	clock.Advance(2 * time.Second)
	require.Empty(t, incomingShareText(t, h))
}

func TestIncomingShareRepeatLeavesOutFilesSinceRemoved(t *testing.T) {
	var sent, kept string
	h, cleanup := setupIncomingShare(t, func(folder string) []map[string]string {
		sent = filepath.Join(folder, "guid", "sent.jpg")
		kept = filepath.Join(folder, "guid2", "kept.jpg")
		for _, p := range []string{sent, kept} {
			require.NoError(t, os.MkdirAll(filepath.Dir(p), 0o700))
			require.NoError(t, os.WriteFile(p, []byte("jpeg"), 0o600))
		}
		return []map[string]string{
			{"type": "image", "originalPath": sent},
			{"type": "image", "originalPath": kept},
			{"type": "error", "error": "loadImage: failed"},
		}
	})
	defer cleanup()
	h.G().SetClock(clockwork.NewFakeClock())
	res, err := h.GetIncomingShareItems(context.Background())
	require.NoError(t, err)
	require.Len(t, res.Items, 2)

	require.NoError(t, os.Remove(sent))
	res, err = h.GetIncomingShareItems(context.Background())
	require.NoError(t, err)
	require.Len(t, res.Items, 1)
	require.Equal(t, kept, *res.Items[0].OriginalPath)
	require.Equal(t, 1, res.DroppedCount)

	require.NoError(t, os.Remove(kept))
	res, err = h.GetIncomingShareItems(context.Background())
	require.NoError(t, err)
	require.Empty(t, res.Items)
	require.Zero(t, res.DroppedCount)
}

func TestIncomingShareRepeatOfAllDroppedKeepsItsNotice(t *testing.T) {
	h, cleanup := setupIncomingShare(t, func(string) []map[string]string {
		return []map[string]string{{"type": "error", "error": "loadImage: failed"}}
	})
	defer cleanup()
	h.G().SetClock(clockwork.NewFakeClock())
	for i := 0; i < 2; i++ {
		res, err := h.GetIncomingShareItems(context.Background())
		require.NoError(t, err)
		require.Empty(t, res.Items)
		require.Equal(t, 1, res.DroppedCount)
	}
}

func TestIncomingShareNewShareReplacesTheLast(t *testing.T) {
	h, cleanup := setupIncomingShare(t, func(string) []map[string]string {
		return []map[string]string{{"type": "text", "content": "first"}}
	})
	defer cleanup()
	h.G().SetClock(clockwork.NewFakeClock())

	require.Equal(t, "first", incomingShareText(t, h))
	writeIncomingShareManifest(t, h, []map[string]string{{"type": "text", "content": "second"}})

	require.Equal(t, "second", incomingShareText(t, h))
	require.Equal(t, "second", incomingShareText(t, h))

	// A cancelled share replaces it too.
	writeIncomingShareManifest(t, h, []map[string]string{})
	require.Empty(t, incomingShareText(t, h))
	require.Empty(t, incomingShareText(t, h))
}

func TestIncomingShareUnreadableNewShareReplacesTheLast(t *testing.T) {
	h, cleanup := setupIncomingShare(t, func(string) []map[string]string {
		return []map[string]string{{"type": "text", "content": "first"}}
	})
	defer cleanup()
	h.G().SetClock(clockwork.NewFakeClock())
	require.Equal(t, "first", incomingShareText(t, h))
	folder := IncomingShareFolder(h.G().Env.GetMobileSharedHome())
	require.NoError(t, os.WriteFile(filepath.Join(folder, "manifest.json"), []byte("{not json"), 0o600))

	_, err := h.GetIncomingShareItems(context.Background())
	require.Error(t, err)
	require.Empty(t, incomingShareText(t, h))
}

func TestIncomingShareNoManifestIsNothingToShare(t *testing.T) {
	tc := libkb.SetupTest(t, "incoming-share", 1)
	defer tc.Cleanup()
	tc.G.Env.Test.MobileSharedHome = t.TempDir()
	h := NewIncomingShareHandler(nil, tc.G)

	res, err := h.GetIncomingShareItems(context.Background())
	require.NoError(t, err)
	require.Empty(t, res.Items)
	require.Zero(t, res.DroppedCount)
}

func TestIncomingShareUnreadableManifestIsStillConsumed(t *testing.T) {
	tc := libkb.SetupTest(t, "incoming-share", 1)
	defer tc.Cleanup()
	tc.G.Env.Test.MobileSharedHome = t.TempDir()
	folder := IncomingShareFolder(tc.G.Env.GetMobileSharedHome())
	require.NoError(t, os.MkdirAll(folder, 0o700))
	require.NoError(t, os.WriteFile(filepath.Join(folder, "manifest.json"), []byte("{not json"), 0o600))
	h := NewIncomingShareHandler(nil, tc.G)

	_, err := h.GetIncomingShareItems(context.Background())
	require.Error(t, err)

	res, err := h.GetIncomingShareItems(context.Background())
	require.NoError(t, err)
	require.Empty(t, res.Items)
}

// A claimed manifest a crash left behind doesn't block the next share.
func TestIncomingShareReplacesLeftoverClaimedManifest(t *testing.T) {
	h, cleanup := setupIncomingShare(t, func(folder string) []map[string]string {
		require.NoError(t, os.WriteFile(filepath.Join(folder, "manifest.claimed"),
			[]byte(`[{"type":"text","content":"stale"}]`), 0o600))
		return []map[string]string{{"type": "text", "content": "hello"}}
	})
	defer cleanup()

	require.Equal(t, "hello", incomingShareText(t, h))
}

// The app tells a repeat from a newer share by its id.
func TestIncomingShareRepeatCarriesTheShareID(t *testing.T) {
	sent := ""
	h, cleanup := setupIncomingShare(t, func(folder string) []map[string]string {
		sent = filepath.Join(folder, "guid", "sent.jpg")
		require.NoError(t, os.MkdirAll(filepath.Dir(sent), 0o700))
		require.NoError(t, os.WriteFile(sent, []byte("jpeg"), 0o600))
		return []map[string]string{
			{"type": "image", "originalPath": sent},
			{"type": "text", "content": "first"},
		}
	})
	defer cleanup()
	h.G().SetClock(clockwork.NewFakeClock())
	get := func() keybase1.IncomingShareItems {
		res, err := h.GetIncomingShareItems(context.Background())
		require.NoError(t, err)
		return res
	}

	first := get()
	require.NotEmpty(t, first.Id)
	require.Equal(t, first.Id, get().Id)
	// Still the same share with one of its files sent.
	require.NoError(t, os.Remove(sent))
	require.Equal(t, first.Id, get().Id)

	writeIncomingShareManifest(t, h, []map[string]string{{"type": "text", "content": "first"}})
	second := get()
	require.NotEmpty(t, second.Id)
	require.NotEqual(t, first.Id, second.Id)
	require.Equal(t, second.Id, get().Id)
}

func TestIncomingShareRepeatIsOnlyForTheSameUser(t *testing.T) {
	h, cleanup := setupIncomingShare(t, func(string) []map[string]string {
		return []map[string]string{{"type": "text", "content": "hello"}}
	})
	defer cleanup()
	h.G().SetClock(clockwork.NewFakeClock())
	mctx := libkb.NewMetaContextBackground(h.G())
	setUser := func(uid keybase1.UID) {
		h.G().ActiveDevice = libkb.NewProvisionalActiveDevice(mctx,
			keybase1.UserVersion{Uid: uid}, keybase1.DeviceID(""), nil, nil, "",
			libkb.KeychainModeNone)
	}

	setUser(keybase1.UID("00000000000000000000000000000119"))
	require.Equal(t, "hello", incomingShareText(t, h))
	setUser(keybase1.UID("11111111111111111111111111111119"))
	require.Empty(t, incomingShareText(t, h))
	setUser(keybase1.UID("00000000000000000000000000000119"))
	require.Equal(t, "hello", incomingShareText(t, h))
}
