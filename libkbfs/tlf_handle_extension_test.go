// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"
	"time"

	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfscodec"
)

func TestTlfHandleExtension(t *testing.T) {
	codec := kbfscodec.NewMsgpack()
	for _, et := range []TlfHandleExtensionType{
		TlfHandleExtensionConflict,
		TlfHandleExtensionFinalized,
	} {
		e, err := NewTlfHandleExtension(et, 1, "alice")
		if err != nil {
			t.Fatal(err)
		}
		exts, err := ParseTlfHandleExtensionSuffix(e.String())
		if err != nil {
			t.Fatal(err)
		}
		if len(exts) != 1 {
			t.Fatalf("Expected 1 extension, got: %d", len(exts))
		}
		// check that extensions can be encoded/decoded
		buf, err := codec.Encode(exts[0])
		if err != nil {
			t.Fatal(err)
		}
		var e2 TlfHandleExtension
		err = codec.Decode(buf, &e2)
		if err != nil {
			t.Fatal(err)
		}
		if e2.Number != e.Number {
			t.Fatalf("Expected %d, got: %d", e.Number, e2.Number)
		}
		if e2.Date != e.Date {
			t.Fatalf("Expected %d, got: %d", e.Date, e2.Date)
		}
		if e2.String() != e.String() {
			t.Fatalf("Expected %s, got: %s", e, e2)
		}
		if e.Type == TlfHandleExtensionConflict {
			if e2.Username != "" {
				t.Fatalf("Expected empty username got: %s", e2.Username)
			}
			continue
		}
		if e2.Username != e.Username {
			t.Fatalf("Expected %s, got: %s", e.Username, e2.Username)
		}
	}
}

func TestTlfHandleExtensionNumber(t *testing.T) {
	for _, et := range []TlfHandleExtensionType{
		TlfHandleExtensionConflict,
		TlfHandleExtensionFinalized,
	} {
		e, err := NewTlfHandleExtension(et, 2, "bob")
		if err != nil {
			t.Fatal(err)
		}
		exts, err := ParseTlfHandleExtensionSuffix(e.String())
		if err != nil {
			t.Fatal(err)
		}
		if len(exts) != 1 {
			t.Fatalf("Expected 1 extension, got: %d", len(exts))
		}
		e2 := exts[0]
		if e2.Number != e.Number {
			t.Fatalf("Expected %d, got: %d", e.Number, e2.Number)
		}
		if e2.Date != e.Date {
			t.Fatalf("Expected %d, got: %d", e.Date, e2.Date)
		}
		if e2.String() != e.String() {
			t.Fatalf("Expected %s, got: %s", e, e2)
		}
		if e.Type == TlfHandleExtensionConflict {
			continue
		}
		if e2.Username != e.Username {
			t.Fatalf("Expected %s, got: %s", e.Username, e2.Username)
		}
	}
}

func TestTlfHandleExtensionKnownTime(t *testing.T) {
	e := &TlfHandleExtension{
		Date:     1462838400,
		Number:   1,
		Type:     TlfHandleExtensionFinalized,
		Username: "alice",
	}
	expect := "(files before alice account reset 2016-05-10)"
	if e.String() != expect {
		t.Fatalf("Expected %s, got: %s", expect, e)
	}
	e2 := &TlfHandleExtension{
		Date:   1462838400,
		Number: 12345,
		Type:   TlfHandleExtensionConflict,
	}
	expect = "(conflicted copy 2016-05-10 #12345)"
	if e2.String() != expect {
		t.Fatalf("Expected %s, got: %s", expect, e2)
	}
	e3 := &TlfHandleExtension{
		Date:   1462838400,
		Number: 2,
		Type:   TlfHandleExtensionFinalized,
	}
	expect = "(files before account reset 2016-05-10 #2)"
	if e3.String() != expect {
		t.Fatalf("Expected %s, got: %s", expect, e3)
	}
}

func TestTlfHandleExtensionErrors(t *testing.T) {
	_, err := NewTlfHandleExtension(TlfHandleExtensionConflict, 0, "")
	if err != ErrTlfHandleExtensionInvalidNumber {
		t.Fatalf("Expected ErrTlfHandleExtensionInvalidNumber, got: %v", err)
	}
	_, err = ParseTlfHandleExtensionSuffix("(conflicted copy 2016-05-10 #0)")
	if err != ErrTlfHandleExtensionInvalidNumber {
		t.Fatalf("Expected ErrTlfHandleExtensionInvalidNumber, got: %v", err)
	}
	_, err = ParseTlfHandleExtensionSuffix("(conflicted copy 2016-05-10 #1)")
	if err != ErrTlfHandleExtensionInvalidNumber {
		t.Fatalf("Expected ErrTlfHandleExtensionInvalidNumber, got: %v", err)
	}
	_, err = ParseTlfHandleExtensionSuffix("nope")
	if err != ErrTlfHandleExtensionInvalidString {
		t.Fatalf("Expected ErrTlfHandleExtensionInvalidString, got: %v", err)
	}
	_, err = ParseTlfHandleExtensionSuffix("(conflicted copy #2)")
	if err != ErrTlfHandleExtensionInvalidString {
		t.Fatalf("Expected ErrTlfHandleExtensionInvalidString, got: %v", err)
	}
	_, err = ParseTlfHandleExtensionSuffix("(conflicted copy 2016-05-10 #)")
	if err != ErrTlfHandleExtensionInvalidString {
		t.Fatalf("Expected ErrTlfHandleExtensionInvalidString, got: %v", err)
	}
}

