package kbtime

import (
	"fmt"
	"strings"
	"time"

	humanize "github.com/dustin/go-humanize"
)

// RelTime is a thin wrapper around github.com/dustin/go-humanize
// in order to provide more accurate data for large durations.
// Below description is from go-humanize:
//
// RelTime formats a time into a relative string.
//
// It takes two times and two labels.  In addition to the generic time
// delta string (e.g. 5 minutes), the labels are used applied so that
// the label corresponding to the smaller time is applied.
//
// RelTime(timeInPast, timeInFuture, "earlier", "later") -> "3 weeks earlier"
func RelTime(a, b time.Time, albl, blbl string) string {
	lbl := albl
	diff := b.Unix() - a.Unix()
	yearDiff := b.Year() - a.Year()
	after := a.After(b)
	if after {
		lbl = blbl
		diff = a.Unix() - b.Unix()
		yearDiff = a.Year() - b.Year()
	}
	if diff > 18*humanize.Month {
		if lbl != "" {
			lbl = " " + lbl
		}
		pl := ""
		if yearDiff > 1 {
			pl = "s"
		}
		return fmt.Sprintf("%d year%s%s", yearDiff, pl, lbl)
	}

	return strings.TrimSuffix(humanize.RelTime(a, b, albl, blbl), " ")
}
