// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"strconv"
	"strings"
	"time"

	"github.com/keybase/kbfs/libpages"
	stathat "github.com/stathat/go"
)

type stathatReporter struct {
	ezKey    string
	reporter stathat.Reporter

	statNameRequests      string
	statNameAuthenticated string
	statPrefixProto       string
	statPrefixStatus      string
}

var _ libpages.StatsReporter = (*stathatReporter)(nil)

const stathatReportInterval = time.Second * 10

func newStathatReporter(prefix string, ezKey string) *stathatReporter {
	if len(ezKey) == 0 {
		return &stathatReporter{}
	}

	prefix = strings.TrimSpace(prefix) + " "
	return &stathatReporter{
		ezKey: ezKey,
		reporter: stathat.NewBatchReporter(
			stathat.DefaultReporter, stathatReportInterval),
		statNameRequests:      prefix + "requests",
		statNameAuthenticated: prefix + "authenticated",
		statPrefixProto:       prefix + "proto:",
		statPrefixStatus:      prefix + "status:",
	}
}

func (s *stathatReporter) ReportServedRequest(r *libpages.ServedRequestInfoForStats) {
	s.reporter.PostEZCountOne(s.statNameRequests, s.ezKey)
	s.reporter.PostEZCountOne(s.statPrefixProto+r.Proto, s.ezKey)
	s.reporter.PostEZCountOne(s.statPrefixStatus+strconv.Itoa(r.HTTPStatus), s.ezKey)
	if r.Authenticated {
		s.reporter.PostEZCountOne(s.statNameAuthenticated, s.ezKey)
	}
	// We are ignoring r.Host for now until we have a better plan to aggregate
	// stats.
}
