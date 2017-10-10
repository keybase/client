// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func (a *PGPKeyImportEngineArg) Export() (ret keybase1.PGPKeyGenArg) {
	ret.AllowMulti = a.AllowMulti
	ret.DoExport = a.DoExport
	ret.ExportEncrypted = a.ExportEncrypted
	ret.PushSecret = a.PushSecret
	a.Gen.ExportTo(&ret)
	return
}

func ImportPGPKeyImportEngineArg(g *libkb.GlobalContext, a keybase1.PGPKeyGenArg) (ret PGPKeyImportEngineArg) {
	ga := libkb.ImportKeyGenArg(a)
	ret = PGPKeyImportEngineArg{
		AllowMulti:      a.AllowMulti,
		DoExport:        a.DoExport,
		ExportEncrypted: a.ExportEncrypted,
		PushSecret:      a.PushSecret,
		Gen:             &ga,
		Ctx:             g,
	}
	return ret
}
