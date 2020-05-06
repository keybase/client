// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"

	"github.com/keybase/client/go/kbfs/env"
	"github.com/keybase/client/go/kbfs/libgit"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/libpages"
	"github.com/keybase/client/go/kbfs/simplefs"
	"github.com/keybase/client/go/kbfs/stderrutils"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var (
	fProd          bool
	fDiskCertCache bool
	fKBFSLogFile   string
	fStathatEZKey  string
	fStathatPrefix string
	fBlacklist     string
	fMySQLDSN      string
)

func init() {
	flag.BoolVar(&fProd, "prod", false, "disable development mode")
	flag.BoolVar(&fDiskCertCache, "use-disk-cert-cache", false, "cache cert on disk")
	flag.StringVar(&fKBFSLogFile, "kbfs-logfile", "kbp-kbfs.log",
		"path to KBFS log file; empty means print to stdout")
	flag.StringVar(&fStathatEZKey, "stathat-key", "",
		"stathat EZ key for reporting stats to stathat; empty disables stathat")
	flag.StringVar(&fStathatPrefix, "stathat-prefix", "kbp -",
		"prefix to stathat statnames")
	// TODO: hook up support in kbpagesd.
	// TODO: when we make kbpagesd horizontally scalable, blacklist and
	// whitelist should be dynamically configurable.
	flag.StringVar(&fBlacklist, "blacklist", "",
		"a comma-separated list of domains to block")
	flag.StringVar(&fMySQLDSN, "mysql-dsn", "",
		"enable MySQL based storage and use this as the DSN")
}

func newLogger(isCLI bool) (*zap.Logger, error) {
	// In keybase/client/go/logger fd 2 is closed. To make sure our logger can
	// log to stderr, duplicate the fd beforehand. Apparently it's important to
	// call this function before any keybase/client/go/logger logging is set
	// up.
	stderr, err := stderrutils.DupStderr()
	if err != nil {
		panic(err)
	}

	// Zap loggers use os.Stderr by default. We could pass in stderr by making
	// more boilerplate, but there's not much else we need from those. So
	// override os.Stderr temporarily as a hack to inject stderr to the zap
	// logger.
	// TODO: replace this hack when we get logstash forwarding to work.
	originalStderr := os.Stderr
	os.Stderr = stderr
	defer func() { os.Stderr = originalStderr }()

	var loggerConfig zap.Config
	if isCLI {
		// The default development logger is suitable for console. Disable
		// stacktrace here for less verbosity, and colorize loglevel for better
		// readability.
		loggerConfig = zap.NewDevelopmentConfig()
		loggerConfig.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
		loggerConfig.DisableStacktrace = true
	} else {
		// The default production logger simply logs a json object for each
		// line. We override the time format to ISO8601 here to make it more
		// readable and compatible.
		loggerConfig = zap.NewProductionConfig()
		loggerConfig.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
		loggerConfig.EncoderConfig.TimeKey = "time"
	}

	return loggerConfig.Build()
}

func removeEmpty(strs []string) (ret []string) {
	ret = make([]string, 0, len(strs))
	for _, str := range strs {
		if len(str) > 0 {
			ret = append(ret, str)
		}
	}
	return ret
}

func getStatsActivityStorerOrBust(
	logger *zap.Logger) libpages.ActivityStatsStorer {
	if len(fMySQLDSN) == 0 {
		fileBasedStorer, err := libpages.NewFileBasedActivityStatsStorer(
			activityStatsPath, logger)
		if err != nil {
			logger.Panic(
				"libpages.NewFileBasedActivityStatsStorer", zap.Error(err))
			return nil
		}
		return fileBasedStorer
	}

	db, err := sql.Open("mysql", fMySQLDSN)
	if err != nil {
		logger.Panic("open mysql", zap.Error(err))
		return nil
	}
	mysqlStorer := libpages.NewMySQLActivityStatsStorer(db, logger)
	return mysqlStorer
}

const activityStatsReportInterval = 5 * time.Minute
const activityStatsPath = "./kbp-stats"

func main() {
	flag.Parse()

	ctx, cancel := context.WithCancel(context.Background())

	// TODO: make logstash forwarding work and use isCLI=false here if logstash
	// forwarding address is set.
	logger, err := newLogger(true)
	if err != nil {
		panic(err)
	}

	// Hack to make libkbfs.Init connect to prod {md,b}server all the time.
	os.Setenv("KEYBASE_RUN_MODE", "prod")

	kbCtx := env.NewContext()
	params := libkbfs.DefaultInitParams(kbCtx)
	params.EnableJournal = true
	params.Debug = true
	params.LogFileConfig.Path = fKBFSLogFile
	params.LogFileConfig.MaxKeepFiles = 32
	// Enable simpleFS in case we need to debug.
	shutdownGit := func() {}
	shutdownSimpleFS := func(_ context.Context) error { return nil }
	createSimpleFS := func(
		libkbfsCtx libkbfs.Context, config libkbfs.Config) (
		rpc.Protocol, error) {
		// Start autogit before the RPC connection to the service is
		// fully initialized. Use a big cache since kbpages doesn't
		// need memory for other stuff.
		shutdownGit = libgit.StartAutogit(config, 1000)

		var simplefsIface keybase1.SimpleFSInterface
		simplefsIface, shutdownSimpleFS = simplefs.NewSimpleFS(
			libkbfsCtx, config)
		return keybase1.SimpleFSProtocol(simplefsIface), nil
	}
	defer func() {
		err := shutdownSimpleFS(context.Background())
		if err != nil {
			fmt.Fprintf(os.Stderr, "Couldn't shut down SimpleFS: %+v\n", err)
		}
		shutdownGit()
	}()

	params.AdditionalProtocolCreators = []libkbfs.AdditionalProtocolCreator{
		createSimpleFS,
	}

	kbfsLog, err := libkbfs.InitLog(params, kbCtx)
	if err != nil {
		logger.Panic("libkbfs.InitLog", zap.Error(err))
	}
	cancelWrapper := func() error {
		cancel()
		return nil
	}
	kbConfig, err := libkbfs.Init(
		ctx, kbCtx, params, nil, cancelWrapper, kbfsLog)
	if err != nil {
		logger.Panic("libkbfs.Init", zap.Error(err))
	}

	var statsReporter libpages.StatsReporter
	if len(fStathatEZKey) != 0 {
		activityStorer := getStatsActivityStorerOrBust(logger)
		enabler := &libpages.ActivityStatsEnabler{
			Durations: []libpages.NameableDuration{
				{
					Duration: time.Hour, Name: "hourly"},
				{
					Duration: time.Hour * 24, Name: "daily"},
				{
					Duration: time.Hour * 24 * 7, Name: "weekly"},
			},
			Interval: activityStatsReportInterval,
			Storer:   activityStorer,
		}
		statsReporter = libpages.NewStathatReporter(
			logger, fStathatPrefix, fStathatEZKey, enabler)
	}

	certStore := libpages.NoCertStore
	if fDiskCertCache {
		certStore = libpages.DiskCertStore
	}

	serverConfig := &libpages.ServerConfig{
		DomainBlacklist: removeEmpty(strings.Split(fBlacklist, ",")),
		UseStaging:      !fProd,
		Logger:          logger,
		CertStore:       certStore,
		StatsReporter:   statsReporter,
	}

	_ = libpages.ListenAndServe(ctx, serverConfig, kbConfig)
}
