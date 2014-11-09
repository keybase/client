package libkb

import (
	"fmt"
)

// LUBA = LoadUserByAssertions
//
//  Given an string of the form foo@github+max+boo@twitter,
//  first load the user, and then check all assertions.
//
//  Have to identify the user first via remote-proof-checking.
//

type LubaRes struct {
	User        *User
	Error       error
	AE          AssertionExpression
	Warnings    []error
	IdentifyRes *IdentifyRes
}

func LoadUserByAssertions(a string, withTracking bool) (res LubaRes) {
	res.Load(a, withTracking)
	return
}

func (l *LubaRes) FindBestComponent() string {
	urls := make([]AssertionUrl, 0, 1)
	urls = l.AE.CollectUrls(urls)
	if len(urls) == 0 {
		return ""
	}

	var uid, kb, soc, fp AssertionUrl

	for _, u := range urls {
		if u.IsUid() {
			uid = u
			break
		} else if u.IsKeybase() {
			kb = u
		} else if u.IsFingerprint() && fp == nil {
			fp = u
		} else if u.IsSocial() && soc == nil {
			soc = u
		}
	}

	order := []AssertionUrl{uid, kb, fp, soc, urls[0]}
	for _, p := range order {
		if p != nil {
			return p.ToString()
		}
	}
	return ""
}

func (l *LubaRes) Load(a string, withTracking bool) {

	// Parse assertion but don't allow OR operators, only
	// AND operators
	if l.AE, l.Error = AssertionParseAndOnly(a); l.Error != nil {
		return
	}

	var me *User
	if withTracking {
		me, l.Error = LoadMe()
		if l.Error != nil || me == nil {
			return
		}
	}

	// Next, pop off the 'best' assertion and load the user by it.
	// That is, it might be the keybase assertion (if there), or otherwise,
	// something that's unique like Twitter or Github, and lastly,
	// something like DNS that is more likely ambiguous...
	b := l.FindBestComponent()
	if len(b) == 0 {
		l.Error = fmt.Errorf("Cannot lookup user with '%s'", a)
		return
	}

	larg := LoadUserArg{
		Name:             b,
		RequirePublicKey: true,
	}

	if l.User, l.Error = LoadUser(larg); l.Error != nil {
		return
	}

	l.IdentifyRes = l.User.Identify(IdentifyArg{
		Me:         me,
		ReportHook: func(s string) { G.Log.Debug(s) },
	})
	if l.Error = l.IdentifyRes.GetError(); l.Error != nil {
		return
	}

	if !l.AE.MatchSet(*l.User.ToProofSet()) {
		// TODO - Better debugging?
		l.Error = fmt.Errorf("User %s didn't match given assertion",
			l.User.GetName())
	}

	return
}
