package service

import (
	"github.com/keybase/client/go/engine"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

// FavoriteHandler implements the keybase1.Favorite protocol
type FavoriteHandler struct {
	*BaseHandler
}

// NewFavoriteHandler creates a FavoriteHandler with the xp
// protocol.
func NewFavoriteHandler(xp rpc.Transporter) *FavoriteHandler {
	return &FavoriteHandler{BaseHandler: NewBaseHandler(xp)}
}

// FavoriteAdd handles the favoriteAdd RPC.
func (h *FavoriteHandler) FavoriteAdd(_ context.Context, arg keybase1.FavoriteAddArg) error {
	eng := engine.NewFavoriteAdd(&arg, G)
	ctx := &engine.Context{}
	return engine.RunEngine(eng, ctx)
}

// FavoriteDelete handles the favoriteDelete RPC.
func (h *FavoriteHandler) FavoriteDelete(_ context.Context, arg keybase1.FavoriteDeleteArg) error {
	eng := engine.NewFavoriteDelete(&arg, G)
	ctx := &engine.Context{}
	return engine.RunEngine(eng, ctx)
}

// FavoriteList handles the favoriteList RPC.
func (h *FavoriteHandler) FavoriteList(_ context.Context, sessionID int) ([]keybase1.Folder, error) {
	eng := engine.NewFavoriteList(G)
	ctx := &engine.Context{}
	if err := engine.RunEngine(eng, ctx); err != nil {
		return nil, err
	}
	return eng.Favorites(), nil
}
