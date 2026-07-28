// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libpages

import (
	"context"
	"strconv"
	"strings"
	"time"

	showtrends "github.com/keybase/showtrends-sdk/go"
	"go.uber.org/zap"
)

type showtrendsClient interface {
	CountOne(name string)
	Value(name string, value float64)
}

type showtrendsReporter struct {
	logger *zap.Logger
	client showtrendsClient

	statNameRequests      string
	statNameAuthenticated string
	statNameCloningShown  string
	statNameInvalidConfig string
	statPrefixProto       string
	statPrefixStatus      string
	statPrefixTlfType     string
	statPrefixRootType    string

	activityStats         ActivityStatsEnabler
	statPrefixActiveHosts string
	statPrefixActiveTlfs  string
}

func (s *showtrendsReporter) activityStatsReportLoop() {
	if len(s.activityStats.Durations) == 0 || s.activityStats.Interval == 0 {
		return
	}

	durations := make([]NameableDuration, len(s.activityStats.Durations))
	copy(durations, s.activityStats.Durations)
	statNamesHosts := make([]string, 0, len(durations))
	statNamesTlfs := make([]string, 0, len(durations))
	for _, d := range durations {
		statNamesHosts = append(statNamesHosts,
			s.statPrefixActiveHosts+"("+d.String()+")")
		statNamesTlfs = append(statNamesTlfs,
			s.statPrefixActiveTlfs+"("+d.String()+")")
	}
	reportTicker := time.NewTicker(s.activityStats.Interval)
	defer reportTicker.Stop()

	for range reportTicker.C {
		getter, err := s.activityStats.Storer.GetActivesGetter()
		if err != nil {
			s.logger.Warn("GetActivesGetter", zap.Error(err))
			continue
		}
		for i, d := range durations {
			tlfs, hosts, err := getter.GetActives(d.Duration)
			if err != nil {
				s.logger.Warn("GetActives", zap.Error(err))
			}
			s.client.Value(statNamesTlfs[i], float64(tlfs))
			s.client.Value(statNamesHosts[i], float64(hosts))
		}
	}
}

var _ StatsReporter = (*showtrendsReporter)(nil)

// NewShowtrendsReporter creates a StatsReporter that reports to ShowTrends.
// If enableActivityBasedStats is non-nil, the reporter also generates
// activity-based stats. The caller must not modify enableActivityBasedStats
// after passing it to this function. The returned close function flushes
// pending stats.
func NewShowtrendsReporter(logger *zap.Logger, prefix, addr string,
	enableActivityBasedStats *ActivityStatsEnabler,
) (StatsReporter, func(context.Context) error) {
	client := showtrends.NewClient(
		addr, "kbfs", showtrends.DefaultBatchInterval)
	return newShowtrendsReporter(
		logger, prefix, client, enableActivityBasedStats), client.Close
}

func newShowtrendsReporter(logger *zap.Logger, prefix string,
	client showtrendsClient, enableActivityBasedStats *ActivityStatsEnabler,
) StatsReporter {
	enabler := enableActivityBasedStats
	if enabler == nil {
		enabler = &ActivityStatsEnabler{
			Storer:    nullActivityStatsStorer{},
			Durations: nil,
		}
	}

	prefix = strings.TrimSpace(prefix) + " "
	reporter := &showtrendsReporter{
		logger: logger,
		client: client,

		statNameRequests:      prefix + "requests",
		statNameAuthenticated: prefix + "authenticated",
		statNameCloningShown:  prefix + "cloningShown",
		statNameInvalidConfig: prefix + "invalidConfig",
		statPrefixProto:       prefix + "proto:",
		statPrefixStatus:      prefix + "status:",
		statPrefixTlfType:     prefix + "tlfType:",
		statPrefixRootType:    prefix + "rootType:",

		activityStats:         *enabler,
		statPrefixActiveHosts: prefix + "activeHosts:",
		statPrefixActiveTlfs:  prefix + "activeTlfs:",
	}
	go reporter.activityStatsReportLoop()
	return reporter
}

// ReportServedRequest implements the StatsReporter interface.
func (s *showtrendsReporter) ReportServedRequest(sri *ServedRequestInfo) {
	s.client.CountOne(s.statNameRequests)
	s.client.CountOne(s.statPrefixProto + sri.Proto)
	s.client.CountOne(s.statPrefixStatus + strconv.Itoa(sri.HTTPStatus))
	if sri.Authenticated {
		s.client.CountOne(s.statNameAuthenticated)
	}
	if sri.CloningShown {
		s.client.CountOne(s.statNameCloningShown)
	}
	if sri.InvalidConfig {
		s.client.CountOne(s.statNameInvalidConfig)
	}
	s.client.CountOne(s.statPrefixTlfType + sri.TlfType.String())
	s.client.CountOne(s.statPrefixRootType + sri.RootType.String())

	s.activityStats.Storer.RecordActives(sri.TlfID, sri.Host)
}
