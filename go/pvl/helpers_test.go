// Copyright 2016 Keybase, Inc. All rights reserved. Use of
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

func sampleState() scriptState {
	var sampleVars = scriptVariables{
		UsernameService: "kronk",
		UsernameKeybase: "kronk_on_kb",
		Sig:             []byte{1, 2, 3, 4, 5},
		SigIDMedium:     "sig%{sig_id_medium}.*$(^)\\/",
		SigIDShort:      "000",
		Hostname:        "%{sig_id_medium}",
		Protocol:        "http",
	}

	var sampleState = scriptState{
		WhichScript:  0,
		PC:           0,
		Service:      keybase1.ProofType_TWITTER,
		Vars:         sampleVars,
		ActiveString: "whaaa",
		FetchURL:     "<<NONE>>",
		HasFetched:   false,
		fetchResult:  nil,
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

func TestServiceToString(t *testing.T) {
	for i, test := range serviceToStringTests {
		name, err := serviceToString(test.service)
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

type substituteTest struct {
	shouldwork    bool
	service       keybase1.ProofType
	numbered      []string
	allowedExtras []string
	a, b          string
}

var substituteTests = []substituteTest{
	{true, keybase1.ProofType_TWITTER, nil, nil,
		"%{username_service}", "kronk"},
	{true, keybase1.ProofType_GENERIC_WEB_SITE, nil, nil,
		"%{hostname}", "%\\{sig_id_medium\\}"},
	{true, keybase1.ProofType_TWITTER, nil, nil,
		"x%{username_service}y%{sig_id_short}z", "xkronky000z"},
	{true, keybase1.ProofType_TWITTER, nil, nil,
		"http://git(?:hub)?%{username_service}/%20%%{sig_id_short}}{}", "http://git(?:hub)?kronk/%20%000}{}"},
	{true, keybase1.ProofType_DNS, nil, nil,
		"^%{hostname}/(?:.well-known/keybase.txt|keybase.txt)$", "^%\\{sig_id_medium\\}/(?:.well-known/keybase.txt|keybase.txt)$"},
	{true, keybase1.ProofType_TWITTER, nil, nil,
		"^.*%{sig_id_short}.*$", "^.*000.*$"},
	{true, keybase1.ProofType_TWITTER, nil, nil,
		"^keybase-site-verification=%{sig_id_short}$", "^keybase-site-verification=000$"},
	{true, keybase1.ProofType_TWITTER, nil, nil,
		"^%{sig_id_medium}$", "^sig%\\{sig_id_medium\\}\\.\\*\\$\\(\\^\\)\\\\/$"},
	{true, keybase1.ProofType_TWITTER, nil, nil,
		"%{username_keybase}:%{sig}", "kronk_on_kb:AQIDBAU="},

	{false, keybase1.ProofType_TWITTER, nil, nil,
		"%{}", "%{}"},
	{false, keybase1.ProofType_TWITTER, nil, nil,
		"%{bad}", ""},

	{false, keybase1.ProofType_TWITTER, nil, nil,
		"%{hostname}", ""},
	{false, keybase1.ProofType_DNS, nil, nil,
		"%{username_service}", ""},
	{false, keybase1.ProofType_GENERIC_WEB_SITE, nil, nil,
		"%{username_service}", ""},

	{true, keybase1.ProofType_TWITTER, []string{"zero", "one", "two", "three"}, nil,
		"%{0}:%{3}", "zero:three"},
	{true, keybase1.ProofType_TWITTER, []string{"zero"}, nil,
		"%{-1}", "%{-1}"},
	{false, keybase1.ProofType_TWITTER, []string{"zero", "one"}, nil,
		"%{0}:%{1}:%{2}", ""},
	{false, keybase1.ProofType_TWITTER, nil, nil,
		"%{1}", ""},

	{false, keybase1.ProofType_TWITTER, nil, nil,
		"%{active_string}", ""},
	{true, keybase1.ProofType_TWITTER, nil, []string{"active_string"},
		"%{active_string}", "whaaa"},

	{false, keybase1.ProofType_TWITTER, nil, []string{},
		"%{hostname}", ""},
	{false, keybase1.ProofType_DNS, nil, []string{},
		"%{protocol}", ""},
	{true, keybase1.ProofType_DNS, nil, []string{},
		"%{hostname}", "%\\{sig_id_medium\\}"},
	{true, keybase1.ProofType_GENERIC_WEB_SITE, nil, []string{},
		"%{protocol}://%{hostname}", "http://%\\{sig_id_medium\\}"},
}

func TestSubstitute(t *testing.T) {
	for i, test := range substituteTests {
		state := sampleState()
		state.Service = test.service
		res, err := substitute(test.a, state, test.numbered, test.allowedExtras)
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

type jsonUnpackArrayTest struct {
	json       *jsonw.Wrapper
	shouldwork bool
	out        []*jsonw.Wrapper
}

var jsonUnpackArrayTests = []jsonUnpackArrayTest{
	{makeJSONDangerous("1"), false, nil},
	{makeJSONDangerous(`"hey"`), false, nil},
	{makeJSONDangerous(`{"a": "b"}`), false, nil},
	{makeJSONDangerous(`[1, {"a": "b"}, "three"]`), true, []*jsonw.Wrapper{
		makeJSONDangerous(`1`), makeJSONDangerous(`{"a": "b"}`), makeJSONDangerous(`"three"`),
	}},
}

func TestJSONUnpackArray(t *testing.T) {
	for i, test := range jsonUnpackArrayTests {
		ar, err := jsonUnpackArray(test.json)
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

type jsonGetChildrenTest struct {
	json       *jsonw.Wrapper
	shouldwork bool
	out        []*jsonw.Wrapper
}

var jsonGetChildrenTests = []jsonGetChildrenTest{
	{makeJSONDangerous("1"), false, nil},
	{makeJSONDangerous(`"hey"`), false, nil},
	{makeJSONDangerous(`{"a": "b", "1": 2}`), true, []*jsonw.Wrapper{
		makeJSONDangerous(`"b"`), makeJSONDangerous(`2`),
	}},
	{makeJSONDangerous(`[1, {"a": "b"}, "three"]`), true, []*jsonw.Wrapper{
		makeJSONDangerous(`1`), makeJSONDangerous(`{"a": "b"}`), makeJSONDangerous(`"three"`),
	}},
}

func TestJSONGetChildren(t *testing.T) {
	for i, test := range jsonGetChildrenTests {
		ar, err := jsonGetChildren(test.json)
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

type jsonStringSimpleTest struct {
	shouldwork bool
	json       *jsonw.Wrapper
	out        string
}

var jsonStringSimpleTests = []jsonStringSimpleTest{
	{true, makeJSONDangerous("1"), "1"},
	{true, makeJSONDangerous(`"hey"`), "hey"},
	{true, makeJSONDangerous("true"), "true"},
	{true, makeJSONDangerous("false"), "false"},
	{false, makeJSONDangerous("null"), ""},
	{false, makeJSONDangerous(`{"a": "b", "1": 2}`), ""},
	{false, makeJSONDangerous(`[1, {"a": "b"}, "three"]`), ""},
}

func TestJSONStringSimple(t *testing.T) {
	for i, test := range jsonStringSimpleTests {
		out, err := jsonStringSimple(test.json)
		if (err == nil) != test.shouldwork {
			t.Fatalf("%v err %v", i, err)
		}
		if (err == nil) && (out != test.out) {
			t.Fatalf("%v mismatch\n%v\n%v", i, out, test.out)
		}
	}
}

type selectionContentsTest struct {
	html     *goquery.Document
	selector string
	useAttr  bool
	attr     string
	out      string
}

var selectionContentsDocument = makeHTMLDangerous(`
<html>
<head></head><div>a<span class="x" data-foo="y">b</span></div><div data-foo="z">c</div>
</html>
`)

var selectionContentsTests = []selectionContentsTest{
	{selectionContentsDocument, "div", false, "", "ab c"},
	{selectionContentsDocument, "span", false, "", "b"},
	{selectionContentsDocument, "span", true, "data-foo", "y"},
	{selectionContentsDocument, "div", true, "data-foo", "z"},
	{selectionContentsDocument, "span", true, "data-bar", ""},
	{selectionContentsDocument, "div", true, "data-baz", ""},
}

func TestSelectionContents(t *testing.T) {
	for i, test := range selectionContentsTests {
		sel := test.html.Find(test.selector)
		out := selectionContents(sel, test.useAttr, test.attr)
		if out != test.out {
			t.Fatalf("%v mismatch\n%v\n%v", i, out, test.out)
		}
	}
}

func TestPyindex(t *testing.T) {
	tests := []struct {
		index int
		len   int
		x     int
		ok    bool
	}{
		{0, 0, 0, false},
		{0, -1, 0, false},
		{0, 4, 0, true},
		{3, 4, 3, true},
		{4, 4, 0, false},
		{5, 4, 0, false},
		{-1, 4, 3, true},
		{-2, 4, 2, true},
		{-4, 4, 0, true},
		{-5, 4, 0, false},
	}

	for i, test := range tests {
		x, ok := pyindex(test.index, test.len)
		if (x != test.x) || (ok != test.ok) {
			t.Fatalf("%v mismatch (%v, %v):\n  expected %v %v\n  got %v %v",
				i, test.index, test.len, test.x, test.ok, x, ok)
		}
	}
}

func TestValidateDomain(t *testing.T) {
	tests := []struct {
		s  string
		ok bool
	}{
		{"example.com", true},
		{"www.example.com", true},
		{"com.", true},

		{"example.com:8080", false},
		{"www.example.com:8080", false},
		{"http://example.com", false},
		{"example.com/", false},
		{"example.com/123", false},
		{"example.com?a=b", false},
		{"example.com#2", false},
		{"http://http://", false},
		{"http://http://example.com", false},
		{"http://http:/example.com", false},

		{"http://ht$%$&$tp:/example.com", false},
	}

	for i, test := range tests {
		ans := validateDomain(test.s)
		if ans != test.ok {
			t.Fatalf("%v mismatch: %v\ngot      : %v\nexpected : %v\n", i, test.s, ans, test.ok)
		}
	}
}

func TestValidateProtocol(t *testing.T) {
	tests := []struct {
		s        string
		allowed  []string
		expected string
		ok       bool
	}{
		{"http", []string{"http", "https"}, "http", true},
		{"http:", []string{"http", "https"}, "http", true},
		{"https:", []string{"http", "https"}, "https", true},

		{"http", []string{"https"}, "http", false},
		{"dns", []string{"http", "https"}, "dns", false},

		{"spdy", []string{"http", "https"}, "", false},
	}

	for i, test := range tests {
		a, b := validateProtocol(test.s, test.allowed)
		if !(a == test.expected && b == test.ok) {
			t.Fatalf("%v mismatch: %v\ngot      : %v %v\nexpected : %v %v\n",
				i, test.s, test.expected, test.ok, a, b)
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
