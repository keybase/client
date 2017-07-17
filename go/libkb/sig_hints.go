// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
	"golang.org/x/net/context"
)

type SigHint struct {
	sigID     keybase1.SigID
	remoteID  string
	apiURL    string
	humanURL  string
	checkText string
}

func (sh SigHint) GetHumanURL() string  { return sh.humanURL }
func (sh SigHint) GetAPIURL() string    { return sh.apiURL }
func (sh SigHint) GetCheckText() string { return sh.checkText }

type SigHints struct {
	Contextified
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

func (sh *SigHints) Store(ctx context.Context) (err error) {
	sh.G().Log.CDebugf(ctx, "+ SigHints.Store() for uid=%s", sh.uid)
	if sh.dirty {
		err = sh.G().LocalDb.Put(DbKeyUID(DBSigHints, sh.uid), []DbKey{}, sh.MarshalToJSON())
		sh.dirty = false
	} else {
		sh.G().Log.CDebugf(ctx, "| SigHints.Store() skipped; wasn't dirty")
	}
	sh.G().Log.CDebugf(ctx, "- SigHints.Store() for uid=%s -> %v", sh.uid, ErrToOk(err))
	return err
}

func LoadSigHints(ctx context.Context, uid keybase1.UID, g *GlobalContext) (sh *SigHints, err error) {
	g.Log.CDebugf(ctx, "+ LoadSigHints(%s)", uid)
	var jw *jsonw.Wrapper
	jw, err = g.LocalDb.Get(DbKeyUID(DBSigHints, uid))
	if err != nil {
		return
	}
	// jw might be nil here, but that's allowed.
	sh, err = NewSigHints(jw, uid, false, g)
	if err == nil {
		g.Log.CDebugf(ctx, "| SigHints loaded @v%d", sh.version)
	}
	g.Log.CDebugf(ctx, "- LoadSigHints(%s)", uid)
	return
}

func (sh *SigHints) Refresh(ctx context.Context) (err error) {
	defer sh.G().CTrace(ctx, fmt.Sprintf("Refresh SigHints for uid=%s", sh.uid), func() error { return err })()
	res, err := sh.G().API.Get(APIArg{
		Endpoint:    "sig/hints",
		SessionType: APISessionTypeNONE,
		Args: HTTPArgs{
			"uid": UIDArg(sh.uid),
			"low": I{sh.version},
		},
		NetContext: ctx,
	})
	if err != nil {
		return err
	}

	return sh.RefreshWith(ctx, res.Body)
}

func (sh *SigHints) RefreshWith(ctx context.Context, jw *jsonw.Wrapper) (err error) {
	defer sh.G().CTrace(ctx, "RefreshWith", func() error { return err })()

	n, err := jw.AtKey("hints").Len()
	if err != nil {
		return err
	}
	if n == 0 {
		sh.G().Log.CDebugf(ctx, "| No changes; version %d was up-to-date", sh.version)
	} else if err = sh.PopulateWith(jw); err != nil {
		return err
	} else {
		sh.dirty = true
	}
	return nil
}

func LoadAndRefreshSigHints(ctx context.Context, uid keybase1.UID, g *GlobalContext) (sh *SigHints, err error) {
	sh, err = LoadSigHints(ctx, uid, g)
	if err == nil {
		err = sh.Refresh(ctx)
	}
	return
}
