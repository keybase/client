// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvl

import (
	"testing"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func sampleState() PvlScriptState {
	var sampleVars = PvlScriptVariables{
		UsernameService: "kronk",
		UsernameKeybase: "kronk_on_kb",
		Sig:             []byte{1, 2, 3, 4, 5},
		SigIDMedium:     "sig%{sig_id_medium}.*$(^)\\/",
		SigIDShort:      "000",
		Hostname:        "%{sig_id_medium}",
	}

	var sampleState = PvlScriptState{
		WhichScript:  0,
		PC:           0,
		Service:      keybase1.ProofType_TWITTER,
		Vars:         sampleVars,
		ActiveString: "",
		FetchURL:     "<<NONE>>",
		HasFetched:   false,
		FetchResult:  nil,
	}

	return sampleState
}

type pvlSubstituteTest struct {
	shouldwork bool
	service    keybase1.ProofType
	numbered   []string
	a, b       string
}

var pvlSubstituteTests = []pvlSubstituteTest{
	{true, keybase1.ProofType_TWITTER, nil,
		"%{}", "%{}"},
	{true, keybase1.ProofType_TWITTER, nil,
		"%{username_service}", "kronk"},
	{true, keybase1.ProofType_GENERIC_WEB_SITE, nil,
		"%{hostname}", "%\\{sig_id_medium\\}"},
	{true, keybase1.ProofType_TWITTER, nil,
		"x%{username_service}y%{sig_id_short}z", "xkronky000z"},
	{true, keybase1.ProofType_TWITTER, nil,
		"http://git(?:hub)?%{username_service}/%20%%{sig_id_short}}{}", "http://git(?:hub)?kronk/%20%000}{}"},
	{true, keybase1.ProofType_DNS, nil,
		"^%{hostname}/(?:.well-known/keybase.txt|keybase.txt)$", "^%\\{sig_id_medium\\}/(?:.well-known/keybase.txt|keybase.txt)$"},
	{true, keybase1.ProofType_TWITTER, nil,
		"^.*%{sig_id_short}.*$", "^.*000.*$"},
	{true, keybase1.ProofType_TWITTER, nil,
		"^keybase-site-verification=%{sig_id_short}$", "^keybase-site-verification=000$"},
	{true, keybase1.ProofType_TWITTER, nil,
		"^%{sig_id_medium}$", "^sig%\\{sig_id_medium\\}\\.\\*\\$\\(\\^\\)\\\\/$"},
	{true, keybase1.ProofType_TWITTER, nil,
		"%{username_keybase}:%{sig}", "kronk_on_kb:AQIDBAU="},
	{false, keybase1.ProofType_TWITTER, nil,
		"%{badvar}", ""},
	{false, keybase1.ProofType_TWITTER, nil,
		"%{hostname}", ""},
	{false, keybase1.ProofType_DNS, nil,
		"%{username_service}", ""},
}

func TestPvlSubstitute(t *testing.T) {
	for i, test := range pvlSubstituteTests {
		state := sampleState()
		state.Service = test.service
		res, err := pvlSubstitute(test.a, state, test.numbered)
		if (err == nil) != test.shouldwork {
			t.Fatalf("%v error mismatch: %v %v %v", i, test.shouldwork, err, res)
		}
		if err == nil && res != test.b {
			t.Logf("%v lens: %v %v", i, len(res), len(test.b))
			t.Fatalf("%v wrong substitute result\n%v\n%v\n%v",
				i, test.a, res, test.b)
		}
	}
}
