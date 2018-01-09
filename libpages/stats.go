// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libpages

// ServedRequestInfoForStats holds information regarding to an incoming request
// that might be useful for stats.
type ServedRequestInfoForStats struct {
	// Host is the `Host` field of http.Request.
	Host string
	// Proto is the `Proto` field of http.Request.
	Proto string
	// Authenticated means the client set WWW-Authenticate in this request and
	// authentication using the given credentials has succeeded. It doesn't
	// necessarily indicate that the authentication is required for this
	// particular request.
	Authenticated bool

	// HTTPStatus is the HTTP status code that we have written for the request
	// in the response header.
	HTTPStatus int
}

// StatsReporter defines a collection of methods for stats reporting.
type StatsReporter interface {
	ReportServedRequest(r *ServedRequestInfoForStats)
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
	r *ServedRequestInfoForStats) {
	for _, reporter := range m {
		reporter.ReportServedRequest(r)
	}
}
