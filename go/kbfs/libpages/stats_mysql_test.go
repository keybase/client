// Copyright 2020 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build integration

package libpages

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strconv"
	"testing"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/keybase/client/go/kbfs/test/clocktest"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

const defaultTestDSN = "root@unix(/tmp/mysql.sock)/kbp_test?parseTime=true"
const TestDSNEnvName = "TEST_DB_DSN"

func makeMySQLActivityStatsStorerForTest(t *testing.T) (
	*mysqlActivityStatsStorer, *clocktest.TestClock) {
	logger, err := zap.NewDevelopment()
	require.NoError(t, err)
	dsn := os.Getenv(TestDSNEnvName)
	if len(dsn) == 0 {
		dsn = defaultTestDSN
	}
	db, err := sql.Open("mysql", dsn)
	require.NoError(t, err, "open mysql")
	clock := clocktest.NewTestClockNow()
	return newMySQLActivityStatsStorerNoStart(clock, db, logger), clock
}

func TestMySQLActivityStatsStorer(t *testing.T) {
	storer, clock := makeMySQLActivityStatsStorerForTest(t)
	storer.createTablesIfNotExists(context.Background())

	// Make a prefix based on time so we don't have to clear the DB in test.
	domainPrefix := strconv.FormatInt(time.Now().Unix(), 16)
	makeDomain := func(id int) string {
		return fmt.Sprintf("%s-%d.example.com", domainPrefix, id)
	}

	tlfID1, err := tlf.MakeRandomID(tlf.Public)
	require.NoError(t, err)
	tlfID2, err := tlf.MakeRandomID(tlf.Public)
	require.NoError(t, err)
	host1 := makeDomain(1)
	host2 := makeDomain(2)
	host3 := makeDomain(3)

	clock.Add(30 * time.Second)

	// At 00:30
	storer.RecordActives(tlfID1, host1)
	storer.RecordActives(tlfID1, host2)
	storer.RecordActives(tlfID2, host3)

	clock.Add(time.Minute)

	// At 01:30
	storer.RecordActives(tlfID1, host1)
	storer.RecordActives(tlfID1, host2)

	clock.Add(30 * time.Second)

	storer.flushInserts()

	// Now we're at 02:00

	check := func() {
		activeTlfs, activeHosts, err := storer.GetActives(time.Minute)
		require.NoError(t, err)
		require.Equal(t, 1, activeTlfs)
		require.Equal(t, 2, activeHosts)

		activeTlfs, activeHosts, err = storer.GetActives(2 * time.Minute)
		require.NoError(t, err)
		require.Equal(t, 2, activeTlfs)
		require.Equal(t, 3, activeHosts)
	}
	check()

	t.Logf("make sure older time don't override newer time")
	clock.Add(-5 * time.Minute)
	storer.RecordActives(tlfID1, host1)
	storer.RecordActives(tlfID1, host2)
	storer.RecordActives(tlfID2, host3)
	clock.Add(5 * time.Minute)
	storer.flushInserts()
	check()
}
