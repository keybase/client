package service

import (
	"github.com/keybase/client/go/engine"
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
	eng := engine.NewFavoriteAdd(&arg, G)
	ctx := &engine.Context{}
	return engine.RunEngine(eng, ctx)
}

func (h *FavoriteHandler) FavoriteAddTLF(arg keybase1.FavoriteAddTLFArg) error {
	folder, err := keybase1.ParseTLF(arg.Name)
	if err != nil {
		return err
	}
	eng := engine.NewFavoriteAdd(&keybase1.FavoriteAddArg{SessionID: arg.SessionID, Folder: folder}, G)
	ctx := &engine.Context{}
	return engine.RunEngine(eng, ctx)
}

// FavoriteDelete handles the favoriteDelete RPC.
func (h *FavoriteHandler) FavoriteDelete(arg keybase1.FavoriteDeleteArg) error {
	eng := engine.NewFavoriteDelete(&arg, G)
	ctx := &engine.Context{}
	return engine.RunEngine(eng, ctx)
}

// FavoriteList handles the favoriteList RPC.
func (h *FavoriteHandler) FavoriteList(sessionID int) ([]keybase1.Folder, error) {
	eng := engine.NewFavoriteList(G)
	ctx := &engine.Context{}
	if err := engine.RunEngine(eng, ctx); err != nil {
		return nil, err
	}
	return eng.Favorites(), nil
}
