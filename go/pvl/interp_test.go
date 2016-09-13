// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvl

import (
	"fmt"
	"strings"
	"testing"

	"github.com/PuerkitoBio/goquery"
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

type interpUnitTest struct {
	name      string
	proofinfo ProofInfo
	prepvl    map[keybase1.ProofType]string
	service   keybase1.ProofType

	// What api call to expect
	restype     libkb.XAPIResType
	resjson     string
	reshtml     string
	restext     string
	urloverride string
	// (Optional) Expect a different url to be fetched than proofinfo.APIURL

	// Whether the proof should validate
	shouldwork bool
	// (Optional) error status must equal. Must be specified for INVALID_PVL
	errstatus keybase1.ProofStatus
	// (Optional) error string must equal
	errstr string
}

var interpUnitTests = []interpUnitTest{
	// # Basic tests
	{
		name:      "basichtml",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_TWITTER: `[
{"assert_regex_match": "^https://rooter\\.example\\.com/proofs/%{username_service}/[\\d]+\\.htjsxt$"},
{"fetch": "html"},
{"selector_css": [".twit", 0]},
{"whitespace_normalize": true},
{"assert_regex_match": "^.*goodproof.*$"}
]`},
		service:    keybase1.ProofType_TWITTER,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: true,
	},

	// # Tests for individual valid instructions.
	// Test match and fail of each instruction.

	// ## AssertRegexMatch,
	{
		name:      "AssertRegexMatch-url-ok",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_COINBASE: `[
{"assert_regex_match": "^https://rooter\\.example\\.com/proofs/%{username_service}/[\\d]+\\.htjsxt$"},
{"fetch": "string"}
]`},
		service:    keybase1.ProofType_COINBASE,
		restype:    libkb.XAPIResText,
		restext:    "1234",
		shouldwork: true,
	}, {
		name:      "AssertRegexMatch-url-fail",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_HACKERNEWS: `[
{"assert_regex_match": "^https://rooter\\.example\\.com/proofs/%{username_service}/+\\.htjsxt$"},
{"fetch": "string"}
]`},
		service:    keybase1.ProofType_HACKERNEWS,
		restype:    libkb.XAPIResText,
		restext:    "1234",
		shouldwork: false,
	}, {
		name:      "AssertRegexMatch-content-ok",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_REDDIT: `[
{"fetch": "html"},
{"selector_css": [".twit", -1]},
{"whitespace_normalize": true},
{"assert_regex_match": "^short %{sig_id_short}$"}
]`},
		service:    keybase1.ProofType_REDDIT,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: true,
	}, {
		name:      "AssertRegexMatch-content-fail",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_TWITTER: `[
{"fetch": "html"},
{"selector_css": [".twit", -1]},
{"whitespace_normalize": true},
{"assert_regex_match": "^wrong %{sig_id_short}$"}
]`},
		service:    keybase1.ProofType_TWITTER,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
	}, {
		name:      "AssertRegexMatch-content-fail-case",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_TWITTER: `[
{"fetch": "html"},
{"selector_css": [".twit", -1]},
{"assert_regex_match": "^.*SHORT.*$"}
]`},
		service:    keybase1.ProofType_TWITTER,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
	},

	// ## AssertFindBase64,
	{
		name:      "AssertFindBase64-ok",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GENERIC_WEB_SITE: `[
{"fetch": "string"},
{"assert_find_base64": "sig"}
]`},
		service: keybase1.ProofType_GENERIC_WEB_SITE,
		restype: libkb.XAPIResText,
		// the sig must be on a line with only spacing.
		restext:    fmt.Sprintf(" asdf\n  \t\t .\n %v\t\nzad\t.\n", sig1),
		shouldwork: true,
	}, {
		name:      "AssertFindBase64-fail",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GENERIC_WEB_SITE: `[
{"fetch": "string"},
{"assert_find_base64": "sig"}
]`},
		service:    keybase1.ProofType_GENERIC_WEB_SITE,
		restype:    libkb.XAPIResText,
		restext:    sig1[1:],
		shouldwork: false,
	},

	// ## WhitespaceNormalize,
	{
		name:      "WhitespaceNormalize-ok",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GENERIC_WEB_SITE: `[
{"fetch": "string"},
{"assert_regex_match": "^[\\s\\S]*\\t[\\s\\S]*$"},
{"whitespace_normalize": true},
{"assert_regex_match": "^A b c de f$", "case_insensitive": true}
]`},
		service:    keybase1.ProofType_GENERIC_WEB_SITE,
		restype:    libkb.XAPIResText,
		restext:    "a b   \tc\tde  \n\tf",
		shouldwork: true,
	},

	// ## RegexCapture,
	{
		name:      "RegexCapture-ok-ignoregroup",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GENERIC_WEB_SITE: `[
{"fetch": "html"},
{"selector_css": ["div.twit", -1]},
{"whitespace_normalize": true},
{"regex_capture": "^(?:sHoRt) ([A-Za-z0-9+/=]+)$", "case_insensitive": true},
{"assert_regex_match": "^%{sig_id_short}$"}
]`},
		service:    keybase1.ProofType_GENERIC_WEB_SITE,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: true,
	}, {
		// A repeated capture group returns its last match.
		name:      "RegexCapture-ok-multimatch",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GENERIC_WEB_SITE: `[
{"fetch": "html"},
{"selector_css": ["div.twit", -1]},
{"whitespace_normalize": true},
{"regex_capture": "^(short).*$"},
{"regex_capture": "^(\\w)+$"},
{"assert_regex_match": "^t$"}
]`},
		service:    keybase1.ProofType_GENERIC_WEB_SITE,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: true,
	}, {
		name:      "RegexCapture-fail-nomatch",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GENERIC_WEB_SITE: `[
{"fetch": "html"},
{"selector_css": ["div.twit", -1]},
{"regex_capture": "^(nowhere)$", "case_insensitive": true}
]`},
		service:    keybase1.ProofType_GENERIC_WEB_SITE,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
	}, {
		name:      "RegexCapture-fail-nogroup",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GENERIC_WEB_SITE: `[
{"fetch": "html"},
{"selector_css": ["div.twit", -1]},
{"whitespace_normalize": true},
{"regex_capture": "^sHoRt.*$", "case_insensitive": true},
{"assert_regex_match": "^%{sig_id_short}$/s"}
]`},
		service:    keybase1.ProofType_GENERIC_WEB_SITE,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
	},

	// ## Fetch,
	{
		name:      "Fetch-string",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[
{"fetch": "string"},
{"assert_regex_match": "^str9\n$"}
]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResText,
		restext:    "str9\n",
		shouldwork: true,
	}, {
		name:      "Fetch-html",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[
{"fetch": "html"},
{"selector_css": ["head title"]},
{"assert_regex_match": "^proofer$"}
]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: true,
	}, {
		name:      "Fetch-json",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[
{"fetch": "json"},
{"selector_json": ["data", 2, "type"]},
{"assert_regex_match": "^useful$"}
]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResJSON,
		resjson:    json1,
		shouldwork: true,
	},

	// ## SelectorJSON,
	{
		name:      "SelectorJSON-simple",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[
{"fetch": "json"},
{"selector_json": ["data", 2, "type"]},
{"assert_regex_match": "^useful$"}
]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResJSON,
		resjson:    json1,
		shouldwork: true,
	}, {
		name:      "SelectorJSON-index-dne",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[
{"fetch": "json"},
{"selector_json": ["data", 500]}
]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResJSON,
		resjson:    json1,
		shouldwork: false,
	}, {
		name:      "SelectorJSON-key-dne",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[
{"fetch": "json"},
{"selector_json": ["data", "a500"]}
]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResJSON,
		resjson:    json1,
		shouldwork: false,
	}, {
		name:      "SelectorJSON-index-neg",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[
{"fetch": "json"},
{"selector_json": ["data", -1, "poster"]},
{"assert_regex_match": "^eve$"}
]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResJSON,
		resjson:    json1,
		shouldwork: true,
	}, {
		name:      "SelectorJSON-index-all",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[
{"fetch": "json"},
{"selector_json": ["data", {"all": true}, "poster"]},
{"assert_regex_match": "^kronk eve$"}
]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResJSON,
		resjson:    json1,
		shouldwork: true,
	},

	// ## SelectorCSS,
	{
		name:      "SelectorCSS-ok",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[
{"fetch": "html"},
{"selector_css": ["body .twit", -1]},
{"whitespace_normalize": true},
{"assert_regex_match": "^short %{sig_id_short}$"}
]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: true,
	}, {
		name:      "SelectorCSS-fail-dontcrash",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[
{"fetch": "html"},
{"selector_css": ["body .twit:eq(0)"]},
{"assert_regex_match": "^$"}
]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
	}, {
		name:      "SelectorCSS-ok-multi",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[
{"fetch": "html"},
{"selector_css": ["body .twit"],
 "multi": true},
{"assert_regex_match": "^[\\s\\S]*goodproof[\\s\\S]*evil\\.com[\\s\\S]*short[\\s\\S]*$"}
]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: true,
	}, {
		name:      "SelectorCSS-fail-nonmulti",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[
{"fetch": "html"},
{"selector_css": ["body .twit"]},
{"whitespace_normalize": true},
{"assert_regex_match": "^short %{sig_id_short}$"}
]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
	}, {
		name:      "SelectorCSS-ok-attr",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[
{"fetch": "html"},
{"selector_css": ["body .twit[data-x]"],
 "attr": "data-x"},
{"assert_regex_match": "^y$"}
]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: true,
	}, {
		name:      "SelectorCSS-ok-attr-dne",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[
{"fetch": "html"},
{"selector_css": ["body .twit"],
 "multi": true,
 "attr": "dne"},
{"assert_regex_match": "^$"}
]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: true,
	},

	// ## TransformURL,
	{
		name:      "SelectorTransformURL-ok",
		proofinfo: info1,
		// Swap some parts of the paths. Also use an ignored capture group.
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[
{"transform_url": "^https://rooter.example.com/(\\w+)/(?:%{username_service})/([^/])+\\.(htjsxt)$",
 "to": "https://rooter.example.com/%{username_keybase}/keybase/%{1}/%{2}.%{3}"},
{"assert_regex_match": "^https://rooter.example.com/kronk/keybase/proofs/5\\.htjsxt$"},
{"fetch": "string"},
{"assert_regex_match": "^ok$"}
]`},
		service:     keybase1.ProofType_GITHUB,
		restype:     libkb.XAPIResText,
		restext:     "ok",
		urloverride: "https://rooter.example.com/kronk/keybase/proofs/5.htjsxt",
		shouldwork:  true,
	}, {
		name:      "SelectorTransformURL-fail-afterfetch",
		proofinfo: info1,
		// Swap some parts of the paths. Also use an ignored capture group.
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[
{"fetch": "string"},
{"transform_url": "^$", "to": "^$"}
]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResText,
		restext:    "ok",
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:      "SelectorTransformURL-fail-nomatch",
		proofinfo: info1,
		// Swap some parts of the paths. Also use an ignored capture group.
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[
{"transform_url": "^$", "to": "^$"},
{"fetch": "string"}
]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResText,
		restext:    "ok",
		shouldwork: false,
	}, {
		name:      "SelectorTransformURL-fail-badsub",
		proofinfo: info1,
		// Swap some parts of the paths. Also use an ignored capture group.
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[
{"transform_url": "^(.*)$",
 "to": "%{2}"},
{"fetch": "string"}
]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResText,
		restext:    "ok",
		shouldwork: false,
	},

	// # Tests for invalid PVL at the top level

	// Empty service entries should fail.
	{
		name:      "omitted-service",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_TWITTER: `[{"fetch": "string"}]`,
		},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	},
}

func TestUnits(t *testing.T) {
	solo := ""
	for _, unit := range interpUnitTests {
		if len(solo) == 0 || unit.name == solo {
			t.Logf("Testing: %v", unit.name)
			runPvlTest(t, &unit)
		}
	}
	if len(solo) > 0 {
		// Soloing a test shall never be checked in.
		t.Fatalf("soloed a test that passed\n\n\n*\n*\n*\n*\n*\n*\n*")
	}
}

func runPvlTest(t *testing.T, unit *interpUnitTest) {
	fail := func(f string, arg ...interface{}) {
		f2 := fmt.Sprintf("[%v] ", unit.name) + f
		t.Fatalf(f2, arg...)
	}

	tc := libkb.SetupTest(t, unit.name, 1)
	g := tc.G
	xapi := newStubAPIEngine()
	g.XAPI = xapi

	pvl, err := makeTestPvl(unit.prepvl)
	if err != nil {
		fail("Error in prepvl: %v", err)
	}

	var url = unit.proofinfo.APIURL
	if unit.urloverride != "" {
		url = unit.urloverride
	}

	switch unit.restype {
	case libkb.XAPIResJSON:
		xapi.Set(url, newExternalJSONRes(t, unit.resjson))
	case libkb.XAPIResHTML:
		xapi.SetHTML(url, newExternalHTMLRes(t, unit.reshtml))
	case libkb.XAPIResText:
		xapi.SetText(url, newExternalTextRes(t, unit.restext))
	default:
		fail("unsupported restype: %v", unit.restype)
	}

	perr := CheckProof(g, pvl, unit.service, unit.proofinfo)
	if perr == nil {
		if !unit.shouldwork {
			fail("proof should have failed")
		}

		err = xapi.AssertCalledOnceWith(unit.restype, url)
		if err != nil {
			fail("%v", err)
		}
	} else {
		if unit.shouldwork {
			fail("proof failed: %v", perr)
		}
		none := keybase1.ProofStatus_NONE
		if unit.errstatus != none && perr.GetProofStatus() != unit.errstatus {
			fail("status mismatch:\n  expected: %v\n  got: %v", unit.errstatus, perr.GetProofStatus())
		}
		if len(unit.errstr) > 0 && unit.errstr != perr.GetDesc() {
			fail("status mismatch:\n  expected: %v\n  got: %v", unit.errstr, perr.GetDesc())
		}
		if unit.errstatus == none && perr.GetProofStatus() == keybase1.ProofStatus_INVALID_PVL {
			fail("unexpected INVALID_PVL:\n  expected: %v\n  got: %v", unit.errstatus, perr.Error())
		}
	}
}

func makeTestPvl(rules map[keybase1.ProofType]string) (*jsonw.Wrapper, error) {
	services := jsonw.NewDictionary()
	for ptype, v1 := range rules {
		var err error
		ptypestr, err := serviceToString(ptype)
		if err != nil {
			return nil, err
		}
		v2, err := jsonw.Unmarshal([]byte(v1))
		if err != nil {
			return nil, err
		}
		err = services.SetKey(ptypestr, v2)
		if err != nil {
			return nil, err
		}
	}
	pvl := jsonw.NewDictionary()
	err := pvl.SetKey("pvl_version", jsonw.NewInt(SupportedVersion))
	if err != nil {
		return nil, err
	}
	err = pvl.SetKey("revision", jsonw.NewInt(1))
	if err != nil {
		return nil, err
	}
	err = pvl.SetKey("services", services)
	if err != nil {
		return nil, err
	}
	return pvl, nil
}

func newExternalJSONRes(t *testing.T, json string) *libkb.ExternalAPIRes {
	if json == "" {
		t.Fatalf("empty html string")
	}
	w, err := jsonw.Unmarshal([]byte(json))
	if err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	return &libkb.ExternalAPIRes{HTTPStatus: 200, Body: w}
}

func newExternalHTMLRes(t *testing.T, html string) *libkb.ExternalHTMLRes {
	if html == "" {
		t.Fatalf("empty html string")
	}
	reader := strings.NewReader(html)
	doc, err := goquery.NewDocumentFromReader(reader)
	if err != nil {
		t.Fatalf("invalid html: %v", err)
	}
	return &libkb.ExternalHTMLRes{HTTPStatus: 200, GoQuery: doc}
}

func newExternalTextRes(t *testing.T, text string) *libkb.ExternalTextRes {
	if text == "" {
		t.Fatalf("empty text response")
	}
	return &libkb.ExternalTextRes{HTTPStatus: 200, Body: text}
}
