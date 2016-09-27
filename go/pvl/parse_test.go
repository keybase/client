// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvl

import (
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
)

// TestParse parses the hardcoded string
func TestParse(t *testing.T) {
	p, err := parse(pvlStringForParseTest)
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}
	if p.PvlVersion < 0 {
		t.Fatalf("version should be >=0: %v", p.PvlVersion)
	}
}

// TestParse2 checks a few of the parse output's details.
func TestParse2(t *testing.T) {
	p, err := parse(pvlStringForParseTest)
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}
	if p.PvlVersion != 1 {
		t.Fatalf("version should be 1 got %v", p.PvlVersion)
	}
	if p.Revision != 1 {
		t.Fatalf("revision should be 1")
	}
	cbss, ok := p.Services.Map[keybase1.ProofType_COINBASE]
	if !ok {
		t.Fatalf("no coinbase service entry")
	}
	if len(cbss) < 1 {
		t.Fatalf("no scripts")
	}
	cbs := cbss[0]
	if len(cbs.Instructions) < 1 {
		t.Fatalf("empty script")
	}
	if cbs.Instructions[0].RegexCapture == nil {
		t.Fatalf("first instruction is not a RegexCapture")
	}
}

// in the near future this will go away and hardcodedPVLString will be used instead.
var pvlStringForParseTest = `
{
  "pvl_version": 1,
  "revision": 1,
  "services": {
    "coinbase": [
      [
        { "regex_capture": { "pattern": "^https://coinbase\\.com/(.*)/public-key$" } },
        { "assert_regex_match": { "case_insensitive": true, "pattern": "^%{username_service}$" } },
        { "fetch": { "kind": "html" } },
        { "selector_css": { "selectors": ["pre.statement", 0] } },
        { "assert_find_base64": { "var": "sig" } }
      ]
    ],
    "dns": [[{ "assert_regex_match": { "pattern": "^keybase-site-verification=%{sig_id_medium}$" } }]],
    "generic_web_site": [
      [
        {
          "assert_regex_match": {
            "error": ["BAD_API_URL", "Bad hint from server; didn't recognize API url: \"%{active_string}\""],
            "pattern": "^%{protocol}://%{hostname}/(?:\\.well-known/keybase\\.txt|keybase\\.txt)$"
          }
        },
        { "fetch": { "kind": "string" } },
        { "assert_find_base64": { "var": "sig" } }
      ]
    ],
    "github": [
      [
        {
          "assert_regex_match": {
            "case_insensitive": true,
            "pattern": "^https://gist\\.github(usercontent)?\\.com/%{username_service}/.*$"
          }
        },
        { "fetch": { "kind": "string" } },
        { "assert_find_base64": { "var": "sig" } }
      ]
    ],
    "hackernews": [
      [
        {
          "assert_regex_match": {
            "case_insensitive": true,
            "pattern": "^https://hacker-news\\.firebaseio\\.com/v0/user/%{username_service}/about.json$"
          }
        },
        { "fetch": { "kind": "string" } },
        { "assert_regex_match": { "pattern": "^.*%{sig_id_medium}.*$" } }
      ]
    ],
    "reddit": [
      [
        {
          "assert_regex_match": { "case_insensitive": true, "pattern": "^https://(:?www\\.)?reddit\\.com/r/keybaseproofs/.*$" }
        },
        { "fetch": { "kind": "json" } },
        { "selector_json": { "selectors": [0, "kind"] } },
        { "assert_regex_match": { "pattern": "^Listing$" } },
        { "selector_json": { "selectors": [0, "data", "children", 0, "kind"] } },
        { "assert_regex_match": { "pattern": "^t3$" } },
        { "selector_json": { "selectors": [0, "data", "children", 0, "data", "subreddit"] } },
        { "assert_regex_match": { "case_insensitive": true, "pattern": "^keybaseproofs$" } },
        { "selector_json": { "selectors": [0, "data", "children", 0, "data", "author"] } },
        { "assert_regex_match": { "case_insensitive": true, "pattern": "^%{username_service}$" } },
        { "selector_json": { "selectors": [0, "data", "children", 0, "data", "title"] } },
        { "assert_regex_match": { "case_insensitive": true, "pattern": "^.*%{sig_id_medium}.*$" } },
        { "selector_json": { "selectors": [0, "data", "children", 0, "data", "selftext"] } },
        { "assert_find_base64": { "var": "sig" } }
      ]
    ],
    "rooter": [
      [
        {
          "assert_regex_match": {
            "case_insensitive": true,
            "pattern": "^https?://[\\w:_\\-\\.]+/_/api/1\\.0/rooter/%{username_service}/.*$"
          }
        },
        { "fetch": { "kind": "json" } },
        { "selector_json": { "selectors": ["status", "name"] } },
        { "assert_regex_match": { "case_insensitive": true, "pattern": "^ok$" } },
        { "selector_json": { "selectors": ["toot", "post"] } },
        { "assert_regex_match": { "pattern": "^.*%{sig_id_medium}.*$" } }
      ]
    ],
    "twitter": [
      [
        {
          "assert_regex_match": { "case_insensitive": true, "pattern": "^https://twitter\\.com/%{username_service}/.*$" }
        },
        { "fetch": { "kind": "html" } },
        {
          "selector_css": { "attr": "data-screen-name", "selectors": ["div.permalink-tweet-container div.permalink-tweet", 0] }
        },
        {
          "assert_regex_match": {
            "case_insensitive": true,
            "error": ["CONTENT_FAILURE", "Bad post authored; wanted \"%{username_service}\", got \"%{active_string}\""],
            "pattern": "^%{username_service}$"
          }
        },
        {
          "selector_css": { "selectors": ["div.permalink-tweet-container div.permalink-tweet", 0, "p.tweet-text", 0] }
        },
        { "whitespace_normalize": { } },
        {
          "regex_capture": {
            "case_insensitive": true,
            "pattern": "^ *(?:@[a-zA-Z0-9_-]+\\s*)* *Verifying myself: I am ([A-Za-z0-9_]+) on Keybase\\.io\\. (?:\\S+) */.*$"
          }
        },
        { "assert_regex_match": { "case_insensitive": true, "pattern": "^%{username_keybase}$" } },
        {
          "selector_css": { "selectors": ["div.permalink-tweet-container div.permalink-tweet", 0, "p.tweet-text", 0] }
        },
        { "whitespace_normalize": { } },
        {
          "regex_capture": {
            "case_insensitive": true,
            "pattern": "^ *(?:@[a-zA-Z0-9_-]+\\s*)* *Verifying myself: I am (?:[A-Za-z0-9_]+) on Keybase\\.io\\. (\\S+) */.*$"
          }
        },
        { "assert_regex_match": { "pattern": "^%{sig_id_short}$" } }
      ]
    ]
  }
}
`
