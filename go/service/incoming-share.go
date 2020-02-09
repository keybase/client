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

// shareItemJson is for json parsing only.
type shareItemJson struct {
	Type        string `json:"type"`
	PayloadPath string `json:"payloadPath"`
	Filename    string `json:"filename"`
}

func (h *IncomingShareHandler) GetIncomingShareItems(_ context.Context) (items []keybase1.IncomingShareItem, err error) {
	manifestPath := filepath.Join(h.G().Env.GetMobileSharedHome(), "Library", "Caches", "incoming-shares", "manifest.json")
	f, err := os.Open(manifestPath)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var jsonItems []shareItemJson
	if err = json.NewDecoder(f).Decode(&jsonItems); err != nil {
		return nil, err
	}
loop:
	for _, jsonItem := range jsonItems {
		filename := (*string)(nil)
		if len(jsonItem.Filename) > 0 {
			filename = &jsonItem.Filename
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
			Filename:    filename,
		})
	}
	return items, nil
}
