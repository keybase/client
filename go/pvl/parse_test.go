// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvl

import (
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
)

// TestParse parses the hardcoded string
func TestParse(t *testing.T) {
	p, err := parse(hardcodedPVLString)
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}
	if p.PvlVersion < 0 {
		t.Fatalf("version should be >=0: %v", p.PvlVersion)
	}
}

// TestParse2 checks a few of the parse output's details.
func TestParse2(t *testing.T) {
	p, err := parse(hardcodedPVLString)
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
