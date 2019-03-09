// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

type SigHint struct {
	sigID     keybase1.SigID
	remoteID  string
	apiURL    string
	humanURL  string
	checkText string
	// `isVerified` indicates if the client generated the values or they were
	// received from the server and are trusted but not verified.
	isVerified bool
}

func (sh SigHint) GetHumanURL() string  { return sh.humanURL }
func (sh SigHint) GetAPIURL() string    { return sh.apiURL }
func (sh SigHint) GetCheckText() string { return sh.checkText }

func NewSigHint(jw *jsonw.Wrapper) (sh *SigHint, err error) {
	if jw == nil || !jw.IsOk() {
		return nil, nil
	}
	sh = &SigHint{}
	sh.sigID, err = GetSigID(jw.AtKey("sig_id"), true)
	sh.remoteID, _ = jw.AtKey("remote_id").GetString()
	sh.apiURL, _ = jw.AtKey("api_url").GetString()
	sh.humanURL, _ = jw.AtKey("human_url").GetString()
	sh.checkText, _ = jw.AtKey("proof_text_check").GetString()
	sh.isVerified, _ = jw.AtKey("isVerified").GetBool()
	return sh, err
}

func NewVerifiedSigHint(sigID keybase1.SigID, remoteID, apiURL, humanURL, checkText string) *SigHint {
	return &SigHint{
		sigID:      sigID,
		remoteID:   remoteID,
		apiURL:     apiURL,
		humanURL:   humanURL,
		checkText:  checkText,
		isVerified: true,
	}
}

func (sh SigHint) MarshalToJSON() *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("sig_id", jsonw.NewString(sh.sigID.ToString(true)))
	ret.SetKey("remote_id", jsonw.NewString(sh.remoteID))
	ret.SetKey("api_url", jsonw.NewString(sh.apiURL))
	ret.SetKey("human_url", jsonw.NewString(sh.humanURL))
	ret.SetKey("proof_text_check", jsonw.NewString(sh.checkText))
	ret.SetKey("is_verified", jsonw.NewBool(sh.isVerified))
	return ret
}

type SigHints struct {
	Contextified
	uid     keybase1.UID
	version int
	hints   map[keybase1.SigID]*SigHint
	dirty   bool
}

func NewSigHints(jw *jsonw.Wrapper, uid keybase1.UID, dirty bool, g *GlobalContext) (sh *SigHints, err error) {
	sh = &SigHints{
		uid:          uid,
		dirty:        dirty,
		version:      0,
		Contextified: NewContextified(g),
	}
	err = sh.PopulateWith(jw)
	if err != nil {
		sh = nil
	}
	return
}

func (sh SigHints) Lookup(i keybase1.SigID) *SigHint {
	obj := sh.hints[i]
	return obj
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
			sh.G().Log.Warning("Bad SigHint Loaded: %s", tmpe)
		} else {
			sh.hints[hint.sigID] = hint
		}
	}
	return
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

func (sh *SigHints) Store(m MetaContext) (err error) {
	m.Debug("+ SigHints.Store() for uid=%s", sh.uid)
	if sh.dirty {
		err = sh.G().LocalDb.Put(DbKeyUID(DBSigHints, sh.uid), []DbKey{}, sh.MarshalToJSON())
		sh.dirty = false
	} else {
		m.Debug("| SigHints.Store() skipped; wasn't dirty")
	}
	m.Debug("- SigHints.Store() for uid=%s -> %v", sh.uid, ErrToOk(err))
	return err
}

func LoadSigHints(m MetaContext, uid keybase1.UID) (sh *SigHints, err error) {
	defer m.Trace(fmt.Sprintf("+ LoadSigHints(%s)", uid), func() error { return err })()
	var jw *jsonw.Wrapper
	jw, err = m.G().LocalDb.Get(DbKeyUID(DBSigHints, uid))
	if err != nil {
		jw = nil
		m.Debug("| SigHints failed to access local storage: %s", err)
	}
	// jw might be nil here, but that's allowed.
	sh, err = NewSigHints(jw, uid, false, m.G())
	if err == nil {
		m.Debug("| SigHints loaded @v%d", sh.version)
	}
	m.Debug("- LoadSigHints(%s)", uid)
	return
}

func (sh *SigHints) Refresh(m MetaContext) (err error) {
	defer m.Trace(fmt.Sprintf("Refresh SigHints for uid=%s", sh.uid), func() error { return err })()
	res, err := m.G().API.Get(m, APIArg{
		Endpoint:    "sig/hints",
		SessionType: APISessionTypeNONE,
		Args: HTTPArgs{
			"uid": UIDArg(sh.uid),
			"low": I{sh.version},
		},
	})
	if err != nil {
		return err
	}

	return sh.RefreshWith(m, res.Body)
}

func (sh *SigHints) RefreshWith(m MetaContext, jw *jsonw.Wrapper) (err error) {
	defer m.Trace("RefreshWith", func() error { return err })()

	n, err := jw.AtKey("hints").Len()
	if err != nil {
		return err
	}
	if n == 0 {
		m.Debug("| No changes; version %d was up-to-date", sh.version)
	} else if err = sh.PopulateWith(jw); err != nil {
		return err
	} else {
		sh.dirty = true
	}
	return nil
}

func LoadAndRefreshSigHints(m MetaContext, uid keybase1.UID) (*SigHints, error) {
	sh, err := LoadSigHints(m, uid)
	if err != nil {
		return nil, err
	}
	if err = sh.Refresh(m); err != nil {
		return nil, err
	}
	return sh, nil
}
