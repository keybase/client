package libkbfs

import (
	"errors"
	"fmt"
	"testing"
)

func checkReportedErrors(t *testing.T, expected []fmt.Stringer,
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
	r := NewReporterSimple(3)
	err1 := WrapError{errors.New("1")}
	r.Report(RptE, err1)
	checkReportedErrors(t, []fmt.Stringer{err1}, r.AllKnownErrors())
	err2 := WrapError{errors.New("2")}
	r.Report(RptE, err2)
	err3 := WrapError{errors.New("3")}
	r.Report(RptE, err3)
	checkReportedErrors(t, []fmt.Stringer{err1, err2, err3}, r.AllKnownErrors())
	err4 := WrapError{errors.New("4")}
	r.Report(RptE, err4)
	checkReportedErrors(t, []fmt.Stringer{err2, err3, err4}, r.AllKnownErrors())
	err5 := WrapError{errors.New("5")}
	r.Report(RptE, err5)
	err6 := WrapError{errors.New("6")}
	r.Report(RptE, err6)
	checkReportedErrors(t, []fmt.Stringer{err4, err5, err6}, r.AllKnownErrors())
}

func TestReporterSimpleUnlimited(t *testing.T) {
	r := NewReporterSimple(0)
	err1 := WrapError{errors.New("1")}
	r.Report(RptE, err1)
	checkReportedErrors(t, []fmt.Stringer{err1}, r.AllKnownErrors())
	err2 := WrapError{errors.New("2")}
	r.Report(RptE, err2)
	err3 := WrapError{errors.New("3")}
	r.Report(RptE, err3)
	checkReportedErrors(t, []fmt.Stringer{err1, err2, err3}, r.AllKnownErrors())
	err4 := WrapError{errors.New("4")}
	r.Report(RptE, err4)
	checkReportedErrors(t, []fmt.Stringer{err1, err2, err3, err4},
		r.AllKnownErrors())
	err5 := WrapError{errors.New("5")}
	r.Report(RptE, err5)
	err6 := WrapError{errors.New("6")}
	r.Report(RptE, err6)
	checkReportedErrors(t, []fmt.Stringer{err1, err2, err3, err4, err5, err6},
		r.AllKnownErrors())
}
