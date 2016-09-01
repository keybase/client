// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvl

import (
	"fmt"
	"log"
	"sort"
	"strings"
	"testing"

	"github.com/PuerkitoBio/goquery"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
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

type serviceToStringTest struct {
	service    keybase1.ProofType
	name       string
	shouldwork bool
	status     keybase1.ProofStatus
}

var serviceToStringTests = []serviceToStringTest{
	{keybase1.ProofType_DNS, "dns", true, keybase1.ProofStatus_NONE},
	{keybase1.ProofType_GENERIC_WEB_SITE, "generic_web_site", true, 0},
	{keybase1.ProofType(-12), "", false, keybase1.ProofStatus_INVALID_PVL},
}

func TestPvlServiceToString(t *testing.T) {
	for i, test := range serviceToStringTests {
		name, err := pvlServiceToString(test.service)
		switch {
		case (err == nil) != test.shouldwork:
			t.Fatalf("%v err %v", i, err)
		case !test.shouldwork && (err.GetProofStatus() != test.status):
			t.Fatalf("%v status %v", i, err.GetProofStatus())
		case test.name != name:
			t.Fatalf("%v name %v %v", i, test.name, name)
		}
	}
}

type pvlJSONHasKeyTest struct {
	json *jsonw.Wrapper
	key  string
	has  bool
}

var pvlJSONHasKeyTests = []pvlJSONHasKeyTest{
	{jsonw.NewBool(true), "foo", false},
	{makeJSONDangerous(`{"foo": "bar"}`), "foo", true},
	{makeJSONDangerous(`{"baz": "bar"}`), "foo", false},
	{makeJSONDangerous(`[0, 1, 2]`), "0", false},
}

func TestPvlJSONHasKey(t *testing.T) {
	for i, test := range pvlJSONHasKeyTests {
		if pvlJSONHasKey(test.json, test.key) != test.has {
			t.Fatalf("%v %v", i, !test.has)
		}
		if pvlJSONHasKeyCommand(test.json, PvlCommandName(test.key)) != test.has {
			t.Fatalf("%v %v", i, !test.has)
		}
	}
}

type pvlSubstituteTest struct {
	shouldwork bool
	service    keybase1.ProofType
	numbered   []string
	a, b       string
}

var pvlSubstituteTests = []pvlSubstituteTest{
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
		"%{}", "%{}"},
	{false, keybase1.ProofType_TWITTER, nil,
		"%{bad}", ""},

	{false, keybase1.ProofType_TWITTER, nil,
		"%{hostname}", ""},
	{false, keybase1.ProofType_DNS, nil,
		"%{username_service}", ""},
	{false, keybase1.ProofType_GENERIC_WEB_SITE, nil,
		"%{username_service}", ""},

	{true, keybase1.ProofType_TWITTER, []string{"zero", "one", "two", "three"},
		"%{0}:%{3}", "zero:three"},
	{true, keybase1.ProofType_TWITTER, []string{"zero"},
		"%{-1}", "%{-1}"},
	{false, keybase1.ProofType_TWITTER, []string{"zero", "one"},
		"%{0}:%{1}:%{2}", ""},
	{false, keybase1.ProofType_TWITTER, nil,
		"%{1}", ""},
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

type pvlJSONUnpackArrayTest struct {
	json       *jsonw.Wrapper
	shouldwork bool
	out        []*jsonw.Wrapper
}

var pvlJSONUnpackArrayTests = []pvlJSONUnpackArrayTest{
	{makeJSONDangerous("1"), false, nil},
	{makeJSONDangerous(`"hey"`), false, nil},
	{makeJSONDangerous(`{"a": "b"}`), false, nil},
	{makeJSONDangerous(`[1, {"a": "b"}, "three"]`), true, []*jsonw.Wrapper{
		makeJSONDangerous(`1`), makeJSONDangerous(`{"a": "b"}`), makeJSONDangerous(`"three"`),
	}},
}

func TestPvlJSONUnpackArray(t *testing.T) {
	for i, test := range pvlJSONUnpackArrayTests {
		ar, err := pvlJSONUnpackArray(test.json)
		if (err == nil) != test.shouldwork {
			t.Fatalf("%v err %v", i, err)
		}
		if len(ar) != len(test.out) {
			t.Fatalf("%v len %v %v", i, len(ar), len(test.out))
		}
		for j, x := range ar {
			y := test.out[j]
			a, err := x.Marshal()
			if err != nil {
				t.Fatalf("%v", i)
			}
			b, err := y.Marshal()
			if err != nil {
				t.Fatalf("%v", i)
			}
			if string(a) != string(b) {
				t.Fatalf("%v,%v mismatch %v %v", i, j, string(a), string(b))
			}
		}
	}
}

type pvlJSONGetChildrenTest struct {
	json       *jsonw.Wrapper
	shouldwork bool
	out        []*jsonw.Wrapper
}

var pvlJSONGetChildrenTests = []pvlJSONGetChildrenTest{
	{makeJSONDangerous("1"), false, nil},
	{makeJSONDangerous(`"hey"`), false, nil},
	{makeJSONDangerous(`{"a": "b", "1": 2}`), true, []*jsonw.Wrapper{
		makeJSONDangerous(`"b"`), makeJSONDangerous(`2`),
	}},
	{makeJSONDangerous(`[1, {"a": "b"}, "three"]`), true, []*jsonw.Wrapper{
		makeJSONDangerous(`1`), makeJSONDangerous(`{"a": "b"}`), makeJSONDangerous(`"three"`),
	}},
}

func TestPvlJSONGetChildren(t *testing.T) {
	for i, test := range pvlJSONGetChildrenTests {
		ar, err := pvlJSONGetChildren(test.json)
		if (err == nil) != test.shouldwork {
			t.Fatalf("%v err %v", i, err)
		}
		if len(ar) != len(test.out) {
			t.Fatalf("%v len %v %v", i, len(ar), len(test.out))
		}
		err = compareJSONStringLists(ar, test.out)
		if err != nil {
			t.Fatalf("%v error comparing: %v", i, err)
		}
	}
}

func compareJSONStringLists(xs, ys []*jsonw.Wrapper) error {
	a1, err := getJSONStringList(xs)
	if err != nil {
		return err
	}
	a2, err := getJSONStringList(ys)
	if err != nil {
		return err
	}
	sort.Strings(a1)
	sort.Strings(a2)
	if len(a1) != len(a2) {
		return fmt.Errorf("lists differ in length %v %v", len(a1), len(a2))
	}
	for i, s1 := range a1 {
		s2 := a2[i]
		if s1 != s2 {
			return fmt.Errorf("element [%v] differ\n%v\n%v", i, s1, s2)
		}
	}
	return nil
}

func getJSONStringList(xs []*jsonw.Wrapper) ([]string, error) {
	var ret []string
	for _, x := range xs {
		b, err := x.Marshal()
		if err != nil {
			return nil, err
		}
		ret = append(ret, string(b))
	}
	return ret, nil
}

type pvlJSONStringSimpleTest struct {
	shouldwork bool
	json       *jsonw.Wrapper
	out        string
}

var pvlJSONStringSimpleTests = []pvlJSONStringSimpleTest{
	{true, makeJSONDangerous("1"), "1"},
	{true, makeJSONDangerous(`"hey"`), "hey"},
	{true, makeJSONDangerous("true"), "true"},
	{true, makeJSONDangerous("false"), "false"},
	{true, makeJSONDangerous("null"), "null"},
	{false, makeJSONDangerous(`{"a": "b", "1": 2}`), ""},
	{false, makeJSONDangerous(`[1, {"a": "b"}, "three"]`), ""},
}

func TestPvlJSONStringSimple(t *testing.T) {
	for i, test := range pvlJSONStringSimpleTests {
		out, err := pvlJSONStringSimple(test.json)
		if (err == nil) != test.shouldwork {
			t.Fatalf("%v err %v", i, err)
		}
		if (err == nil) && (out != test.out) {
			t.Fatalf("%v mismatch\n%v\n%v", i, out, test.out)
		}
	}
}

type pvlSelectionContentsTest struct {
	html     *goquery.Document
	selector string
	useAttr  bool
	attr     string
	out      string
}

var pvlSelectionContentsDocument = makeHTMLDangerous(`
<html>
<head></head><div>a<span class="x" data-foo="y">b</span></div><div data-foo="z">c</div>
</html>
`)

var pvlSelectionContentsTests = []pvlSelectionContentsTest{
	{pvlSelectionContentsDocument, "div", false, "", "ab c"},
	{pvlSelectionContentsDocument, "span", false, "", "b"},
	{pvlSelectionContentsDocument, "span", true, "data-foo", "y"},
	{pvlSelectionContentsDocument, "div", true, "data-foo", "z"},
	{pvlSelectionContentsDocument, "span", true, "data-bar", ""},
	{pvlSelectionContentsDocument, "div", true, "data-baz", ""},
}

func TestPvlSelectionContents(t *testing.T) {
	for i, test := range pvlSelectionContentsTests {
		sel := test.html.Find(test.selector)
		out := pvlSelectionContents(sel, test.useAttr, test.attr)
		if out != test.out {
			t.Fatalf("%v mismatch\n%v\n%v", i, out, test.out)
		}
	}
}

// Test helpers

func makeJSONDangerous(json string) *jsonw.Wrapper {
	w, err := jsonw.Unmarshal([]byte(json))
	if err != nil {
		log.Panic(err)
	}
	return w
}

func canonicalizeJSONDangerous(json string) string {
	w := makeJSONDangerous(json)
	res, err := w.Marshal()
	if err != nil {
		log.Panic(err)
	}
	return string(res)
}

func makeHTMLDangerous(html string) *goquery.Document {
	reader := strings.NewReader(html)
	d, err := goquery.NewDocumentFromReader(reader)
	if err != nil {
		log.Panic(err)
	}
	return d
}
