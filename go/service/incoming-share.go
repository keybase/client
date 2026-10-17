// Copyright 2020 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type IncomingShareHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewIncomingShareHandler(xp rpc.Transporter, g *libkb.GlobalContext) *IncomingShareHandler {
	return &IncomingShareHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

// shareItemJSON is for json parsing only.
type shareItemJSON struct {
	Type          string `json:"type"`
	OriginalPath  string `json:"originalPath"`
	ThumbnailPath string `json:"thumbnailPath"`
	Content       string `json:"content"`
	Error         string `json:"error"`
}

func strPtr(str string) *string {
	if len(str) > 0 {
		return &str
	}
	return nil
}

func numPtr(num int) *int {
	if num != 0 {
		return &num
	}
	return nil
}

// IncomingShareFolder is where the iOS share extension drops its payloads: one
// directory per share plus a single manifest.json, in the app group's cache so
// the OS can reclaim them. Empty when there is no shared home, i.e. not iOS.
func IncomingShareFolder(mobileSharedHome string) string {
	if mobileSharedHome == "" {
		return ""
	}
	return filepath.Join(mobileSharedHome, "Library", "Caches", "incoming-shares")
}

const (
	incomingShareManifest = "manifest.json"
	// A manifest being read is moved to manifest.<random>.claimed first.
	incomingShareClaimedPrefix = "manifest."
	incomingShareClaimedSuffix = ".claimed"
)

func isClaimedIncomingShareManifest(name string) bool {
	return name != incomingShareManifest &&
		strings.HasPrefix(name, incomingShareClaimedPrefix) &&
		strings.HasSuffix(name, incomingShareClaimedSuffix)
}

// How long a claimed share is still handed out again. The app can throw an
// answer away (a newer load superseded it, a disconnect cancelled it) and load
// again; that reload has to get the share, not nothing.
const incomingShareRepeatWindow = 30 * time.Second

// The last share claimed, and the user it was handed to, guarded by its mutex,
// which also serializes reads.
var lastIncomingShare struct {
	sync.Mutex
	folder string
	uid    keybase1.UID
	at     time.Time
	res    keybase1.IncomingShareItems
}

// GetIncomingShareItems hands out each share once. The manifest is moved aside
// before it is read and removed after; a repeat call within
// incomingShareRepeatWindow, by the same user, gets the same share again, and
// any other (a stale or replayed keybase://incoming-share link, or another
// account after a switch) gets no items and no error.
// The payload files stay until they are sent or purged.
// A repeat carries the share's id, and only the app knows whether it already
// acted on that share, so keeping a share from being acted on twice is up to it.
func (h *IncomingShareHandler) GetIncomingShareItems(ctx context.Context) (res keybase1.IncomingShareItems, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	folder := IncomingShareFolder(h.G().Env.GetMobileSharedHome())
	if folder == "" {
		return res, nil
	}
	last := &lastIncomingShare
	last.Lock()
	defer last.Unlock()
	now := h.G().Clock().Now()
	uid := mctx.CurrentUID()
	res, claimed, err := h.claimIncomingShare(mctx, folder)
	switch {
	case err != nil:
		// a newer share that can't be read still replaces the last one
		last.folder = ""
		return res, err
	case claimed:
		last.folder, last.uid, last.at, last.res = folder, uid, now, res
		return res, nil
	case last.folder == folder && last.uid.Equal(uid) &&
		now.Sub(last.at) < incomingShareRepeatWindow:
		mctx.Debug("incoming-share: handing out the share claimed %v ago again", now.Sub(last.at))
		return stillPresentIncomingShare(last.res), nil
	default:
		return keybase1.IncomingShareItems{}, nil
	}
}

// stillPresentIncomingShare is the share as handed out again: an item whose
// file is gone was sent or exported since, so it is left out, and a share with
// nothing left is nothing to share.
// A share that had no items to begin with (every one dropped) is handed out
// as it was, so its notice survives a reload.
func stillPresentIncomingShare(share keybase1.IncomingShareItems) (res keybase1.IncomingShareItems) {
	if len(share.Items) == 0 {
		return share
	}
	for _, item := range share.Items {
		if item.OriginalPath != nil {
			if _, err := os.Stat(*item.OriginalPath); err != nil {
				continue
			}
		}
		res.Items = append(res.Items, item)
	}
	if len(res.Items) == 0 {
		return keybase1.IncomingShareItems{}
	}
	res.DroppedCount = share.DroppedCount
	res.Id = share.Id
	return res
}

