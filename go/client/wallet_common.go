package client

import (
	"errors"
	"strings"

	"github.com/keybase/client/go/protocol/stellar1"
)

func parseAssetString(s string) (stellar1.Asset, error) {
	if s == "native" {
		return stellar1.AssetNative(), nil
	}
	pieces := strings.Split(s, "/")
	if len(pieces) != 2 {
		return stellar1.Asset{}, errors.New("invalid asset string")
	}
	t, err := stellar1.CreateNonNativeAssetType(pieces[0])
	if err != nil {
		return stellar1.Asset{}, err
	}
	return stellar1.Asset{
		Type:   t,
		Code:   pieces[0],
		Issuer: pieces[1],
	}, nil
}
