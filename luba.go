package libkb

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

func (l *LubaRes) Load(a string, withTracking bool) {

	// Parse with the full grammar (including OR clauses)
	if l.AE, l.Error = AssertionParse(a); l.Error != nil {
		return
	}

	// But then vomit if we get an OR...
	if l.AE.HasOr() {
		l.Error = NewAssertionParseError("Bad assertion; had an OR construction")
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

	return
}
