// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"
	"time"

	"github.com/keybase/go-codec/codec"
)

func TestConflictInfo(t *testing.T) {
	ci, err := NewConflictInfo(1)
	if err != nil {
		t.Fatal(err)
	}
	ci2, err := ParseConflictInfo(ci.String())
	if err != nil {
		t.Fatal(err)
	}
	if ci2.Number != ci.Number {
		t.Fatalf("Expected %d, got: %d", ci.Number, ci2.Number)
	}
	if ci2.Date != ci.Date {
		t.Fatalf("Expected %d, got: %d", ci.Date, ci2.Date)
	}
	if ci2.String() != ci.String() {
		t.Fatalf("Expected %s, got: %s", ci, ci2)
	}
}

func TestConflictInfoNumber(t *testing.T) {
	ci, err := NewConflictInfo(2)
	if err != nil {
		t.Fatal(err)
	}
	ci2, err := ParseConflictInfo(ci.String())
	if err != nil {
		t.Fatal(err)
	}
	if ci2.Number != ci.Number {
		t.Fatalf("Expected %d, got: %d", ci.Number, ci2.Number)
	}
	if ci2.Date != ci.Date {
		t.Fatalf("Expected %d, got: %d", ci.Date, ci2.Date)
	}
	if ci2.String() != ci.String() {
		t.Fatalf("Expected %s, got: %s", ci, ci2)
	}
}

func TestConflictInfoKnownTime(t *testing.T) {
	ci := &ConflictInfo{
		Date:   1462838400,
		Number: 1,
	}
	expect := "(conflicted copy 2016-05-10)"
	if ci.String() != expect {
		t.Fatalf("Expected %s, got: %s", expect, ci)
	}
	ci2 := &ConflictInfo{
		Date:   1462838400,
		Number: 12345,
	}
	expect = "(conflicted copy 2016-05-10 #12345)"
	if ci2.String() != expect {
		t.Fatalf("Expected %s, got: %s", expect, ci2)
	}
}

func TestConflictInfoErrors(t *testing.T) {
	_, err := NewConflictInfo(0)
	if err != ErrConflictInfoInvalidNumber {
		t.Fatalf("Expected ErrConflictInfoInvalidNumber, got: %v", err)
	}
	_, err = ParseConflictInfo("(conflicted copy 2016-05-10 #0)")
	if err != ErrConflictInfoInvalidNumber {
		t.Fatalf("Expected ErrConflictInfoInvalidNumber, got: %v", err)
	}
	_, err = ParseConflictInfo("(conflicted copy 2016-05-10 #1)")
	if err != ErrConflictInfoInvalidNumber {
		t.Fatalf("Expected ErrConflictInfoInvalidNumber, got: %v", err)
	}
	_, err = ParseConflictInfo("nope")
	if err != ErrConflictInfoInvalidString {
		t.Fatalf("Expected ErrConflictInfoInvalidString, got: %v", err)
	}
	_, err = ParseConflictInfo("(conflicted copy #2)")
	if err != ErrConflictInfoInvalidString {
		t.Fatalf("Expected ErrConflictInfoInvalidString, got: %v", err)
	}
	_, err = ParseConflictInfo("(conflicted copy 2016-05-10 #)")
	if err != ErrConflictInfoInvalidString {
		t.Fatalf("Expected ErrConflictInfoInvalidString, got: %v", err)
	}
}

type conflictInfoFuture struct {
	ConflictInfo
	extra
}

func (ci conflictInfoFuture) toCurrentStruct() currentStruct {
	return ci.ConflictInfo
}

func TestConflictInfoUnknownFields(t *testing.T) {
	testStructUnknownFields(t,
		conflictInfoFuture{
			ConflictInfo{
				time.Now().UTC().Unix(),
				2,
				codec.UnknownFieldSetHandler{},
			},
			makeExtraOrBust("ConflictInfo", t),
		})
}
