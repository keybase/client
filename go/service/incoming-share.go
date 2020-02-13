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
	Type        string `json:"type"`
	PayloadPath string `json:"payloadPath"`
	Content     string `json:"content"`
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
		content := (*string)(nil)
		if len(jsonItem.Content) > 0 {
			// Need to copy it because it gets reassigned in the next
			// iteration.
			contentCopy := jsonItem.Content
			content = &contentCopy
		}
		var t keybase1.IncomingShareType
		switch jsonItem.Type {
		case "file":
			t = keybase1.IncomingShareType_FILE
		case "text":
			t = keybase1.IncomingShareType_TEXT
		case "image":
			t = keybase1.IncomingShareType_IMAGE
		default:
			continue loop
		}
		items = append(items, keybase1.IncomingShareItem{
			Type:        t,
			PayloadPath: jsonItem.PayloadPath,
			Content:     content,
		})
	}
	return items, nil
}
