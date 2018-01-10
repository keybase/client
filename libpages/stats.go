// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libpages

// StatsReporter defines a collection of methods for stats reporting.
type StatsReporter interface {
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
