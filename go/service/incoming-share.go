// Copyright 2020 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"

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

// GetIncomingShareItems hands out each share once. The manifest is moved aside
// before it is read and removed after, so a later call (a stale or replayed
// keybase://incoming-share link, a reload) finds nothing and returns no items
// and no error. The payload files stay until they are sent or purged.
func (h *IncomingShareHandler) GetIncomingShareItems(ctx context.Context) (res keybase1.IncomingShareItems, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	folder := IncomingShareFolder(h.G().Env.GetMobileSharedHome())
	if folder == "" {
		return res, nil
	}
	suffix, err := libkb.RandHexString("", 8)
	if err != nil {
		return res, err
	}
	claimedPath := filepath.Join(folder, incomingShareClaimedPrefix+suffix+incomingShareClaimedSuffix)
	// A rename is atomic, so of two calls racing for one manifest only one gets it.
	if err := os.Rename(filepath.Join(folder, incomingShareManifest), claimedPath); err != nil {
		if os.IsNotExist(err) {
			mctx.Debug("incoming-share: no manifest, nothing to share")
			return res, nil
		}
		mctx.Debug("incoming-share: claim manifest.json error: %v", err)
		return res, err
	}
	defer func() {
		if err := os.Remove(claimedPath); err != nil {
			mctx.Debug("incoming-share: remove claimed manifest error: %v", err)
		}
	}()
	f, err := os.Open(claimedPath)
	if err != nil {
		mctx.Debug("incoming-share: open manifest.json error: %v", err)
		return res, err
	}
	defer f.Close()
	var jsonItems []shareItemJSON
	if err = json.NewDecoder(f).Decode(&jsonItems); err != nil {
		mctx.Debug("incoming-share: decode manifest.json error: %v", err)
		return res, err
	}
	mctx.Debug("incoming-share: %d items", len(jsonItems))
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

	// A share where every item was dropped still answers, so the app can say
	// why instead of a generic failure.
	if len(res.Items) == 0 && res.DroppedCount == 0 {
		return res, errors.New("empty incoming share")
	}

	return res, nil
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