type tlfHandleExtensionFuture struct {
	TlfHandleExtension
	extra
}

func (ci tlfHandleExtensionFuture) toCurrentStruct() currentStruct {
	return ci.TlfHandleExtension
}

func TestTlfHandleExtensionUnknownFields(t *testing.T) {
	testStructUnknownFields(t,
		tlfHandleExtensionFuture{
			TlfHandleExtension{
				time.Now().UTC().Unix(),
				2,
				TlfHandleExtensionFinalized,
				"",
				codec.UnknownFieldSetHandler{},
			},
			makeExtraOrBust("TlfHandleExtension", t),
		})
}

func TestTlfHandleExtensionMultiple(t *testing.T) {
	e, err := NewTestTlfHandleExtensionStaticTime(TlfHandleExtensionConflict, 1, "")
	if err != nil {
		t.Fatal(err)
	}
	e2, err := NewTestTlfHandleExtensionStaticTime(TlfHandleExtensionFinalized, 2, "charlie")
	if err != nil {
		t.Fatal(err)
	}
	exts := []TlfHandleExtension{*e, *e2}
	suffix := NewTlfHandleExtensionSuffix(exts)
	expectSuffix := " (conflicted copy 2016-03-14) (files before charlie account reset 2016-03-14 #2)"
	if suffix != expectSuffix {
		t.Fatalf("Expected suffix '%s', got: '%s'", expectSuffix, suffix)
	}
	exts2, err := ParseTlfHandleExtensionSuffix(suffix)
	if err != nil {
		t.Fatal(err)
	}
	if len(exts2) != 2 {
		t.Fatalf("Expected 2 extensions, got: %d", len(exts2))
	}
	for i, ext := range exts2 {
		if ext.Number != exts[i].Number {
			t.Fatalf("Expected %d, got: %d", exts[i].Number, ext.Number)
		}
		if ext.Date != exts[i].Date {
			t.Fatalf("Expected %d, got: %d", exts[i].Date, ext.Date)
		}
		if ext.Username != exts[i].Username {
			t.Fatalf("Expected %s, got: %s", exts[i].Username, ext.Username)
		}
		if ext.String() != exts[i].String() {
			t.Fatalf("Expected %s, got: %s", ext, exts[i])
		}
	}
}

func TestTlfHandleExtensionMultipleSingleUser(t *testing.T) {
	e, err := NewTestTlfHandleExtensionStaticTime(TlfHandleExtensionConflict, 2, "")
	if err != nil {
		t.Fatal(err)
	}
	e2, err := NewTestTlfHandleExtensionStaticTime(TlfHandleExtensionFinalized, 1, "")
	if err != nil {
		t.Fatal(err)
	}
	exts := []TlfHandleExtension{*e, *e2}
	suffix := NewTlfHandleExtensionSuffix(exts)
	expectSuffix := " (conflicted copy 2016-03-14 #2) (files before account reset 2016-03-14)"
	if suffix != expectSuffix {
		t.Fatalf("Expected suffix '%s', got: '%s'", expectSuffix, suffix)
	}
	exts2, err := ParseTlfHandleExtensionSuffix(suffix)
	if err != nil {
		t.Fatal(err)
	}
	if len(exts2) != 2 {
		t.Fatalf("Expected 2 extensions, got: %d", len(exts2))
	}
	for i, ext := range exts2 {
		if ext.Number != exts[i].Number {
			t.Fatalf("Expected %d, got: %d", exts[i].Number, ext.Number)
		}
		if ext.Date != exts[i].Date {
			t.Fatalf("Expected %d, got: %d", exts[i].Date, ext.Date)
		}
		if ext.Username != exts[i].Username {
			t.Fatalf("Expected %s, got: %s", exts[i].Username, ext.Username)
		}
		if ext.String() != exts[i].String() {
			t.Fatalf("Expected %s, got: %s", ext, exts[i])
		}
	}
}
