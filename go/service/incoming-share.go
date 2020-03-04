// Copyright 2020 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"context"
	"encoding/json"
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
}

func strPtr(str string) *string {
	if len(str) > 0 {
		return &str
	}
	return nil
}

func (h *IncomingShareHandler) GetIncomingShareItems(_ context.Context) (items []keybase1.IncomingShareItem, err error) {
	manifestPath := filepath.Join(h.G().Env.GetMobileSharedHome(), "Library", "Caches", "incoming-shares", "manifest.json")
	f, err := os.Open(manifestPath)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var jsonItems []shareItemJSON
	if err = json.NewDecoder(f).Decode(&jsonItems); err != nil {
		return nil, err
	}
loop:
	for _, jsonItem := range jsonItems {
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
			continue loop
		}
		fi, err := os.Stat(jsonItem.OriginalPath)
		if err != nil {
			return nil, err
		}
		items = append(items, keybase1.IncomingShareItem{
			Type:          t,
			OriginalPath:  jsonItem.OriginalPath,
			OriginalSize:  int(fi.Size()),
			ScaledPath:    strPtr(jsonItem.ScaledPath),
			ThumbnailPath: strPtr(jsonItem.ThumbnailPath),
			Content:       strPtr(jsonItem.Content),
		})
	}
	return items, nil
}
