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
	// Only one of prepvl or prepvlstr should be specified.
	prepvl    map[keybase1.ProofType]string
	prepvlstr string
	service   keybase1.ProofType

	// What api call to expect (for non-DNS)
	restype libkb.XAPIResType
	resjson string
	reshtml string
	restext string
	resdns  map[string]([]string)
	// (Optional) Expect a different url to be fetched than proofinfo.APIURL
	urloverride string
	// (Optional) Don't check that the xapi was hit exactly once.
	allowmanyfetches bool

	// Whether the proof should validate
	shouldwork bool
	// (Optional) error status must equal. Must be specified for INVALID_PVL
	errstatus keybase1.ProofStatus
	// (Optional) error string must equal
	errstr string
}

var interpUnitTests = []interpUnitTest{
	// There are a lot of these tests in a line.
	// They are organized into sections with markdown-style headings.
	// All tests are run by the single runPvlTest function. If you want to run
	// just one test, set the `solo` variable there.

	// # Basic tests
	{
		name:      "basichtml",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_TWITTER: `[[
{"assert_regex_match": {
  "pattern": "^https://rooter\\.example\\.com/proofs/%{username_service}/[\\d]+\\.htjsxt$" } },
{"fetch": {
  "kind": "html" } },
{"selector_css": {
  "selectors": [".twit", 0] } },
{"whitespace_normalize": {} },
{"assert_regex_match": {
  "pattern": "^.*goodproof.*$" }}
]]`},
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
			keybase1.ProofType_COINBASE: `[[
{"assert_regex_match": {
  "pattern": "^https://rooter\\.example\\.com/proofs/%{username_service}/[\\d]+\\.htjsxt$" } },
{"fetch": {
  "kind": "string" } }
]]`},
		service:    keybase1.ProofType_COINBASE,
		restype:    libkb.XAPIResText,
		restext:    "1234",
		shouldwork: true,
	}, {
		name:      "AssertRegexMatch-url-fail",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_HACKERNEWS: `[[
{"assert_regex_match": {
  "pattern": "^https://rooter\\.example\\.com/proofs/%{username_service}/+\\.htjsxt$" } },
{"fetch": {
  "kind": "string"} }
]]`},
		service:    keybase1.ProofType_HACKERNEWS,
		restype:    libkb.XAPIResText,
		restext:    "1234",
		shouldwork: false,
	}, {
		name:      "AssertRegexMatch-content-ok",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_REDDIT: `[[
{"fetch": {
  "kind": "html" } },
{"selector_css": {
  "selectors": [".twit", -1] } },
{"whitespace_normalize": {}},
{"assert_regex_match": {
  "pattern": "^short %{sig_id_short}$" } }
]]`},
		service:    keybase1.ProofType_REDDIT,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: true,
	}, {
		name:      "AssertRegexMatch-content-fail",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_TWITTER: `[[
{"fetch": {
  "kind": "html" } },
{"selector_css": {
  "selectors": [".twit", -1] } },
{"whitespace_normalize": {}},
{"assert_regex_match": {
  "pattern": "^wrong %{sig_id_short}$" } }
]]`},
		service:    keybase1.ProofType_TWITTER,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
	}, {
		name:      "AssertRegexMatch-content-fail-case",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_TWITTER: `[[
{"fetch": {
  "kind": "html" } },
{"selector_css": {
  "selectors": [".twit", -1] } },
{"assert_regex_match": {
  "pattern": "^.*SHORT.*$" } }
]]`},
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
			keybase1.ProofType_GENERIC_WEB_SITE: `[[
{"fetch": {
  "kind": "string" } },
{"assert_find_base64": {"var": "sig"}}
]]`},
		service: keybase1.ProofType_GENERIC_WEB_SITE,
		restype: libkb.XAPIResText,
		// the sig must be on a line with only spacing.
		restext:    fmt.Sprintf(" asdf\n  \t\t .\n %v\t\nzad\t.\n", sig1),
		shouldwork: true,
	}, {
		name:      "AssertFindBase64-fail",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GENERIC_WEB_SITE: `[[
{"fetch": {
  "kind": "string" } },
{"assert_find_base64": {"var": "sig"}}
]]`},
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
			keybase1.ProofType_GENERIC_WEB_SITE: `[[
{"fetch": {
  "kind": "string" } },
{"assert_regex_match": {
  "pattern": "^[\\s\\S]*\\t[\\s\\S]*$" } },
{"whitespace_normalize": {}},
{"assert_regex_match": {
  "pattern": "^A b c de f$",
  "case_insensitive": true } }
]]`},
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
			keybase1.ProofType_GENERIC_WEB_SITE: `[[
{"fetch": {
  "kind": "html" } },
{"selector_css": {
  "selectors": ["div.twit", -1] } },
{"whitespace_normalize": {}},
{"regex_capture": {
  "pattern": "^(?:sHoRt) ([A-Za-z0-9+/=]+)$",
  "case_insensitive": true } },
{"assert_regex_match": {
  "pattern": "^%{sig_id_short}$" } }
]]`},
		service:    keybase1.ProofType_GENERIC_WEB_SITE,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: true,
	}, {
		// A repeated capture group returns its last match.
		name:      "RegexCapture-ok-multimatch",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GENERIC_WEB_SITE: `[[
{"fetch": {
  "kind": "html" } },
{"selector_css": {
  "selectors": ["div.twit", -1] } },
{"whitespace_normalize": {}},
{"regex_capture": {
  "pattern": "^(short).*$" } },
{"regex_capture": {
  "pattern": "^(\\w)+$" } },
{"assert_regex_match": {
  "pattern": "^t$" } }
]]`},
		service:    keybase1.ProofType_GENERIC_WEB_SITE,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: true,
	}, {
		name:      "RegexCapture-fail-nomatch",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GENERIC_WEB_SITE: `[[
{"fetch": {
  "kind": "html" } },
{"selector_css": {
  "selectors": ["div.twit", -1] } },
{"regex_capture": {
  "pattern": "^(nowhere)$",
  "case_insensitive": true } }
]]`},
		service:    keybase1.ProofType_GENERIC_WEB_SITE,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
	}, {
		name:      "RegexCapture-fail-nogroup",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GENERIC_WEB_SITE: `[[
{"fetch": {
  "kind": "html" } },
{"selector_css": {
  "selectors": ["div.twit", -1] } },
{"whitespace_normalize": {}},
{"regex_capture": {
  "pattern": "^sHoRt.*$",
  "case_insensitive": true } },
{"assert_regex_match": {
  "pattern": "^%{sig_id_short}$/s" } }
]]`},
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
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "string" } },
{"assert_regex_match": {
  "pattern": "^str9\n$" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResText,
		restext:    "str9\n",
		shouldwork: true,
	}, {
		name:      "Fetch-html",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "html" } },
{"selector_css": {
  "selectors": ["head title"] } },
{"assert_regex_match": {
  "pattern": "^proofer$" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: true,
	}, {
		name:      "Fetch-json",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "json" } },
{"selector_json": {
  "selectors": ["data", 2, "type"] } },
{"assert_regex_match": {
  "pattern": "^useful$" } }
]]`},
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
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "json" } },
{"selector_json": {
  "selectors": ["data", 2, "type"] } },
{"assert_regex_match": {
  "pattern": "^useful$" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResJSON,
		resjson:    json1,
		shouldwork: true,
	}, {
		name:      "SelectorJSON-index-dne",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "json" } },
{"selector_json": {
  "selectors": ["data", 500] } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResJSON,
		resjson:    json1,
		shouldwork: false,
	}, {
		name:      "SelectorJSON-key-dne",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "json" } },
{"selector_json": {
  "selectors": ["data", "a500"] } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResJSON,
		resjson:    json1,
		shouldwork: false,
	}, {
		name:      "SelectorJSON-index-neg",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "json" } },
{"selector_json": {
  "selectors": ["data", -1, "poster"] } },
{"assert_regex_match": {
  "pattern": "^eve$" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResJSON,
		resjson:    json1,
		shouldwork: true,
	}, {
		name:      "SelectorJSON-index-all",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "json" } },
{"selector_json": {
  "selectors": ["data", {"all": true }, "poster"] } },
{"assert_regex_match": {
  "pattern": "^kronk eve$" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResJSON,
		resjson:    json1,
		shouldwork: true,
	}, {
		// Index into a non-array
		name:      "SelectorJSON-index-nonarray",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "json" } },
{"selector_json": {
  "selectors": ["data", {"all": true }, "extra", 0, 0] } },
{"assert_regex_match": {
  "pattern": "^4$" } }
]]`},
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
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "html" } },
{"selector_css": {
  "selectors": ["body .twit", -1] } },
{"whitespace_normalize": {}},
{"assert_regex_match": {
  "pattern": "^short %{sig_id_short}$" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: true,
	}, {
		name:      "SelectorCSS-fail-dontcrash",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "html" } },
{"selector_css": {
  "selectors": ["body .twit:eq(0)"] } },
{"assert_regex_match": {
  "pattern": "^$" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
	}, {
		name:      "SelectorCSS-ok-multi",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "html" } },
{"selector_css": {
  "selectors": ["body .twit"],
  "multi": true } },
{"assert_regex_match": {
  "pattern": "^[\\s\\S]*goodproof[\\s\\S]*evil\\.com[\\s\\S]*short[\\s\\S]*$" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: true,
	}, {
		name:      "SelectorCSS-fail-nonmulti",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "html" } },
{"selector_css": {
  "selectors": ["body .twit"] } },
{"whitespace_normalize": {}},
{"assert_regex_match": {
  "pattern": "^short %{sig_id_short}$" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
	}, {
		name:      "SelectorCSS-ok-attr",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "html" } },
{"selector_css": {
  "selectors": ["body .twit[data-x]"],
  "attr": "data-x" } },
{"assert_regex_match": {
  "pattern": "^y$" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: true,
	}, {
		name:      "SelectorCSS-ok-attr-dne",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "html" } },
{"selector_css": {
  "selectors": ["body .twit"],
  "multi": true,
  "attr": "dne" } },
{"assert_regex_match": {
  "pattern": "^$" } }
]]`},
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
			keybase1.ProofType_GITHUB: `[[
{"transform_url": {
  "pattern": "^https://rooter.example.com/(\\w+)/(?:%{username_service})/([^/])+\\.(htjsxt)$",
  "to_pattern": "https://rooter.example.com/%{username_keybase}/keybase/%{1}/%{2}.%{3}" } },
{"assert_regex_match": {
  "pattern": "^https://rooter.example.com/kronk/keybase/proofs/5\\.htjsxt$" } },
{"fetch": {
  "kind": "string" } },
{"assert_regex_match": {
  "pattern": "^ok$" } }
]]`},
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
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "string" } },
{"transform_url": "^$", "to": "^$"}
]]`},
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
			keybase1.ProofType_GITHUB: `[[
{"transform_url": {
  "pattern": "^$",
  "to_pattern": "^$" } },
{"fetch": {
  "kind": "string" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResText,
		restext:    "ok",
		shouldwork: false,
	}, {
		name:      "SelectorTransformURL-fail-badsub",
		proofinfo: info1,
		// Swap some parts of the paths. Also use an ignored capture group.
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"transform_url": {
  "pattern": "^(.*)$",
  "to_pattern": "%{2}" } },
{"fetch": {
  "kind": "string" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResText,
		restext:    "ok",
		shouldwork: false,
	},

	// # Tests for invalid PVL at the top level
	{
		name:      "omitted-service",
		proofinfo: info1,
		// Empty service entries should fail.
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_TWITTER: `[[ {"fetch": { "kind": "string" } } ]]`,
		},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:       "omitted-version",
		proofinfo:  info1,
		prepvlstr:  `{"revision": 1, "services": {}}`,
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:       "omitted-revision",
		proofinfo:  info1,
		prepvlstr:  `{"pvl_version": 1, "services": {}}`,
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:       "bad-services",
		proofinfo:  info1,
		prepvlstr:  `{"pvl_version": 1, "revision": 2, "services": []}`,
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:       "non-array-script",
		proofinfo:  info1,
		prepvlstr:  `{"pvl_version": 1, "revision": 2, "services": {"github": "bad"}}`,
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:       "empty-script",
		proofinfo:  info1,
		prepvlstr:  `{"pvl_version": 1, "revision": 2, "services": {"github": [[]]}}`,
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:       "empty-script-multi",
		proofinfo:  info1,
		prepvlstr:  `{"pvl_version": 1, "revision": 2, "services": {"github": [[], []]}}`,
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:       "no-scripts",
		proofinfo:  info1,
		prepvlstr:  `{"pvl_version": 1, "revision": 2, "services": {"github": []}}`,
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	},

	// ## Tests for bad proofinfo
	{
		name:      "bad-sig-path-in-domain-web",
		proofinfo: infoBadDomain,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GENERIC_WEB_SITE: `[[
{"fetch": {
  "kind": "string" } }
]]`},
		service:    keybase1.ProofType_GENERIC_WEB_SITE,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_BAD_SIGNATURE,
	},
	{
		name:      "bad-sig-path-in-domain-dns",
		proofinfo: infoBadDomain,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_DNS: `[[
{"assert_regex_match": {
  "pattern": "^foo$" } }
]]`},
		service: keybase1.ProofType_DNS,
		resdns: map[string][]string{
			info1.Hostname: {"NO", "ok"},
		},
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_BAD_SIGNATURE,
	},
	{
		name:      "bad-sig-proto",
		proofinfo: infoBadProto,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GENERIC_WEB_SITE: `[[
{"fetch": {
  "kind": "string" } }
]]`},
		service:    keybase1.ProofType_GENERIC_WEB_SITE,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_BAD_SIGNATURE,
	},

	// ## (Invalid) AssertRegexMatch
	{
		name:      "AssertRegexMatch-invalid-missing^",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "html" } },
{"assert_regex_match": {
  "pattern": "foobar$" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:      "AssertRegexMatch-invalid-missing$",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "html" } },
{"assert_regex_match": {
  "pattern": "^foobar" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:      "AssertRegexMatch-invalid-badvar",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "html" } },
{"assert_regex_match": {
  "pattern": "^%{hostname}$" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:      "AssertRegexMatch-invalid-redesc",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "html" } },
{"assert_regex_match": {
  "pattern": ["^foobar$"] } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:      "AssertRegexMatch-invalid-badre",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "html" } },
{"assert_regex_match": {
  "pattern": "^foo)(bar$" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	},

	// ## (Invalid) AssertFindBase64
	{
		name:      "AssertFindBase64-invalid-badtarget",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "string" } },
{"assert_find_base64": {
  "var": "username_keybase" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResText,
		restext:    "foobar",
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	},

	// ## (Invalid) WhitespaceNormalize
	// No tests

	// ## (Invalid) RegexCapture
	// Mostly the same as AssertRegexMatch
	{
		name:      "RegexCapture-invalid-missing^",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "html" } },
{"regex_capture": {
  "pattern": "(f)oobar$" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:      "RegexCapture-invalid-missing$",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "html" } },
{"regex_capture": {
  "pattern": "^(f)oobar" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:      "RegexCapture-invalid-badvar",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "html" } },
{"regex_capture": {
  "pattern": "^(%{hostname})$" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:      "RegexCapture-invalid-redesc",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": {
  "kind": "html" } },
{"regex_capture": {
  "pattern": ["^(f)oobar$"] } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	},

	// ## (Invalid) Fetch
	{
		name:      "Fetch-invalid-type",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": { "kind": "whatsthis" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResText,
		restext:    "foobar",
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:      "Fetch-invalid-indns",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_DNS: `[[
{"fetch": { "kind": "text" } }
]]`},
		service:    keybase1.ProofType_DNS,
		restype:    libkb.XAPIResText,
		restext:    "foobar",
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	},
	{
		name:      "Fetch-invalid-multiple",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": { "kind": "string" } },
{"fetch": { "kind": "string" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResText,
		restext:    "foobar",
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	},

	// ## (Invalid) SelectorJSON
	{
		name:      "SelectorJSON-invalid-scripttype",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": { "kind": "string" } },
{"selector_json": {
  "selectors": [0] } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResText,
		restext:    "foobar",
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:      "SelectorJSON-invalid-selectorlist",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": { "kind": "json" } },
{"selector_json": {
  "selectors": 0 } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResJSON,
		resjson:    json1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:      "SelectorJSON-invalid-empty",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": { "kind": "json" } },
{"selector_json": {
  "selectors": [] } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResJSON,
		resjson:    json1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:      "SelectorJSON-invalid-spec",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": { "kind": "json" } },
{"selector_json": {
  "selectors": [{"foo": "bar" }] } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResJSON,
		resjson:    json1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	},

	// ## (Invalid) SelectorCSS
	{
		name:      "SelectorCSS-invalid-scripttype",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": { "kind": "json" } },
{"selector_css": {
  "selectors": [0] } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResJSON,
		resjson:    json1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:      "SelectorCSS-invalid-selectorlist",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": { "kind": "html" } },
{"selector_css": {
  "selectors": 0 } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:      "SelectorCSS-invalid-empty",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": { "kind": "html" } },
{"selector_css": {
  "selectors": [] } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:      "SelectorCSS-invalid-spec",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{"fetch": { "kind": "html" } },
{"selector_css": {
  "selectors": [{"foo": "bar" }] } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResHTML,
		reshtml:    html1,
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	},

	// ## (Invalid) TransformURL
	// No tests

	// # Multiple Scripts
	{
		name:      "MultipleScripts-first-ok",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_FACEBOOK: `[[
{"fetch": { "kind": "string" } },
{"assert_regex_match": {
  "pattern": "^ok$" } }
], [
{"fetch": { "kind": "string" } },
{"assert_regex_match": {
  "pattern": "^NO$" } }
]]`},
		service:    keybase1.ProofType_FACEBOOK,
		restype:    libkb.XAPIResText,
		restext:    "ok",
		shouldwork: true,
	}, {
		name:      "MultipleScripts-second-ok",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_FACEBOOK: `[[
{"fetch": { "kind": "string" } },
{"assert_regex_match": {
  "pattern": "^NO$" } }
], [
{"fetch": { "kind": "string" } },
{"assert_regex_match": {
  "pattern": "^ok$" } }
]]`},
		service:          keybase1.ProofType_FACEBOOK,
		restype:          libkb.XAPIResText,
		restext:          "ok",
		allowmanyfetches: true,
		shouldwork:       true,
	}, {
		name:      "MultipleScripts-both-ok",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_FACEBOOK: `[[
{"fetch": { "kind": "string" } },
{"assert_regex_match": {
  "pattern": "^ok$" } }
], [
{"fetch": { "kind": "string" } },
{"assert_regex_match": {
  "pattern": "^ok" } }
]]`},
		service:    keybase1.ProofType_FACEBOOK,
		restype:    libkb.XAPIResText,
		restext:    "ok",
		shouldwork: true,
	}, {
		name:      "MultipleScripts-both-fail",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_FACEBOOK: `[[
{"fetch": { "kind": "string" } },
{"assert_regex_match": {
  "pattern": "^NO$",
  "error": ["HOST_UNREACHABLE", "x"] } }
], [
{"fetch": { "kind": "string" } },
{"assert_regex_match": {
  "pattern": "^NO$",
  "error": ["HOST_UNREACHABLE", "x"] } }
]]`},
		service:    keybase1.ProofType_FACEBOOK,
		restype:    libkb.XAPIResText,
		restext:    "ok",
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_HOST_UNREACHABLE,
	},

	// # DNS tests
	// Checking a DNS proof is different from checking other proofs.
	// It runs each script against each TXT record of 2 domains.
	// That mechanism is tested here.
	{
		name:      "DNS-second-record-ok",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_DNS: `[[
{"assert_regex_match": {
  "pattern": "^ok$" } }
]]`},
		service: keybase1.ProofType_DNS,
		resdns: map[string][]string{
			info1.Hostname: {"NO", "ok"},
		},
		shouldwork: true,
	}, {
		name:      "DNS-_keybase-ok",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_DNS: `[[
{"assert_regex_match": {
  "pattern": "^ok$" } }
]]`},
		service: keybase1.ProofType_DNS,
		resdns: map[string][]string{
			info1.Hostname:               {"NO_1", "NO_2"},
			"_keybase." + info1.Hostname: {"NO_3", "ok"},
		},
		shouldwork: true,
	}, {
		name:      "DNS-no-records",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_DNS: `[[
{"assert_regex_match": {
  "pattern": "^ok$" } }
]]`},
		service: keybase1.ProofType_DNS,
		resdns: map[string][]string{
			info1.Hostname:               {},
			"_keybase." + info1.Hostname: {},
		},
		shouldwork: false,
	}, {
		name:      "DNS-no-matching-records",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_DNS: `[[
{"assert_regex_match": {
  "pattern": "^ok$" } }
]]`},
		service: keybase1.ProofType_DNS,
		resdns: map[string][]string{
			info1.Hostname:               {"NO_1"},
			"_keybase." + info1.Hostname: {"NO_2", "NO_3"},
		},
		shouldwork: false,
	}, {
		name:      "DNS-error-then-succeed",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_DNS: `[[
{"assert_regex_match": {
  "pattern": "^ok$" } }
]]`},
		service: keybase1.ProofType_DNS,
		resdns: map[string][]string{
			info1.Hostname:               {"ERROR"},
			"_keybase." + info1.Hostname: {"ok"},
		},
		shouldwork: true,
	}, {
		name:      "DNS-error-then-succeed-2",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_DNS: `[[
{"assert_regex_match": {
  "pattern": "^ok1$" } }
], [
{"assert_regex_match": {
  "pattern": "^ok2$" } }
]]`},
		service: keybase1.ProofType_DNS,
		resdns: map[string][]string{
			info1.Hostname: {"NO_1", "ok2"},
		},
		shouldwork: true,
	},

	// # Custom Errors
	{
		name:      "CustomError-ok",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{ "fetch": { "kind": "string"  } },
{ "assert_regex_match": {
  "pattern": "^foo$",
  "error": ["PERMISSION_DENIED", "whoops!"] } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResText,
		restext:    "bar",
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_PERMISSION_DENIED,
		errstr:     "whoops!",
	}, {
		name:      "CustomError-wrong-short-array",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{ "fetch": { "kind": "string"  } },
{ "assert_regex_match": {
  "pattern": "^foo$",
  "error": ["PERMISSION_DENIED"] } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResText,
		restext:    "bar",
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:      "CustomError-wrong-type1",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{ "fetch": { "kind": "string"  } },
{ "assert_regex_match": {
  "pattern": "^foo$",
  "error": 108 } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResText,
		restext:    "bar",
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		name:      "CustomError-wrong-type2",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{ "fetch": { "kind": "string"  } },
{ "assert_regex_match": {
  "pattern": "^foo$",
  "error": ["TIMEOUT", []] } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResText,
		restext:    "bar",
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		// A custom error should not affect invalidity.
		// Here the regex contains invalid var name.
		name:      "CustomError-and-invalid",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{ "fetch": { "kind": "string"  } },
{ "assert_regex_match": {
  "pattern": "^%{invalid}$",
  "error": ["PERMISSION_DENIED", "whoops"] } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResText,
		restext:    "bar",
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_INVALID_PVL,
	}, {
		// Without a custom error, a default will appear.
		name:      "CustomError-none",
		proofinfo: info1,
		prepvl: map[keybase1.ProofType]string{
			keybase1.ProofType_GITHUB: `[[
{ "fetch": { "kind": "string" } },
{ "assert_regex_match": {
  "pattern": "^foo$" } }
]]`},
		service:    keybase1.ProofType_GITHUB,
		restype:    libkb.XAPIResText,
		restext:    "bar",
		shouldwork: false,
		errstatus:  keybase1.ProofStatus_CONTENT_FAILURE,
		errstr:     "Regex did not match (^foo$)",
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

	var pvl string
	var err error
	switch {
	case (unit.prepvl == nil) == (unit.prepvlstr == ""):
		fail("one of prepvl or prepvlstr must be specified")
	case unit.prepvlstr == "":
		pvl, err = makeTestPvl(unit.prepvl)
		if err != nil {
			fail("Error in prepvl: %v", err)
		}
	default:
		pvl = unit.prepvlstr
	}

	var url = unit.proofinfo.APIURL
	if unit.urloverride != "" {
		url = unit.urloverride
	}

	isdns := unit.service == keybase1.ProofType_DNS

	if isdns {
		unit.proofinfo.stubDNS = newStubDNSEngine(unit.resdns)
	} else {
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
	}

	perr := CheckProof(g, pvl, unit.service, unit.proofinfo)
	if perr == nil {
		if !unit.shouldwork {
			fail("proof should have failed")
		}

		err = nil
		if isdns {
			if !unit.proofinfo.stubDNS.IsOk() {
				fail("DNS stub ran out of bounds")
			}
		} else {
			if unit.allowmanyfetches {
				err = xapi.AssertCalledWith(unit.restype, url)
			} else {
				err = xapi.AssertCalledOnceWith(unit.restype, url)
			}
			if err != nil {
				fail("%v", err)
			}
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

func makeTestPvl(rules map[keybase1.ProofType]string) (string, error) {
	var pvl string
	services := jsonw.NewDictionary()
	for ptype, v1 := range rules {
		var err error
		ptypestr, err := serviceToString(ptype)
		if err != nil {
			return pvl, err
		}
		v2, err := jsonw.Unmarshal([]byte(v1))
		if err != nil {
			return pvl, err
		}
		err = services.SetKey(ptypestr, v2)
		if err != nil {
			return pvl, err
		}
	}
	pvlStr := jsonw.NewDictionary()
	err := pvlStr.SetKey("pvl_version", jsonw.NewInt(SupportedVersion))
	if err != nil {
		return pvl, err
	}
	err = pvlStr.SetKey("revision", jsonw.NewInt(1))
	if err != nil {
		return pvl, err
	}
	err = pvlStr.SetKey("services", services)
	if err != nil {
		return pvl, err
	}
	pvlB, err := pvlStr.Marshal()
	if err != nil {
		return pvl, err
	}
	pvl = string(pvlB)
	return pvl, nil
}

func newExternalJSONRes(t *testing.T, json string) *libkb.ExternalAPIRes {
	if json == "" {
		t.Fatalf("empty json string")
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
