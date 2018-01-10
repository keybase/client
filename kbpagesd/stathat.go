// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"strconv"
	"strings"
	"time"

	"github.com/keybase/kbfs/libpages"
	"github.com/keybase/kbfs/tlf"
	stathat "github.com/stathat/go"
)

type activeTracked struct {
	host  string
	tlfID tlf.ID
}

type stathatReporter struct {
	ezKey    string
	reporter stathat.Reporter

	statNameRequests      string
	statNameAuthenticated string
	statNameCloningShown  string
	statNameInvalidConfig string
	statPrefixProto       string
	statPrefixStatus      string
	statPrefixTlfType     string
	statPrefixRootType    string

	activeCh chan activeTracked
	// The four maps below can only be modified by a single goroutine, thus no
	// requiring a lock.
	dailyActiveHosts  map[string]struct{}
	dailyActiveTlfs   map[tlf.ID]struct{}
	hourlyActiveHosts map[string]struct{}
	hourlyActiveTlfs  map[tlf.ID]struct{}

	statNameDailyActiveHosts  string
	statNameDailyActiveTlfs   string
	statNameHourlyActiveHosts string
	statNameHourlyActiveTlfs  string
}

var _ libpages.StatsReporter = (*stathatReporter)(nil)

const stathatReportInterval = time.Second * 10
const activeChSize = 1024

// NOTE that this won't work for a multi-instance deployment. But before we
// start to horizontal scale, this should be good enough.
func (s *stathatReporter) postActivesLoop() {
	hourlyTicker := time.NewTicker(time.Hour)
	dailyTicker := time.NewTicker(time.Hour * 24)
	for {
		select {
		case tracked := <-s.activeCh:
			s.hourlyActiveHosts[tracked.host] = struct{}{}
			s.hourlyActiveTlfs[tracked.tlfID] = struct{}{}
			s.dailyActiveHosts[tracked.host] = struct{}{}
			s.dailyActiveTlfs[tracked.tlfID] = struct{}{}
		case <-hourlyTicker.C:
			s.reporter.PostEZCount(
				s.statNameHourlyActiveHosts, s.ezKey, len(s.hourlyActiveHosts))
			s.reporter.PostEZCount(
				s.statNameHourlyActiveTlfs, s.ezKey, len(s.hourlyActiveTlfs))
			s.hourlyActiveHosts = make(map[string]struct{})
			s.hourlyActiveTlfs = make(map[tlf.ID]struct{})

		case <-dailyTicker.C:
			s.reporter.PostEZCount(
				s.statNameDailyActiveHosts, s.ezKey, len(s.dailyActiveHosts))
			s.reporter.PostEZCount(
				s.statNameDailyActiveTlfs, s.ezKey, len(s.dailyActiveTlfs))
			s.dailyActiveHosts = make(map[string]struct{})
			s.dailyActiveTlfs = make(map[tlf.ID]struct{})
		}
	}
}

func newStathatReporter(prefix string, ezKey string) *stathatReporter {
	if len(ezKey) == 0 {
		return &stathatReporter{}
	}

	prefix = strings.TrimSpace(prefix) + " "
	reporter := &stathatReporter{
		ezKey: ezKey,
		reporter: stathat.NewBatchReporter(
			stathat.DefaultReporter, stathatReportInterval),

		statNameRequests:      prefix + "requests",
		statNameAuthenticated: prefix + "authenticated",
		statNameCloningShown:  prefix + "cloningShown:",
		statNameInvalidConfig: prefix + "invalidConfig:",
		statPrefixProto:       prefix + "proto:",
		statPrefixStatus:      prefix + "status:",
		statPrefixTlfType:     prefix + "tlfType:",
		statPrefixRootType:    prefix + "rootType:",

		activeCh:          make(chan activeTracked, activeChSize),
		dailyActiveHosts:  make(map[string]struct{}),
		dailyActiveTlfs:   make(map[tlf.ID]struct{}),
		hourlyActiveHosts: make(map[string]struct{}),
		hourlyActiveTlfs:  make(map[tlf.ID]struct{}),

		statNameDailyActiveHosts:  prefix + "dailyActiveHosts:",
		statNameDailyActiveTlfs:   prefix + "dailyActiveTlfs:",
		statNameHourlyActiveHosts: prefix + "hourlyActiveHosts:",
		statNameHourlyActiveTlfs:  prefix + "hourlyActiveTlfs:",
	}
	go reporter.postActivesLoop()
	return reporter
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
	if sri.CloningShown {
		s.reporter.PostEZCountOne(
			s.statNameCloningShown, s.ezKey)
	}
	if sri.InvalidConfig {
		s.reporter.PostEZCountOne(
			s.statNameInvalidConfig, s.ezKey)
	}
	s.reporter.PostEZCountOne(
		s.statPrefixTlfType+sri.TlfType.String(), s.ezKey)
	s.reporter.PostEZCountOne(
		s.statPrefixRootType+sri.RootType.String(), s.ezKey)

	s.activeCh <- activeTracked{host: sri.Host, tlfID: sri.TlfID}
}
