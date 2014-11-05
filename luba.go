package libkb

// LUBA = LoadUserByAssertions
//
//  Given an string of the form foo@github+max+boo@twitter,
//  first load the user, and then check all assertions.
//
//  Have to identify the user first via remote-proof-checking.
//

type LubaRes struct {
	User       *User
	Error      error
	AE         AssertionExpression
	Warnings   []error
	TrackDiffs []TrackDiff
}

func LoadUserByAssertions(a string) (res LubaRes) {
	res.Load(a)
	return
}

func (l *LubaRes) Load(a string) {

	// Parse with the full grammar (including OR clauses)
	if l.AE, l.Error = AssertionParse(a); l.Error != nil {
		return
	}

	// But then vomit if we get an OR...
	if l.AE.HasOr() {
		l.Error = NewAssertionParseError("Bad assertion; had an OR construction")
		return
	}

	return
}
