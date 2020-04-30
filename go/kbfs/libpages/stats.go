// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libpages

import (
	"errors"
	"time"

	"github.com/keybase/client/go/kbfs/tlf"
)

// ActivesGetter holds necessary data to generate number of active TLFs or
// hosts.
type ActivesGetter interface {
	// GetActives returns the number of active TLFs and active hosts in the
	// past dur.
	GetActives(dur time.Duration) (activeTlfs int, activeHosts int, err error)
}

// ActivityStatsStorer defines a set of methods to record activities based on
// TLF ID and host names.
type ActivityStatsStorer interface {
	// RecordActives records that tlfID and host has just been active.
	RecordActives(tlfID tlf.ID, host string)

	// GetActivesGetter returns a ActivesGetter from current state of the
	// ActivityStatsStorer.
	GetActivesGetter() (ActivesGetter, error)
}

// NameableDuration is a wrapper around time.Duration that allows customized
// String() encoding.
type NameableDuration struct {
	Duration time.Duration
	Name     string
}

// String returns d.Name if it's not empty, or d.Duration.String().
func (d NameableDuration) String() string {
	if len(d.Name) > 0 {
		return d.Name
	}
	return d.Duration.String()
}

// ActivityStatsEnabler describes what backend storer a StatsReporter should
// use for activity-based stats, and how the stats should be generated.
type ActivityStatsEnabler struct {
	// Storer specifies a backend storer that a StatsReporter should use to
	// store data necessary for generating activity-based stats.
	Storer ActivityStatsStorer
	// Durations specifies a slice of durations that activity-based stats
	// should be about. For example, [1h, 1d, 1week] makes the StatsReporter
	// should report hourly, daily, and weekly active stats.
	Durations []NameableDuration
	// Interval specifies how often the activity-based stats should be
	// reported.
	Interval time.Duration
}

// StatsReporter defines a collection of methods for stats reporting.
type StatsReporter interface {
	// ReportServedRequest is called by libpages whenever a request comes in.
	ReportServedRequest(r *ServedRequestInfo)
}

type multiStatReporter []StatsReporter

var _ StatsReporter = multiStatReporter(nil)

// NewMultiStatReporter creates a StatsReporter that reports through all passed
// in reporters.
func NewMultiStatReporter(reporters ...StatsReporter) StatsReporter {
	return multiStatReporter(reporters)
}

// ReportServedRequest implements the StatsReporter interface.
func (m multiStatReporter) ReportServedRequest(
	r *ServedRequestInfo) {
	for _, reporter := range m {
		reporter.ReportServedRequest(r)
	}
}

type nullActivityStatsStorer struct{}

var _ ActivityStatsStorer = nullActivityStatsStorer{}

// RecordActives (does not) implement the ActivityStatsStorer interface.
func (nullActivityStatsStorer) RecordActives(tlf.ID, string) {}

// GetActiveTlfs (does not) implement the ActivityStatsStorer interface.
func (nullActivityStatsStorer) GetActivesGetter() (ActivesGetter, error) {
	return nil, errors.New("not supported")
}
