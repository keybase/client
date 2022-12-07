// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libpages

import (
	"context"
	"database/sql"

	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/ioutil"
	"github.com/keybase/client/go/kbfs/tlf"
	"go.uber.org/zap"
)

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

// GetActivesGetter implement the ActivityStatsStorer interface.
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

// MigrateActivityStatsStorerFromFileBasedToMySQL should only be used as part
// of a commandline tool.
func MigrateActivityStatsStorerFromFileBasedToMySQL(
	logger *zap.Logger, fbRootDir string, mysqlDSN string) {
	logger.Info("open mysql", zap.String("dsn", mysqlDSN))
	db, err := sql.Open("mysql", mysqlDSN)
	if err != nil {
		logger.Error("open mysql", zap.Error(err))
		return
	}
	logger.Info("create tables")
	mysqlStorer := newMySQLActivityStatsStorerNoStart(data.WallClock{}, db, logger)
	err = mysqlStorer.createTablesIfNotExists(context.Background())
	if err != nil {
		logger.Error("create tables", zap.Error(err))
		return
	}

	logger.Info("tlf stamps")
	tlfStamps, err := ioutil.ReadDir(filepath.Join(fbRootDir, dirnameTlfStamps))
	if err != nil {
		logger.Error("ReadDir tlf stamps", zap.Error(err))
		return
	}
	for _, fi := range tlfStamps {
		tlfID := tlf.ID{}
		err := tlfID.UnmarshalText([]byte(fi.Name()))
		if err != nil {
			logger.Error("skipping stamp file", zap.String("filename", fi.Name()), zap.Error(err))
			continue
		}
		mysqlStorer.tlfs[tlfID] = fi.ModTime()
	}

	logger.Info("host stamps")
	hostStamps, err := ioutil.ReadDir(filepath.Join(fbRootDir, dirnameHostStamps))
	if err != nil {
		logger.Error("ReadDir host stamps", zap.Error(err))
		return
	}
	for _, fi := range hostStamps {
		mysqlStorer.hosts[fi.Name()] = fi.ModTime()
	}

	logger.Info("flush inserts")
	mysqlStorer.flushInserts()
}
