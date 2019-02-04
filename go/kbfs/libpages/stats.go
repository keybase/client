// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libpages

import (
	"errors"
	"io/ioutil"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/keybase/client/go/kbfs/tlf"
	"go.uber.org/zap"
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

type activity struct {
	tlfID tlf.ID
	host  string
}

type fileBasedActivityStatsStorer struct {
	root   string
	logger *zap.Logger
	ch     chan activity
}

const (
	dirnameTlfStamps  = "tlf-stamps"
	dirnameHostStamps = "host-stamps"

	fbassChSize        = 1000
	fbassStoreInterval = time.Second * 10
)

func (s *fileBasedActivityStatsStorer) processLoop() {
	// We won't worry about cleaning up these two maps since this storer is
	// meant to be only used for up to ~1000 entries anyway.
	recentProcessedTlfs := make(map[tlf.ID]time.Time)
	recentProcessedHosts := make(map[string]time.Time)
	for a := range s.ch {
		// The end result we want is a file with mtime set to now. os.Create
		// uses the O_TRUNC flag which does that for existing files.

		lastProcessed, ok := recentProcessedTlfs[a.tlfID]
		if !ok || time.Since(lastProcessed) > fbassStoreInterval {
			if f, err := os.Create(filepath.Join(
				s.root, dirnameTlfStamps, a.tlfID.String())); err == nil {
				f.Close()
				recentProcessedTlfs[a.tlfID] = time.Now()
			} else {
				s.logger.Warn("os.Create", zap.Error(err))
			}
		}

		lastProcessed, ok = recentProcessedHosts[a.host]
		if !ok || time.Since(lastProcessed) > fbassStoreInterval {
			if f, err := os.Create(filepath.Join(
				s.root, dirnameHostStamps, a.host)); err == nil {
				f.Close()
				recentProcessedHosts[a.host] = time.Now()
			} else {
				s.logger.Warn("os.Create", zap.Error(err))
			}
		}
	}
}

// NewFileBasedActivityStatsStorer creates an ActivityStatsStorer that stores
// activities on a local filesystem.
//
// NOTE that this is meant to be for development and
// testing only and does not scale well.
func NewFileBasedActivityStatsStorer(
	rootPath string, logger *zap.Logger) (ActivityStatsStorer, error) {
	err := os.MkdirAll(filepath.Join(rootPath, dirnameTlfStamps), os.ModeDir|0700)
	if err != nil {
		return nil, err
	}
	err = os.MkdirAll(filepath.Join(rootPath, dirnameHostStamps), os.ModeDir|0700)
	if err != nil {
		return nil, err
	}
	s := &fileBasedActivityStatsStorer{
		root:   rootPath,
		logger: logger,
		ch:     make(chan activity, fbassChSize),
	}
	go s.processLoop()
	return s, nil
}

// RecordActives implement the ActivityStatsStorer interface.
func (s *fileBasedActivityStatsStorer) RecordActives(tlf tlf.ID, host string) {
	s.ch <- activity{tlfID: tlf, host: host}
}

type fileinfoActivesGetter struct {
	tlfs   []os.FileInfo
	hosts  []os.FileInfo
	sorted bool
}

func (g *fileinfoActivesGetter) GetActives(
	dur time.Duration) (tlfs, hosts int, err error) {
	if !g.sorted {
		// Sort in decreasing order by time.
		sort.Slice(g.tlfs, func(i int, j int) bool {
			return g.tlfs[i].ModTime().After(g.tlfs[j].ModTime())
		})
		sort.Slice(g.hosts, func(i int, j int) bool {
			return g.hosts[i].ModTime().After(g.hosts[j].ModTime())
		})
		g.sorted = true
	}
	cutoff := time.Now().Add(-dur)
	// sort.Search requires a false,false...true,true... sequence.
	tlfs = sort.Search(len(g.tlfs), func(i int) bool {
		return cutoff.After(g.tlfs[i].ModTime())
	})
	hosts = sort.Search(len(g.hosts), func(i int) bool {
		return cutoff.After(g.hosts[i].ModTime())
	})

	return tlfs, hosts, nil
}

// GetActiveTlfs implement the ActivityStatsStorer interface.
func (s *fileBasedActivityStatsStorer) GetActivesGetter() (
	getter ActivesGetter, err error) {
	tlfStamps, err := ioutil.ReadDir(filepath.Join(s.root, dirnameTlfStamps))
	if err != nil {
		return nil, err
	}
	hostStamps, err := ioutil.ReadDir(filepath.Join(s.root, dirnameHostStamps))
	if err != nil {
		return nil, err
	}
	return &fileinfoActivesGetter{
		tlfs:  tlfStamps,
		hosts: hostStamps,
	}, nil
}
