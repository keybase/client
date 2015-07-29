package service

import (
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// FavoriteHandler implements the keybase1.Favorite protocol
type FavoriteHandler struct {
	*BaseHandler
}

// NewFavoriteHandler creates a FavoriteHandler with the xp
// protocol.
func NewFavoriteHandler(xp *rpc2.Transport) *FavoriteHandler {
	return &FavoriteHandler{BaseHandler: NewBaseHandler(xp)}
}

// FavoriteAdd handles the favoriteAdd RPC.
func (h *FavoriteHandler) FavoriteAdd(arg keybase1.FavoriteAddArg) error {
	return nil
}

// FavoriteDelete handles the favoriteDelete RPC.
func (h *FavoriteHandler) FavoriteDelete(arg keybase1.FavoriteDeleteArg) error {
	return nil
}

// FavoriteList handles the favoriteList RPC.
func (h *FavoriteHandler) FavoriteList(sessionID int) ([]keybase1.Folder, error) {
	return nil, nil
}