// claimIncomingShare reads and removes the manifest; claimed is false when
// there is none.
func (h *IncomingShareHandler) claimIncomingShare(mctx libkb.MetaContext, folder string) (
	res keybase1.IncomingShareItems, claimed bool, err error,
) {
	suffix, err := libkb.RandHexString("", 8)
	if err != nil {
		return res, false, err
	}
	claimedPath := filepath.Join(folder, incomingShareClaimedPrefix+suffix+incomingShareClaimedSuffix)
	// A rename is atomic, so of two calls racing for one manifest only one gets it.
	if err := os.Rename(filepath.Join(folder, incomingShareManifest), claimedPath); err != nil {
		if os.IsNotExist(err) {
			mctx.Debug("incoming-share: no manifest, nothing to share")
			return res, false, nil
		}
		mctx.Debug("incoming-share: claim manifest.json error: %v", err)
		return res, false, err
	}
	// The rename keeps the manifest's mtime, and the purge removes claimed
	// manifests by age: make it read as new so the purge can't take it mid-read.
	now := time.Now()
	if err := os.Chtimes(claimedPath, now, now); err != nil {
		mctx.Debug("incoming-share: touch claimed manifest error: %v", err)
	}
	defer func() {
		if err := os.Remove(claimedPath); err != nil {
			mctx.Debug("incoming-share: remove claimed manifest error: %v", err)
		}
	}()
	f, err := os.Open(claimedPath)
	if err != nil {
		mctx.Debug("incoming-share: open manifest.json error: %v", err)
		return res, true, err
	}
	defer f.Close()
	var jsonItems []shareItemJSON
	if err = json.NewDecoder(f).Decode(&jsonItems); err != nil {
		mctx.Debug("incoming-share: decode manifest.json error: %v", err)
		return res, true, err
	}
	mctx.Debug("incoming-share: %d items", len(jsonItems))
	res.Id = suffix
loop:
	for _, jsonItem := range jsonItems {
		if len(jsonItem.Error) > 0 {
			// The extension writes only its own static description here, never
			// a path or the shared content.
			mctx.Warning("incoming-share: dropping item the extension couldn't prepare: %s", jsonItem.Error)
			res.DroppedCount++
			continue loop
		}
		var t keybase1.IncomingShareType
		switch jsonItem.Type {
		case "file":
			t = keybase1.IncomingShareType_FILE
		case "text":
			t = keybase1.IncomingShareType_TEXT
		case "image":
			t = keybase1.IncomingShareType_IMAGE
		case "video":
			t = keybase1.IncomingShareType_VIDEO
		default:
			mctx.Debug("incoming-share: skippping unknown type: %v", jsonItem.Type)
			continue loop
		}

		// The payloads live in a Caches dir the OS may purge at any time, and the
		// app deletes a source once it has exported it. A manifest that outlived
		// its files is stale, not broken: drop the item instead of failing the
		// whole share.
		var originalSize int
		if len(jsonItem.OriginalPath) > 0 {
			fiOriginal, err := os.Stat(jsonItem.OriginalPath)
			if err != nil {
				mctx.Warning("incoming-share: dropping %s item (%q) whose file can't be read: missing=%v",
					jsonItem.Type, filepath.Ext(jsonItem.OriginalPath), os.IsNotExist(err))
				res.DroppedCount++
				continue loop
			}
			originalSize = int(fiOriginal.Size())
		}

		// ScaledPath/ScaledSize stay unset: the extension now applies the
		// compression preference itself, so originalPath is already the file we
		// want to upload and there is no second scaled variant to pick between.
		res.Items = append(res.Items, keybase1.IncomingShareItem{
			Type:          t,
			OriginalPath:  strPtr(jsonItem.OriginalPath),
			OriginalSize:  numPtr(originalSize),
			ThumbnailPath: strPtr(jsonItem.ThumbnailPath),
			Content:       strPtr(jsonItem.Content),
		})
	}

	// An empty manifest is a cancelled share: nothing to share. A share where
	// every item was dropped still answers, so the app can say why.
	return res, true, nil
}

func (h *IncomingShareHandler) dbKey() libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBIncomingSharePreference,
		Key: "v0-compress-preference",
	}
}

func (h *IncomingShareHandler) GetPreference(ctx context.Context) (
	pref keybase1.IncomingSharePreference, err error,
) {
	found, err := h.G().GetKVStore().GetInto(&pref, h.dbKey())
	if err != nil {
		return keybase1.IncomingSharePreference{}, err
	}
	if found {
		return pref, nil
	}
	// Compressing is the default for both the share extension and in-chat
	// attach; only an explicit opt-out uploads originals.
	return keybase1.IncomingSharePreference{
		CompressPreference: keybase1.IncomingShareCompressPreference_COMPRESSED,
	}, nil
}

func (h *IncomingShareHandler) SetPreference(ctx context.Context,
	preference keybase1.IncomingSharePreference,
) error {
	return h.G().GetKVStore().PutObj(h.dbKey(), nil, preference)
}
