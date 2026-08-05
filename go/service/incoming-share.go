// Copyright 2020 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"

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
	ScaledPath    string `json:"scaledPath"`
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

func (h *IncomingShareHandler) GetIncomingShareItems(ctx context.Context) (items []keybase1.IncomingShareItem, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	manifestPath := filepath.Join(IncomingShareFolder(h.G().Env.GetMobileSharedHome()), "manifest.json")
	f, err := os.Open(manifestPath)
	if err != nil {
		mctx.Debug("incoming-share: open manifest.json error: %v", err)
		return nil, err
	}
	defer f.Close()
	var jsonItems []shareItemJSON
	if err = json.NewDecoder(f).Decode(&jsonItems); err != nil {
		mctx.Debug("incoming-share: decode manifest.json error: %v", err)
		return nil, err
	}
	mctx.Debug("incoming-share: %d items", len(jsonItems))
loop:
	for _, jsonItem := range jsonItems {
		if len(jsonItem.Error) > 0 {
			mctx.Debug("incoming-share: error: %s", jsonItem.Error)
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
				mctx.Debug("incoming-share: stat error on original, skipping item: %v", err)
				continue loop
			}
			originalSize = int(fiOriginal.Size())
		}

		var scaledSize int
		if len(jsonItem.ScaledPath) > 0 {
			fiScaled, err := os.Stat(jsonItem.ScaledPath)
			if err != nil {
				mctx.Debug("incoming-share: stat error on scaled: %v", err)
				return nil, err
			}
			scaledSize = int(fiScaled.Size())
		}

		items = append(items, keybase1.IncomingShareItem{
			Type:          t,
			OriginalPath:  strPtr(jsonItem.OriginalPath),
			OriginalSize:  numPtr(originalSize),
			ScaledPath:    strPtr(jsonItem.ScaledPath),
			ScaledSize:    numPtr(scaledSize),
			ThumbnailPath: strPtr(jsonItem.ThumbnailPath),
			Content:       strPtr(jsonItem.Content),
		})
	}

	if len(items) == 0 {
		return nil, errors.New("empty incoming share")
	}

	return items, nil
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
