package emom

import (
	emom1 "github.com/keybase/client/go/protocol/emom1"
	saltpack "github.com/keybase/saltpack"
	context "golang.org/x/net/context"
)

type Cryptoer interface {
	InitClient(context.Context, *emom1.Arg, *emom1.RequestPlaintext) error
	InitServerHandshake(context.Context, emom1.Arg) error
	InitUserAuth(context.Context, emom1.Arg, emom1.RequestPlaintext) error
	ServerRatchet(context.Context, *emom1.Res) error
	ClientRatchet(context.Context, emom1.AuthEnc) error
	SessionKeyAt(emom1.Seqno) saltpack.BoxPrecomputedSharedKey
	LatestSessionKey() (saltpack.BoxPrecomputedSharedKey, emom1.Seqno)
}
