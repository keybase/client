package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

func (a *PGPKeyImportEngineArg) Export() (ret keybase_1.PgpKeyGenArg) {
	ret.AllowMulti = a.AllowMulti
	ret.DoExport = a.DoExport
	a.Gen.ExportTo(&ret)
	return
}

func ImportPGPKeyImportEngineArg(a keybase_1.PgpKeyGenArg) (ret PGPKeyImportEngineArg) {
	ga := libkb.ImportKeyGenArg(a)
	ret = PGPKeyImportEngineArg{
		AllowMulti: a.AllowMulti,
		DoExport:   a.DoExport,
		Gen:        &ga,
	}
	return ret
}
