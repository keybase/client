package libkb

import (
	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

type SigHint struct {
	sigId     keybase1.SigID
	remoteId  string
	apiUrl    string
	humanUrl  string
	checkText string
}

func (sh SigHint) GetHumanUrl() string  { return sh.humanUrl }
func (sh SigHint) GetApiUrl() string    { return sh.apiUrl }
func (sh SigHint) GetCheckText() string { return sh.checkText }

type SigHints struct {
	uid     UID
	version int
	hints   map[keybase1.SigID]*SigHint
	dirty   bool
}

func NewSigHint(jw *jsonw.Wrapper) (sh *SigHint, err error) {
	sh = &SigHint{}
	sh.sigId, err = GetSigId(jw.AtKey("sig_id"), true)
	sh.remoteId, _ = jw.AtKey("remote_id").GetString()
	sh.apiUrl, _ = jw.AtKey("api_url").GetString()
	sh.humanUrl, _ = jw.AtKey("human_url").GetString()
	sh.checkText, _ = jw.AtKey("proof_text_check").GetString()
	return
}

func (sh SigHints) Lookup(i SigId) *SigHint {
	obj, _ := sh.hints[i]
	return obj
}

func NewSigHints(jw *jsonw.Wrapper, uid UID, dirty bool) (sh *SigHints, err error) {
	sh = &SigHints{uid: uid, dirty: dirty, version: 0}
	err = sh.PopulateWith(jw)
	if err != nil {
		sh = nil
	}
	return
}

func (sh *SigHints) PopulateWith(jw *jsonw.Wrapper) (err error) {

	if jw == nil || jw.IsNil() {
		return
	}

	jw.AtKey("version").GetIntVoid(&sh.version, &err)
	if err != nil {
		return
	}

	sh.hints = make(map[SigId]*SigHint)
	var n int
	n, err = jw.AtKey("hints").Len()
	if err != nil {
		return
	}

	for i := 0; i < n; i++ {
		hint, tmpe := NewSigHint(jw.AtKey("hints").AtIndex(i))
		if tmpe != nil {
			G.Log.Warning("Bad SigHint Loaded: %s", tmpe.Error())
		} else {
			sh.hints[*hint.sigId] = hint
		}
	}
	return
}

func (sh SigHint) MarshalToJson() *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("sig_id", jsonw.NewString(sh.sigId.ToString(true)))
	ret.SetKey("remote_id", jsonw.NewString(sh.remoteId))
	ret.SetKey("api_url", jsonw.NewString(sh.apiUrl))
	ret.SetKey("human_url", jsonw.NewString(sh.humanUrl))
	ret.SetKey("proof_text_check", jsonw.NewString(sh.checkText))
	return ret
}

func (sh SigHints) MarshalToJson() *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("version", jsonw.NewInt(sh.version))
	ret.SetKey("hints", jsonw.NewArray(len(sh.hints)))
	i := 0
	for _, v := range sh.hints {
		ret.AtKey("hints").SetIndex(i, v.MarshalToJson())
		i++
	}
	return ret
}

func (sh *SigHints) Store() (err error) {
	uid_s := sh.uid.String()
	G.Log.Debug("+ SigHints.Store() for uid=%s", uid_s)
	if sh.dirty {
		err = G.LocalDb.Put(
			DbKey{Typ: DB_SIG_HINTS, Key: uid_s},
			[]DbKey{},
			sh.MarshalToJson(),
		)
		sh.dirty = false
	} else {
		G.Log.Debug("| SigHints.Store() skipped; wasn't dirty")
	}
	G.Log.Debug("- SigHints.Store() for uid=%s -> %v", uid_s, ErrToOk(err))
	return err
}

func LoadSigHints(uid UID) (sh *SigHints, err error) {
	uid_s := uid.String()
	G.Log.Debug("+ LoadSigHints(%s)", uid_s)
	var jw *jsonw.Wrapper
	jw, err = G.LocalDb.Get(DbKey{Typ: DB_SIG_HINTS, Key: uid_s})
	if err != nil {
		return
	}
	sh, err = NewSigHints(jw, uid, false)
	if err == nil {
		G.Log.Debug("| SigHints loaded @v%d", sh.version)
	}
	G.Log.Debug("- LoadSigHints(%s)", uid_s)
	return
}

func (sh *SigHints) Refresh() error {
	uid_s := sh.uid.String()
	G.Log.Debug("+ Refresh SigHints() for uid=%s", uid_s)
	res, err := G.API.Get(ApiArg{
		Endpoint:    "sig/hints",
		NeedSession: false,
		Args: HttpArgs{
			"uid": S{uid_s},
			"low": I{sh.version},
		},
	})
	if err != nil {
		return err
	}
	var n int
	n, err = res.Body.AtKey("hints").Len()
	if err != nil {
		return err
	}
	if n == 0 {
		G.Log.Debug("| No changes; version %d was up-to-date", sh.version)
	} else if err = sh.PopulateWith(res.Body); err != nil {
		return err
	} else {
		sh.dirty = true
	}
	G.Log.Debug("- Refresh SigHints() for uid=%s", uid_s)
	return nil
}

func LoadAndRefreshSigHints(uid UID) (sh *SigHints, err error) {
	sh, err = LoadSigHints(uid)
	if err == nil {
		err = sh.Refresh()
	}
	return
}
