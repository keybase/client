// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package tlf

import (
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/go-codec/codec"
	"github.com/stretchr/testify/require"
)

func TestHandleExtension(t *testing.T) {
	codec := kbfscodec.NewMsgpack()
	for _, et := range []HandleExtensionType{
		HandleExtensionConflict,
		HandleExtensionFinalized,
	} {
		e, err := NewHandleExtension(et, 1, "alice", time.Now())
		require.NoError(t, err)
		exts, err := ParseHandleExtensionSuffix(e.String())
		require.NoError(t, err)
		require.Len(t, exts, 1, "Expected 1 extension, got: %d", len(exts))
		// check that extensions can be encoded/decoded
		buf, err := codec.Encode(exts[0])
		require.NoError(t, err)
		var e2 HandleExtension
		err = codec.Decode(buf, &e2)
		require.NoError(t, err)
		require.Equal(t, e.Number, e2.Number, "Expected %d, got: %d", e.Number, e2.Number)
		require.Equal(t, e.Date, e2.Date, "Expected %d, got: %d", e.Date, e2.Date)
		require.Equal(t, e.String(), e2.String(), "Expected %s, got: %s", e, e2)
		if e.Type == HandleExtensionConflict {
			require.Empty(t, e2.Username, "Expected empty username got: %s", e2.Username)
			continue
		}
		require.Equal(t, e.Username, e2.Username, "Expected %s, got: %s", e.Username, e2.Username)
	}
}

func TestHandleExtensionNumber(t *testing.T) {
	for _, et := range []HandleExtensionType{
		HandleExtensionConflict,
		HandleExtensionFinalized,
	} {
		e, err := NewHandleExtension(et, 2, "bob", time.Now())
		require.NoError(t, err)
		exts, err := ParseHandleExtensionSuffix(e.String())
		require.NoError(t, err)
		require.Len(t, exts, 1, "Expected 1 extension, got: %d", len(exts))
		e2 := exts[0]
		require.Equal(t, e.Number, e2.Number, "Expected %d, got: %d", e.Number, e2.Number)
		require.Equal(t, e.Date, e2.Date, "Expected %d, got: %d", e.Date, e2.Date)
		require.Equal(t, e.String(), e2.String(), "Expected %s, got: %s", e, e2)
		if e.Type == HandleExtensionConflict {
			continue
		}
		require.Equal(t, e.Username, e2.Username, "Expected %s, got: %s", e.Username, e2.Username)
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
	require.Equal(t, expect, e.String(), "Expected %s, got: %s", expect, e)
	e2 := &HandleExtension{
		Date:   1462838400,
		Number: 12345,
		Type:   HandleExtensionConflict,
	}
	expect = "(conflicted copy 2016-05-10 #12345)"
	require.Equal(t, expect, e2.String(), "Expected %s, got: %s", expect, e2)
	e3 := &HandleExtension{
		Date:   1462838400,
		Number: 2,
		Type:   HandleExtensionFinalized,
	}
	expect = "(files before account reset 2016-05-10 #2)"
	require.Equal(t, expect, e3.String(), "Expected %s, got: %s", expect, e3)
}

func TestHandleExtensionErrors(t *testing.T) {
	_, err := NewHandleExtension(HandleExtensionConflict, 0, "", time.Now())
	require.ErrorIs(t, err, errHandleExtensionInvalidNumber,
		"Expected errHandleExtensionInvalidNumber, got: %v", err)
	_, err = ParseHandleExtensionSuffix("(conflicted copy 2016-05-10 #0)")
	require.ErrorIs(t, err, errHandleExtensionInvalidNumber,
		"Expected errHandleExtensionInvalidNumber, got: %v", err)
	_, err = ParseHandleExtensionSuffix("nope")
	require.ErrorIs(t, err, errHandleExtensionInvalidString,
		"Expected errHandleExtensionInvalidString, got: %v", err)
	_, err = ParseHandleExtensionSuffix("(conflicted copy #2)")
	require.ErrorIs(t, err, errHandleExtensionInvalidString,
		"Expected errHandleExtensionInvalidString, got: %v", err)
	_, err = ParseHandleExtensionSuffix("(conflicted copy 2016-05-10 #)")
	require.ErrorIs(t, err, errHandleExtensionInvalidString,
		"Expected errHandleExtensionInvalidString, got: %v", err)
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
	require.NoError(t, err)
	e2, err := NewTestHandleExtensionStaticTime(HandleExtensionFinalized, 2, "charlie")
	require.NoError(t, err)
	exts := []HandleExtension{*e, *e2}
	suffix := newHandleExtensionSuffix(exts, false)
	expectSuffix := " (conflicted copy 2016-03-14) (files before charlie account reset 2016-03-14 #2)"
	require.Equal(t, expectSuffix, suffix, "Expected suffix '%s', got: '%s'", expectSuffix, suffix)
	exts2, err := ParseHandleExtensionSuffix(suffix)
	require.NoError(t, err)
	require.Len(t, exts2, 2, "Expected 2 extensions, got: %d", len(exts2))
	for i, ext := range exts2 {
		require.Equal(t, exts[i].Number, ext.Number, "Expected %d, got: %d", exts[i].Number, ext.Number)
		require.Equal(t, exts[i].Date, ext.Date, "Expected %d, got: %d", exts[i].Date, ext.Date)
		require.Equal(t, exts[i].Username, ext.Username, "Expected %s, got: %s", exts[i].Username, ext.Username)
		require.Equal(t, exts[i].String(), ext.String(), "Expected %s, got: %s", ext, exts[i])
	}
}

func TestHandleExtensionMultipleSingleUser(t *testing.T) {
	e, err := NewTestHandleExtensionStaticTime(HandleExtensionConflict, 2, "")
	require.NoError(t, err)
	e2, err := NewTestHandleExtensionStaticTime(HandleExtensionFinalized, 1, "")
	require.NoError(t, err)
	exts := []HandleExtension{*e, *e2}
	suffix := newHandleExtensionSuffix(exts, false)
	expectSuffix := " (conflicted copy 2016-03-14 #2) (files before account reset 2016-03-14)"
	require.Equal(t, expectSuffix, suffix, "Expected suffix '%s', got: '%s'", expectSuffix, suffix)
	exts2, err := ParseHandleExtensionSuffix(suffix)
	require.NoError(t, err)
	require.Len(t, exts2, 2, "Expected 2 extensions, got: %d", len(exts2))
	for i, ext := range exts2 {
		require.Equal(t, exts[i].Number, ext.Number, "Expected %d, got: %d", exts[i].Number, ext.Number)
		require.Equal(t, exts[i].Date, ext.Date, "Expected %d, got: %d", exts[i].Date, ext.Date)
		require.Equal(t, exts[i].Username, ext.Username, "Expected %s, got: %s", exts[i].Username, ext.Username)
		require.Equal(t, exts[i].String(), ext.String(), "Expected %s, got: %s", ext, exts[i])
	}
}
