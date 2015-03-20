package engine

//
// engine.PGPKeyImportEngine is a class for optionally generating PGP keys,
// and pushing them into the keybase sigchain via the Delegator.
//

import (
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

type PGPKeyExportEngine struct {
	libkb.Contextified
	arg *keybase_1.PgpExportArg
}
