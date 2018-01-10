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
	statPrefixTlfType     string
	statPrefixRootType    string
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
		statPrefixTlfType:     prefix + "tlfType:",
		statPrefixRootType:    prefix + "rootType:",
	}
}

func (s *stathatReporter) ReportServedRequest(sri *libpages.ServedRequestInfo) {
	s.reporter.PostEZCountOne(
		s.statNameRequests, s.ezKey)
	s.reporter.PostEZCountOne(
		s.statPrefixProto+sri.Proto, s.ezKey)
	s.reporter.PostEZCountOne(
		s.statPrefixStatus+strconv.Itoa(sri.HTTPStatus), s.ezKey)
	if sri.Authenticated {
		s.reporter.PostEZCountOne(
			s.statNameAuthenticated, s.ezKey)
	}
	s.reporter.PostEZCountOne(
		s.statPrefixTlfType+sri.TlfType.String(), s.ezKey)
	s.reporter.PostEZCountOne(
		s.statPrefixRootType+sri.RootType.String(), s.ezKey)
	// We are ignoring sri.Host for now until we have a better plan to aggregate
	// stats.
}
