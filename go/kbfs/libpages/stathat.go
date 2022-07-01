// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libpages

import (
	"strconv"
	"strings"
	"time"

	stathat "github.com/stathat/go"
	"go.uber.org/zap"
)

type stathatReporter struct {
	logger   *zap.Logger
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

	activityStats         ActivityStatsEnabler
	statPrefixActiveHosts string
	statPrefixActiveTlfs  string
}

func (s *stathatReporter) activityStatsReportLoop() {
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
			if err = s.reporter.PostEZValue(statNamesTlfs[i], s.ezKey,
				float64(tlfs)); err != nil {
				s.logger.Warn("PostEZValue", zap.Error(err))
			}
			if err = s.reporter.PostEZValue(statNamesHosts[i], s.ezKey,
				float64(hosts)); err != nil {
				s.logger.Warn("PostEZValue", zap.Error(err))
			}
		}
	}
}

var _ StatsReporter = (*stathatReporter)(nil)

const stathatReportInterval = time.Second * 10

// NewStathatReporter create a new StatsReporter that reports stats to stathat.
// If enableActivityBasedStats, if set to non-nil, causes the reporter to
// generate activity-based stats. Caller should not modify
// enableActivityBasedStats passed into this function.
func NewStathatReporter(logger *zap.Logger, prefix string, ezKey string,
	enableActivityBasedStats *ActivityStatsEnabler) StatsReporter {
	if len(ezKey) == 0 {
		return &stathatReporter{}
	}

	enabler := enableActivityBasedStats
	if enabler == nil {
		enabler = &ActivityStatsEnabler{
			Storer:    nullActivityStatsStorer{},
			Durations: nil,
		}
	}

	prefix = strings.TrimSpace(prefix) + " "
	reporter := &stathatReporter{
		logger: logger,
		ezKey:  ezKey,
		reporter: stathat.NewBatchReporter(
			stathat.DefaultReporter, stathatReportInterval),

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

func (s *stathatReporter) postCountOneOrLog(statName string) {
	if err := s.reporter.PostEZCountOne(statName, s.ezKey); err != nil {
		s.logger.Warn("PostEZCountOne", zap.Error(err))
	}
}

// ReportServedRequest implementes the StatsReporter interface.
func (s *stathatReporter) ReportServedRequest(sri *ServedRequestInfo) {
	s.postCountOneOrLog(s.statNameRequests)
	s.postCountOneOrLog(s.statPrefixProto + sri.Proto)
	s.postCountOneOrLog(s.statPrefixStatus + strconv.Itoa(sri.HTTPStatus))
	if sri.Authenticated {
		s.postCountOneOrLog(s.statNameAuthenticated)
	}
	if sri.CloningShown {
		s.postCountOneOrLog(s.statNameCloningShown)
	}
	if sri.InvalidConfig {
		s.postCountOneOrLog(s.statNameInvalidConfig)
	}
	s.postCountOneOrLog(s.statPrefixTlfType + sri.TlfType.String())
	s.postCountOneOrLog(s.statPrefixRootType + sri.RootType.String())

	s.activityStats.Storer.RecordActives(sri.TlfID, sri.Host)
}
