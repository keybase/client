
package libkb

import (
	"github.com/keybase/go-jsonw"
)

type SigHint struct {
	sigId *SigId
	remoteId string
	apiUrl string
	humanUrl string
}

type SigHints struct {
	uid     UID
	version int
	hints map[SigId]*SigHint
	dirty bool
}

func NewSigHint(jw *jsonw.Wrapper) (sh *SigHint, err error) {
	sh = &SigHint{}
	sh.sigId, err = GetSigId(jw.AtKey("sig_id"), true)
	sh.remoteId, _ = jw.AtKey("remote_id").GetString()
	sh.apiUrl, _ = jw.AtKey("api_url").GetString()
	sh.humanUrl, _ = jw.AtKey("human_url").GetString()
	return
}

func NewSigHints(jw *jsonw.Wrapper, uid UID, dirty bool) (sh *SigHints, err error) {
	var n int

	obj := SigHints{ uid : uid, dirty : dirty, version : 0}

	if jw == nil || jw.IsNil() {
		sh = &obj
		return
	}

	jw.AtKey("version").GetIntVoid(&obj.version, &err)
	if err != nil {
		return
	}

	obj.hints = make(map[SigId]*SigHint)
	n, err = jw.AtKey("hints").Len()
	if err != nil {
		return
	}

	for i := 0; i < n; i++ {
		hint, tmpe := NewSigHint(jw.AtKey("hints").AtIndex(i))
		if tmpe != nil {
			G.Log.Warning("Bad SigHint Loaded: %s", tmpe.Error())
		} else {
			obj.hints[*hint.sigId] = hint
		}
	}

	sh = &obj
	return
}

func (sh SigHint) MarshalToJson() *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("sig_id", jsonw.NewString(sh.sigId.ToString(true)))
	ret.SetKey("remote_id", jsonw.NewString(sh.remoteId))
	ret.SetKey("api_url", jsonw.NewString(sh.apiUrl))
	ret.SetKey("human_url", jsonw.NewString(sh.humanUrl))
	return ret
}

func (sh SigHints) MarshalToJson() *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("version", jsonw.NewInt(sh.version))
	ret.SetKey("hints", jsonw.NewArray(len(sh.hints)))
	i := 0
	for _,v := range(sh.hints) {
		ret.AtKey("hints").SetIndex(i, v.MarshalToJson())
	}
	return ret
}

func (sh *SigHints) Store() (err error) {
	if sh.dirty {
		err = G.LocalDb.Put(
			DbKey{ Typ : DB_SIG_HINTS, Key : string(sh.uid) },
			[]DbKey{},
			sh.MarshalToJson(),
		)
		sh.dirty = false
	}
	return err
}

func LoadSigHintsFromLocalStorage(uid UID) (sh *SigHints, err error) {
	var jw *jsonw.Wrapper
	jw, err = G.LocalDb.Get(DbKey{ Typ : DB_SIG_HINTS, Key : string(uid)})
	if err != nil {
		return
	}
	sh, err = NewSigHints(jw, uid, false)
	return
}

