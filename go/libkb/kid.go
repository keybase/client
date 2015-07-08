package libkb

import (
	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

func GetKID(w *jsonw.Wrapper) (kid keybase1.KID, err error) {
	var s string
	s, err = w.GetString()
	if err != nil {
		return
	}
	kid = keybase1.KIDFromString(s)
	return
}

func KIDToFOKIDMapKey(k keybase1.KID) FOKIDMapKey {
	return FOKIDMapKey(k)
}

func KIDToFOKID(k keybase1.KID) FOKID {
	return FOKID{Kid: k}
}
