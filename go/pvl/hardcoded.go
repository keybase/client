// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvl

import (
	"log"

	jsonw "github.com/keybase/go-jsonw"
)

// Filled from hardcodedPVLString by init.
var hardcodedPVL jsonw.Wrapper

var hardcodedPVLString = `
{
  "pvl_version": 1,
  "revision": 1,
  "services": {
    "coinbase": [
      { "assert_regex_match": "/^https://coinbase\\.com/%{username_service}/public-key$/i" },
      { "fetch": "html" },
      { "selector_css": ["pre.statement", 0] },
      { "assert_find_base64": "sig" }
    ],
    "dns": [{ "assert_regex_match": "/^keybase-site-verification=%{sig_id_medium}$/" }],
    "generic_web_site": [
      { "assert_regex_match": "/^https?://%{hostname}/(?:\\.well-known/keybase\\.txt|keybase\\.txt)$/i" },
      { "fetch": "string" },
      { "assert_find_base64": "sig" }
    ],
    "github": [
      { "assert_regex_match": "/^https://gist\\.github(usercontent)?\\.com/%{username_service}/.*$/i" },
      { "fetch": "string" },
      { "assert_find_base64": "sig" }
    ],
    "hackernews": [
      {
        "assert_regex_match": "/https://hacker-news\\.firebaseio\\.com/v0/user/%{username_service}/about.json/i"
      },
      { "fetch": "string" },
      { "assert_regex_match": "/.*%{sig_id_medium}.*/" }
    ],
    "reddit": [
      { "assert_regex_match": "/^https://(:?www\\.)?reddit\\.com/r/keybaseproofs/.*$/i" },
      { "fetch": "json" },
      { "selector_json": [0, "kind"] },
      { "assert_regex_match": "/^Listing$/" },
      { "selector_json": [0, "data", "children", 0, "kind"] },
      { "assert_regex_match": "/^t3$/" },
      { "selector_json": [0, "data", "children", 0, "data", "subreddit"] },
      { "assert_regex_match": "/^keybaseproofs$/i" },
      { "selector_json": [0, "data", "children", 0, "data", "author"] },
      { "assert_regex_match": "/^%{username_service}$/i" },
      { "selector_json": [0, "data", "children", 0, "data", "title"] },
      { "assert_regex_match": "/^.*%{sig_id_medium}.*$/i" },
      { "selector_json": [0, "data", "children", 0, "data", "selftext"] },
      { "assert_find_base64": "sig" }
    ],
    "rooter": [
      { "assert_regex_match": "/^https?://[\\w:_\\-\\.]+/_/api/1\\.0/rooter/%{username_service}/.*$/i" },
      { "fetch": "json" },
      { "selector_json": ["status", "name"] },
      { "assert_regex_match": "/ok/i" },
      { "selector_json": ["toot", "post"] },
      { "assert_regex_match": "/.*%{sig_id_medium}.*/" }
    ],
    "twitter": [
      { "assert_regex_match": "/^https://twitter\\.com/%{username_service}/.*$/i" },
      { "fetch": "html" },
      {
        "attr": "data-screen-name",
        "selector_css": ["div.permalink-tweet-container div.permalink-tweet", 0]
      },
      { "assert_regex_match": "/^%{username_service}$/i" },
      { "selector_css": ["div.permalink-tweet-container div.permalink-tweet", 0, "p.tweet-text", 0] },
      { "whitespace_normalize": true },
      {
        "regex_capture": "/^ *(?:@[a-zA-Z0-9_-]+\\s*)* *Verifying myself: I am ([A-Za-z0-9_]+) on Keybase\\.io\\. (?:\\S+) */.*$/i"
      },
      { "assert_regex_match": "/^%{username_keybase}$/i" },
      { "selector_css": ["div.permalink-tweet-container div.permalink-tweet", 0, "p.tweet-text", 0] },
      { "whitespace_normalize": true },
      {
        "regex_capture": "/^ *(?:@[a-zA-Z0-9_-]+\\s*)* *Verifying myself: I am (?:[A-Za-z0-9_]+) on Keybase\\.io\\. (\\S+) */.*$/i"
      },
      { "assert_regex_match": "/^%{sig_id_short}$/" }
    ]
  }
}
`

func GetHardcodedPvl() *jsonw.Wrapper {
	return &hardcodedPVL
}

func init() {
	data := hardcodedPVLString
	wrapper, err := jsonw.Unmarshal([]byte(data))
	if err != nil {
		log.Panicf("could not read pvl json: %v", err)
	}
	hardcodedPVL = *wrapper
}
