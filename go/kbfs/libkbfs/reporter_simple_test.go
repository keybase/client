// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"testing"

	"github.com/keybase/kbfs/tlf"
)

func checkReportedErrors(t *testing.T, expected []error,
	got []ReportedError) {
	if len(expected) != len(got) {
		t.Errorf("Unexpected number of errors: %d", len(got))
		return
	}

	for i, e := range expected {
		g := got[i]
		if e != g.Error {
			t.Errorf("Unexpected error at %d: %s vs %s", i, e, g.Error)
		}
	}
}

func TestReporterSimpleMaxLimited(t *testing.T) {
	r := NewReporterSimple(wallClock{}, 3)
	err1 := errors.New("1")
	r.ReportErr(nil, "", tlf.Private, ReadMode, err1)
	checkReportedErrors(t, []error{err1}, r.AllKnownErrors())
	err2 := errors.New("2")
	r.ReportErr(nil, "", tlf.Private, ReadMode, err2)
	err3 := errors.New("3")
	r.ReportErr(nil, "", tlf.Private, ReadMode, err3)
	checkReportedErrors(t, []error{err1, err2, err3}, r.AllKnownErrors())
	err4 := errors.New("4")
	r.ReportErr(nil, "", tlf.Private, ReadMode, err4)
	checkReportedErrors(t, []error{err2, err3, err4}, r.AllKnownErrors())
	err5 := errors.New("5")
	r.ReportErr(nil, "", tlf.Private, ReadMode, err5)
	err6 := errors.New("6")
	r.ReportErr(nil, "", tlf.Private, ReadMode, err6)
	checkReportedErrors(t, []error{err4, err5, err6}, r.AllKnownErrors())
}

func TestReporterSimpleUnlimited(t *testing.T) {
	r := NewReporterSimple(wallClock{}, 0)
	err1 := errors.New("1")
	r.ReportErr(nil, "", tlf.Private, ReadMode, err1)
	checkReportedErrors(t, []error{err1}, r.AllKnownErrors())
	err2 := errors.New("2")
	r.ReportErr(nil, "", tlf.Private, ReadMode, err2)
	err3 := errors.New("3")
	r.ReportErr(nil, "", tlf.Private, ReadMode, err3)
	checkReportedErrors(t, []error{err1, err2, err3}, r.AllKnownErrors())
	err4 := errors.New("4")
	r.ReportErr(nil, "", tlf.Private, ReadMode, err4)
	checkReportedErrors(t, []error{err1, err2, err3, err4}, r.AllKnownErrors())
	err5 := errors.New("5")
	r.ReportErr(nil, "", tlf.Private, ReadMode, err5)
	err6 := errors.New("6")
	r.ReportErr(nil, "", tlf.Private, ReadMode, err6)
	checkReportedErrors(t, []error{err1, err2, err3, err4, err5, err6},
		r.AllKnownErrors())
}
