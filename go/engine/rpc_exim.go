package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func (a *PGPKeyImportEngineArg) Export() (ret keybase1.PGPKeyGenArg) {
	ret.AllowMulti = a.AllowMulti
	ret.DoExport = a.DoExport
	ret.PushSecret = a.PushSecret
	a.Gen.ExportTo(&ret)
	return
}

func ImportPGPKeyImportEngineArg(a keybase1.PGPKeyGenArg) (ret PGPKeyImportEngineArg) {
	ga := libkb.ImportKeyGenArg(a)
	ret = PGPKeyImportEngineArg{
		AllowMulti: a.AllowMulti,
		DoExport:   a.DoExport,
		Gen:        &ga,
	}
	return ret
}
