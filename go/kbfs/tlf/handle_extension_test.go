// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package tlf

import (
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/go-codec/codec"
)

func TestHandleExtension(t *testing.T) {
	codec := kbfscodec.NewMsgpack()
	for _, et := range []HandleExtensionType{
		HandleExtensionConflict,
		HandleExtensionFinalized,
	} {
		e, err := NewHandleExtension(et, 1, "alice", time.Now())
		if err != nil {
			t.Fatal(err)
		}
		exts, err := ParseHandleExtensionSuffix(e.String())
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
		var e2 HandleExtension
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
		if e.Type == HandleExtensionConflict {
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

func TestHandleExtensionNumber(t *testing.T) {
	for _, et := range []HandleExtensionType{
		HandleExtensionConflict,
		HandleExtensionFinalized,
	} {
		e, err := NewHandleExtension(et, 2, "bob", time.Now())
		if err != nil {
			t.Fatal(err)
		}
		exts, err := ParseHandleExtensionSuffix(e.String())
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
		if e.Type == HandleExtensionConflict {
			continue
		}
		if e2.Username != e.Username {
			t.Fatalf("Expected %s, got: %s", e.Username, e2.Username)
		}
	}
}

func TestHandleExtensionKnownTime(t *testing.T) {
	e := &HandleExtension{
		Date:     1462838400,
		Number:   1,
		Type:     HandleExtensionFinalized,
		Username: "alice",
	}
	expect := "(files before alice account reset 2016-05-10)"
	if e.String() != expect {
		t.Fatalf("Expected %s, got: %s", expect, e)
	}
	e2 := &HandleExtension{
		Date:   1462838400,
		Number: 12345,
		Type:   HandleExtensionConflict,
	}
	expect = "(conflicted copy 2016-05-10 #12345)"
	if e2.String() != expect {
		t.Fatalf("Expected %s, got: %s", expect, e2)
	}
	e3 := &HandleExtension{
		Date:   1462838400,
		Number: 2,
		Type:   HandleExtensionFinalized,
	}
	expect = "(files before account reset 2016-05-10 #2)"
	if e3.String() != expect {
		t.Fatalf("Expected %s, got: %s", expect, e3)
	}
}

func TestHandleExtensionErrors(t *testing.T) {
	_, err := NewHandleExtension(HandleExtensionConflict, 0, "", time.Now())
	if err != errHandleExtensionInvalidNumber {
		t.Fatalf("Expected errHandleExtensionInvalidNumber, got: %v", err)
	}
	_, err = ParseHandleExtensionSuffix("(conflicted copy 2016-05-10 #0)")
	if err != errHandleExtensionInvalidNumber {
		t.Fatalf("Expected errHandleExtensionInvalidNumber, got: %v", err)
	}
	_, err = ParseHandleExtensionSuffix("nope")
	if err != errHandleExtensionInvalidString {
		t.Fatalf("Expected errHandleExtensionInvalidString, got: %v", err)
	}
	_, err = ParseHandleExtensionSuffix("(conflicted copy #2)")
	if err != errHandleExtensionInvalidString {
		t.Fatalf("Expected errHandleExtensionInvalidString, got: %v", err)
	}
	_, err = ParseHandleExtensionSuffix("(conflicted copy 2016-05-10 #)")
	if err != errHandleExtensionInvalidString {
		t.Fatalf("Expected errHandleExtensionInvalidString, got: %v", err)
	}
}

type tlfHandleExtensionFuture struct {
	HandleExtension
	kbfscodec.Extra
}

func (ci tlfHandleExtensionFuture) ToCurrentStruct() kbfscodec.CurrentStruct {
	return ci.HandleExtension
}

func TestHandleExtensionUnknownFields(t *testing.T) {
	cFuture := kbfscodec.NewMsgpack()
	cCurrent := kbfscodec.NewMsgpack()
	cCurrentKnownOnly := kbfscodec.NewMsgpackNoUnknownFields()
	kbfscodec.TestStructUnknownFields(t,
		cFuture, cCurrent, cCurrentKnownOnly,
		tlfHandleExtensionFuture{
			HandleExtension{
				time.Now().UTC().Unix(),
				2,
				HandleExtensionFinalized,
				"",
				codec.UnknownFieldSetHandler{},
			},
			kbfscodec.MakeExtraOrBust("HandleExtension", t),
		})
}

func TestHandleExtensionMultiple(t *testing.T) {
	e, err := NewTestHandleExtensionStaticTime(HandleExtensionConflict, 1, "")
	if err != nil {
		t.Fatal(err)
	}
	e2, err := NewTestHandleExtensionStaticTime(HandleExtensionFinalized, 2, "charlie")
	if err != nil {
		t.Fatal(err)
	}
	exts := []HandleExtension{*e, *e2}
	suffix := newHandleExtensionSuffix(exts, false)
	expectSuffix := " (conflicted copy 2016-03-14) (files before charlie account reset 2016-03-14 #2)"
	if suffix != expectSuffix {
		t.Fatalf("Expected suffix '%s', got: '%s'", expectSuffix, suffix)
	}
	exts2, err := ParseHandleExtensionSuffix(suffix)
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

func TestHandleExtensionMultipleSingleUser(t *testing.T) {
	e, err := NewTestHandleExtensionStaticTime(HandleExtensionConflict, 2, "")
	if err != nil {
		t.Fatal(err)
	}
	e2, err := NewTestHandleExtensionStaticTime(HandleExtensionFinalized, 1, "")
	if err != nil {
		t.Fatal(err)
	}
	exts := []HandleExtension{*e, *e2}
	suffix := newHandleExtensionSuffix(exts, false)
	expectSuffix := " (conflicted copy 2016-03-14 #2) (files before account reset 2016-03-14)"
	if suffix != expectSuffix {
		t.Fatalf("Expected suffix '%s', got: '%s'", expectSuffix, suffix)
	}
	exts2, err := ParseHandleExtensionSuffix(suffix)
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
