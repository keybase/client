package service

import (
	"fmt"
	"github.com/keybase/client/go/identify3"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

// identify3Handler handles one RPC in the identify3 flow
type identify3Handler struct {
	libkb.Contextified
	xp rpc.Transporter
}

func (i *identify3Handler) newMetaContext(ctx context.Context) libkb.MetaContext {
	return libkb.NewMetaContext(ctx, i.G()).WithLogTag("ID3")
}

func newIdentify3Handler(xp rpc.Transporter, g *libkb.GlobalContext) *identify3Handler {
	return &identify3Handler{
		Contextified: libkb.NewContextified(g),
		xp:           xp,
	}
}

func (i *identify3Handler) Identify3(ctx context.Context, arg keybase1.Identify3Arg) (err error) {
	mctx := i.newMetaContext(ctx)
	defer mctx.Trace(fmt.Sprintf("Identify3(%+v)", arg), func() error { return err })()
	cli := rpc.NewClient(i.xp, libkb.NewContextifiedErrorUnwrapper(mctx.G()), nil)
	id3cli := keybase1.Identify3UiClient{Cli: cli}
	return identify3.Identify3(mctx, id3cli, arg)
}

func (i *identify3Handler) Identify3FollowUser(ctx context.Context, arg keybase1.Identify3FollowUserArg) (err error) {
	mctx := i.newMetaContext(ctx)
	defer mctx.Trace(fmt.Sprintf("Identify3FollowUser(%+v)", arg), func() error { return err })()
	return identify3.FollowUser(mctx, arg)
}

func (i *identify3Handler) Identify3IgnoreUser(ctx context.Context, guiID keybase1.Identify3GUIID) (err error) {
	mctx := i.newMetaContext(ctx)
	defer mctx.Trace(fmt.Sprintf("Identify3IgnoreUser(%+v)", guiID), func() error { return err })()
	return identify3.IgnoreUser(mctx, guiID)
}

var _ keybase1.Identify3Interface = (*identify3Handler)(nil)
