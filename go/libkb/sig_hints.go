package libkb

import (
	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

type SigHint struct {
	sigID     keybase1.SigID
	remoteID  string
	apiURL    string
	humanURL  string
	checkText string
}

func (sh SigHint) GetHumanURL() string  { return sh.humanURL }
func (sh SigHint) GetApiUrl() string    { return sh.apiURL }
func (sh SigHint) GetCheckText() string { return sh.checkText }

type SigHints struct {
	uid     keybase1.UID
	version int
	hints   map[keybase1.SigID]*SigHint
	dirty   bool
}

func NewSigHint(jw *jsonw.Wrapper) (sh *SigHint, err error) {
	sh = &SigHint{}
	sh.sigID, err = GetSigID(jw.AtKey("sig_id"), true)
	sh.remoteID, _ = jw.AtKey("remote_id").GetString()
	sh.apiURL, _ = jw.AtKey("api_url").GetString()
	sh.humanURL, _ = jw.AtKey("human_url").GetString()
	sh.checkText, _ = jw.AtKey("proof_text_check").GetString()
	return
}

func (sh SigHints) Lookup(i keybase1.SigID) *SigHint {
	obj := sh.hints[i]
	return obj
}

func NewSigHints(jw *jsonw.Wrapper, uid keybase1.UID, dirty bool) (sh *SigHints, err error) {
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

	sh.hints = make(map[keybase1.SigID]*SigHint)
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
			sh.hints[hint.sigID] = hint
		}
	}
	return
}

func (sh SigHint) MarshalToJSON() *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("sig_id", jsonw.NewString(sh.sigID.ToString(true)))
	ret.SetKey("remote_id", jsonw.NewString(sh.remoteID))
	ret.SetKey("api_url", jsonw.NewString(sh.apiURL))
	ret.SetKey("human_url", jsonw.NewString(sh.humanURL))
	ret.SetKey("proof_text_check", jsonw.NewString(sh.checkText))
	return ret
}

func (sh SigHints) MarshalToJSON() *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("version", jsonw.NewInt(sh.version))
	ret.SetKey("hints", jsonw.NewArray(len(sh.hints)))
	i := 0
	for _, v := range sh.hints {
		ret.AtKey("hints").SetIndex(i, v.MarshalToJSON())
		i++
	}
	return ret
}

func (sh *SigHints) Store() (err error) {
	G.Log.Debug("+ SigHints.Store() for uid=%s", sh.uid)
	if sh.dirty {
		err = G.LocalDb.Put(DbKeyUID(DB_SIG_HINTS, sh.uid), []DbKey{}, sh.MarshalToJSON())
		sh.dirty = false
	} else {
		G.Log.Debug("| SigHints.Store() skipped; wasn't dirty")
	}
	G.Log.Debug("- SigHints.Store() for uid=%s -> %v", sh.uid, ErrToOk(err))
	return err
}

func LoadSigHints(uid keybase1.UID) (sh *SigHints, err error) {
	G.Log.Debug("+ LoadSigHints(%s)", uid)
	var jw *jsonw.Wrapper
	jw, err = G.LocalDb.Get(DbKeyUID(DB_SIG_HINTS, uid))
	if err != nil {
		return
	}
	sh, err = NewSigHints(jw, uid, false)
	if err == nil {
		G.Log.Debug("| SigHints loaded @v%d", sh.version)
	}
	G.Log.Debug("- LoadSigHints(%s)", uid)
	return
}

func (sh *SigHints) Refresh() error {
	G.Log.Debug("+ Refresh SigHints() for uid=%s", sh.uid)
	res, err := G.API.Get(ApiArg{
		Endpoint:    "sig/hints",
		NeedSession: false,
		Args: HttpArgs{
			"uid": UIDArg(sh.uid),
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
	G.Log.Debug("- Refresh SigHints() for uid=%s", sh.uid)
	return nil
}

func LoadAndRefreshSigHints(uid keybase1.UID) (sh *SigHints, err error) {
	sh, err = LoadSigHints(uid)
	if err == nil {
		err = sh.Refresh()
	}
	return
}
