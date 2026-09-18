package utils

import (
	"context"
	"encoding/json"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

// PinnedConvsGregorKey holds the user's pinned inbox conversations as a JSON
// array of ConvIDStr, top of the inbox first. Written by the GUI.
const PinnedConvsGregorKey = "chatPinnedConvs"

func ParsePinnedConvs(body []byte) []chat1.ConvIDStr {
	var raw []string
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil
	}
	seen := make(map[string]bool, len(raw))
	res := make([]chat1.ConvIDStr, 0, len(raw))
	for _, id := range raw {
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		res = append(res, chat1.ConvIDStr(id))
	}
	return res
}

func GetPinnedConvs(ctx context.Context, g *globals.Context) ([]chat1.ConvIDStr, error) {
	st, err := g.GregorState.State(ctx)
	if err != nil {
		return nil, err
	}
	cat, err := gregor1.ObjFactory{}.MakeCategory(PinnedConvsGregorKey)
	if err != nil {
		return nil, err
	}
	items, err := st.ItemsWithCategoryPrefix(cat)
	if err != nil {
		return nil, err
	}
	for _, it := range items {
		// prefix match; skip any category that merely starts with the key
		if it.Category().String() == PinnedConvsGregorKey {
			return ParsePinnedConvs(it.Body().Bytes()), nil
		}
	}
	return nil, nil
}
