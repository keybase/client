// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvl

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// loadKitChunk reads the compiled pvl kit from pvl-tools/kit.json and returns
// the chunk for the supported version, using the same extraction as the
// production MerkleStore (see go/merklestore/store.go).
func loadKitChunk(t *testing.T) string {
	t.Helper()
	path := filepath.Join("..", "..", "pvl-tools", "kit.json")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("could not read kit %q: %v", path, err)
	}
	var kit struct {
		Tab map[int]json.RawMessage `json:"tab"`
	}
	if err := json.Unmarshal(data, &kit); err != nil {
		t.Fatalf("could not parse kit json: %v", err)
	}
	chunk, ok := kit.Tab[SupportedVersion]
	if !ok {
		t.Fatalf("kit has no tab[%d]", SupportedVersion)
	}
	return string(chunk)
}

type kitUnitTest struct {
	service keybase1.ProofType

	testUsername       string // keybase username
	testRemoteUsername string // remote (service) username
	armoredSig         string

	// Saved response file, relative to this package directory.
	testResponseFile string

	testAPIURL string

	// (Optional) Expect a different url to be fetched than proofinfo.APIURL
	urloverride string

	// Whether the proof should validate
	shouldwork bool
	// (Optional) error status must equal. Must be specified for INVALID_PVL
	errstatus keybase1.ProofStatus
	// (Optional) error string must equal
	errstr string
}

func runKitUnitTest(t *testing.T, ut *kitUnitTest) {
	resp, err := os.ReadFile(ut.testResponseFile)
	require.NoError(t, err)

	unit := interpUnitTest{
		name:      "kit-against-response-file",
		prepvlstr: loadKitChunk(t),
		service:   ut.service,
		proofinfo: ProofInfo{
			ArmoredSig:     ut.armoredSig,
			Username:       ut.testUsername,
			RemoteUsername: ut.testRemoteUsername,
			APIURL:         ut.testAPIURL,
		},
		// The script may fetch a rewritten URL; serve the canned response there.
		urloverride: ut.urloverride,
		restype:     libkb.XAPIResHTML,
		reshtml:     string(resp),

		// Be lenient about the number/shape of fetches for real-world scripts.
		allowmanyfetches: true,
		shouldwork:       ut.shouldwork,
		errstatus:        ut.errstatus,
		errstr:           ut.errstr,
	}
	runPvlTest(t, &unit)
}

func TestKitRedditMax(t *testing.T) {
	armoredSig, err := os.ReadFile("testdata/reddit-max-sig.pgp")
	require.NoError(t, err)

	ut := kitUnitTest{
		service: keybase1.ProofType_REDDIT,

		testUsername:       "max",     // keybase username
		testRemoteUsername: "maxtaco", // remote (service) username
		armoredSig:         string(armoredSig),

		testResponseFile: "testdata/reddit-max.xml",

		testAPIURL:  "https://www.reddit.com/r/KeybaseProofs/comments/2clf9c/my_keybase_proof_redditmaxtaco_keybasemax/.json",
		urloverride: "https://old.reddit.com/r/KeybaseProofs/comments/2clf9c/my_keybase_proof_redditmaxtaco_keybasemax/.rss",

		shouldwork: true,
	}
	runKitUnitTest(t, &ut)

	// Try a response for a different proof, should not work
	utBad := ut
	utBad.testResponseFile = "testdata/reddit-terribletext5299.xml"
	utBad.shouldwork = false
	utBad.errstatus = keybase1.ProofStatus_BAD_USERNAME
	runKitUnitTest(t, &utBad)

	// Bad response - subreddit listing
	utBad.testResponseFile = "testdata/reddit-subreddit-listing.xml"
	utBad.shouldwork = false
	utBad.errstatus = keybase1.ProofStatus_CONTENT_MISSING
	runKitUnitTest(t, &utBad)

	// Bad response - user listing
	utBad.testResponseFile = "testdata/reddit-user-listing.xml"
	utBad.shouldwork = false
	utBad.errstatus = keybase1.ProofStatus_CONTENT_MISSING
	runKitUnitTest(t, &utBad)
}

func TestKitRedditTerribleText5299(t *testing.T) {
	const armoredSig string = "hKRib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEgHgWHLK3x6NX4ksIQa0MQTKQtcnfRA3y+ztKIeclfnrkKp3BheWxvYWTESpcCBsQgQDVJotXMTHnH+HKa99mLrjMs68oq49uoBXhqeGIz/7LEICIPqp3niErOJO+Am4fBOcCo5f/l2DZ3qN4A+Ms3yMt6AgHCo3NpZ8RAwdsXmhWjKOfqIzqIgE/sMwilohfhWVSgCeBROZ4PWeXHsU5IHkTtY6R3hgu53cpNAKagk+Z5RlnjbXHTN5LOBahzaWdfdHlwZSCkaGFzaIKkdHlwZQildmFsdWXEIK08UoW2b90fZEYMrl1gopc2ug66tAclRuXWPhTomZ1bo3RhZ80CAqd2ZXJzaW9uAQ=="

	ut := kitUnitTest{
		service: keybase1.ProofType_REDDIT,

		testUsername:       "testusera56b",      // keybase username
		testRemoteUsername: "terrible-text5299", // remote (service) username
		armoredSig:         armoredSig,

		testResponseFile: "testdata/reddit-terribletext5299.xml",

		testAPIURL:  "https://www.reddit.com/r/KeybaseProofs/comments/1pqpxtp/my_keybase_proof_redditterribletext5299/.json",
		urloverride: "https://old.reddit.com/r/KeybaseProofs/comments/1pqpxtp/my_keybase_proof_redditterribletext5299/.rss",

		shouldwork: true,
	}
	runKitUnitTest(t, &ut)
}
