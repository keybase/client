// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD license that can be found in the LICENSE file.
package main

import (
	"context"
	"flag"
	"os"
	"time"

	"github.com/keybase/kbfs/env"
	"github.com/keybase/kbfs/libgit"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/libpages"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var (
	fProd           bool
	fDiskCertCache  bool
	fNoRedirectHTTP bool
	fKBFSLogFile    string
	fStathatEZKey   string
	fStathatPrefix  string
)

func init() {
	flag.BoolVar(&fProd, "prod", false, "disable development mode")
	flag.BoolVar(&fDiskCertCache, "use-disk-cert-cache", false, "cache cert on disk")
	flag.BoolVar(&fNoRedirectHTTP, "no-redirect-http", false, "do not redirect to HTTPS")
	flag.StringVar(&fKBFSLogFile, "kbfs-logfile", "kbp-kbfs.log",
		"path to KBFS log file; empty means print to stdout")
	flag.StringVar(&fStathatEZKey, "stathat-key", "",
		"stathat EZ key for reporting stats to stathat; empty disables stathat")
	flag.StringVar(&fStathatPrefix, "stathat-prefix", "kbp -",
		"prefix to stathat statnames")
}

func newLogger(isCLI bool) (*zap.Logger, error) {
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

const autoGitNumWorkers = 10
const activityStatsReportInterval = time.Minute
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
	kbfsLog, err := libkbfs.InitLog(params, kbCtx)
	if err != nil {
		logger.Panic("libkbfs.InitLog", zap.Error(err))
	}
	kbConfig, err := libkbfs.Init(
		ctx, kbCtx, params, nil, cancel, kbfsLog)
	if err != nil {
		logger.Panic("libkbfs.Init", zap.Error(err))
	}

	shutdown := libgit.StartAutogit(kbCtx, kbConfig, &params, autoGitNumWorkers)
	defer shutdown()

	var statsReporter libpages.StatsReporter
	if len(fStathatEZKey) != 0 {
		activityStorer, err := libpages.NewFileBasedActivityStatsStorer(
			activityStatsPath, logger)
		if err != nil {
			logger.Panic(
				"libpages.NewFileBasedActivityStatsStorer", zap.Error(err))
		}
		enabler := &libpages.ActivityStatsEnabler{
			Durations: []time.Duration{
				time.Hour, time.Hour * 24, time.Hour * 24 * 7},
			Interval: activityStatsReportInterval,
			Storer:   activityStorer,
		}
		statsReporter = libpages.NewStathatReporter(
			logger, fStathatPrefix, fStathatEZKey, enabler)
	}

	serverConfig := &libpages.ServerConfig{
		UseStaging:       !fProd,
		Logger:           logger,
		UseDiskCertCache: fDiskCertCache,
		AutoDirectHTTP:   !fNoRedirectHTTP,
		StatsReporter:    statsReporter,
	}

	libpages.ListenAndServe(ctx, serverConfig, kbConfig)
}
