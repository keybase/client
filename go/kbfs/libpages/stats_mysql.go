// Copyright 2020 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libpages

import (
	"context"
	"database/sql"
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"go.uber.org/zap"
)

type mysqlActivityStatsStorer struct {
	logger *zap.Logger
	db     *sql.DB
	clock  libkbfs.Clock

	lock  sync.Mutex
	tlfs  map[tlf.ID]time.Time
	hosts map[string]time.Time
}

func newMySQLActivityStatsStorerNoStart(clock libkbfs.Clock,
	db *sql.DB, logger *zap.Logger) *mysqlActivityStatsStorer {
	return &mysqlActivityStatsStorer{
		logger: logger,
		db:     db,
		clock:  clock,
		tlfs:   make(map[tlf.ID]time.Time),
		hosts:  make(map[string]time.Time),
	}
}

// NewMySQLActivityStatsStorer creates an ActivityStatsStorer that stores
// activities on a MySQL database.
func NewMySQLActivityStatsStorer(
	db *sql.DB, logger *zap.Logger) ActivityStatsStorer {
	s := newMySQLActivityStatsStorerNoStart(data.WallClock{}, db, logger)
	// TODO shutdown()
	go s.insertLoop(context.Background())
	return s
}

func (s *mysqlActivityStatsStorer) createTablesIfNotExists(
	ctx context.Context) (err error) {
	if _, err = s.db.ExecContext(ctx, `
        CREATE TABLE IF NOT EXISTS stats_tlf (
          id          bigint unsigned NOT NULL AUTO_INCREMENT,
          tlf_id      char(32)        NOT NULL,
          active_time datetime(3)     NOT NULL,

          PRIMARY KEY                 (id),
          UNIQUE KEY  idx_tlf_id      (tlf_id),
          KEY         idx_active_time (active_time)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `); err != nil {
		return err
	}
	if _, err = s.db.ExecContext(ctx, `
        CREATE TABLE IF NOT EXISTS stats_host (
          id          bigint unsigned NOT NULL AUTO_INCREMENT,
          -- max key length is 767. floor(767/4)==191
          domain      varchar(191)    NOT NULL, 
          active_time datetime(3)     NOT NULL,

          PRIMARY KEY                 (id),
          UNIQUE KEY  idx_domain      (domain),
          KEY         idx_active_time (active_time)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `); err != nil {
		return err
	}

	return nil
}

const mysqlStatFlushTimeout = time.Minute / 2

func (s *mysqlActivityStatsStorer) flushInserts() {
	s.lock.Lock()
	tlfs := s.tlfs
	hosts := s.hosts
	s.tlfs = make(map[tlf.ID]time.Time)
	s.hosts = make(map[string]time.Time)
	s.lock.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), mysqlStatFlushTimeout)
	defer cancel()

	for tlfID, t := range tlfs {
		if _, err := s.db.ExecContext(ctx, `
            INSERT INTO stats_tlf (tlf_id, active_time)
                VALUES (?, ?)
            ON DUPLICATE KEY UPDATE
                active_time = GREATEST(active_time, ?)`,
			tlfID.String(), t, t); err != nil {
			s.logger.Warn("INSERT INTO stats_tlf", zap.Error(err))
		}
	}
	for host, t := range hosts {
		if _, err := s.db.ExecContext(ctx, `
            INSERT INTO stats_host (domain, active_time)
                VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE
                active_time = GREATEST(active_time, ?)`,
			host, t, t); err != nil {
			s.logger.Warn("INSERT INTO stats_host", zap.Error(err))
		}
	}
}

func (s *mysqlActivityStatsStorer) getActiveTlfs(
	ctx context.Context, since time.Time) (int, error) {
	var count int
	if err := s.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM stats_tlf where active_time > ?",
		since).Scan(&count); err != nil {
		return 0, err
	}

	return count, nil
}

func (s *mysqlActivityStatsStorer) getActiveHosts(
	ctx context.Context, since time.Time) (int, error) {
	var count int
	if err := s.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM stats_host where active_time > ?",
		since).Scan(&count); err != nil {
		return 0, err
	}

	return count, nil
}

func (s *mysqlActivityStatsStorer) stageInserts(tlfID tlf.ID, host string) {
	s.lock.Lock()
	defer s.lock.Unlock()
	s.tlfs[tlfID] = s.clock.Now()
	s.hosts[host] = s.clock.Now()
}

const mysqlStatInsertInterval = 4 * time.Second

func (s *mysqlActivityStatsStorer) insertLoop(ctx context.Context) {
	ticker := time.NewTicker(mysqlStatInsertInterval)
	for {
		select {
		case <-ticker.C:
			s.flushInserts()
		case <-ctx.Done():
			return
		}
	}
}

// RecordActives implement the ActivityStatsStorer interface.
func (s *mysqlActivityStatsStorer) RecordActives(tlfID tlf.ID, host string) {
	s.stageInserts(tlfID, host)
}

const mysqlGetActivesTimeout = 4 * time.Second

// RecordActives implement the ActivesGetter interface.
func (s *mysqlActivityStatsStorer) GetActives(dur time.Duration) (
	activeTlfs int, activeHosts int, err error) {
	ctx, cancel := context.WithTimeout(context.Background(), mysqlGetActivesTimeout)
	defer cancel()
	since := s.clock.Now().Add(-dur)
	if activeTlfs, err = s.getActiveTlfs(ctx, since); err != nil {
		return 0, 0, err
	}
	if activeHosts, err = s.getActiveHosts(ctx, since); err != nil {
		return 0, 0, err
	}
	return activeTlfs, activeHosts, nil
}

// GetActivesGetter implement the ActivityStatsStorer interface.
func (s *mysqlActivityStatsStorer) GetActivesGetter() (ActivesGetter, error) {
	return s, nil
}
