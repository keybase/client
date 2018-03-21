package emom

import (
	emom1 "github.com/keybase/client/go/protocol/emom1"
	saltpack "github.com/keybase/saltpack"
	context "golang.org/x/net/context"
)

type Cryptoer interface {
	InitClient(context.Context, *emom1.Arg, *emom1.RequestPlaintext) error
	SessionKey() saltpack.BoxPrecomputedSharedKey
}
