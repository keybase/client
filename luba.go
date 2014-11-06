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

	var best, kb, soc, fp AssertionUrl

	for _, u := range urls {
		if u.IsKeybase() {
			kb = u
			break
		} else if u.IsFingerprint() && fp == nil {
			fp = u
		} else if u.IsSocial() && soc == nil {
			soc = u
		}
	}
	if best == nil {
		best = kb
	}
	if best == nil {
		best = fp
	}
	if best == nil {
		best = soc
	}
	if best == nil {
		best = urls[0]
	}
	return best.ToString()
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

	return
}
