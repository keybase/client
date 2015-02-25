package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

func (a *PGPEngineArg) Export() (ret keybase_1.KeyGenArg) {
	ret.AllowMulti = a.AllowMulti
	ret.DoExport = a.DoExport
	a.Gen.ExportTo(&ret)
	return
}

func ImportPGPEngineArg(a keybase_1.KeyGenArg) (ret PGPEngineArg) {
	ga := libkb.ImportKeyGenArg(a)
	ret = PGPEngineArg{
		AllowMulti: a.AllowMulti,
		DoExport:   a.DoExport,
		Gen:        &ga,
	}
	return ret
}
