package libkb

import (
	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/protocol/gregor1"
	context "golang.org/x/net/context"
)

type nullGregorState struct {
}

func newNullGregorState() nullGregorState {
	return nullGregorState{}
}

func (n nullGregorState) State(ctx context.Context) (gregor.State, error) {
	return gregor1.State{}, nil
}

func (n nullGregorState) UpdateCategory(ctx context.Context, cat string, body []byte,
	dtime gregor1.TimeOrOffset) (gregor1.MsgID, error) {
	return gregor1.MsgID{}, nil
}

func (n nullGregorState) InjectItem(ctx context.Context, cat string, body []byte, dtime gregor1.TimeOrOffset) (gregor1.MsgID, error) {
	return gregor1.MsgID{}, nil
}

func (n nullGregorState) DismissItem(ctx context.Context, cli gregor1.IncomingInterface,
	id gregor.MsgID) error {
	return nil
}

func (n nullGregorState) LocalDismissItem(ctx context.Context, id gregor.MsgID) error {
	return nil
}
