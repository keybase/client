// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"database/sql"
	"flag"
	"fmt"
	"io"
	"net/http"
	_ "net/http/pprof" //nolint:gosec // register /debug/pprof/* on http.DefaultServeMux; only reachable when -pprof-addr is set
	"os"
	"strings"
	"time"

	mysql "github.com/go-sql-driver/mysql"

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
	fProd             bool
	fDiskCertCache    bool
	fKBFSLogFile      string
	fShowtrendsAddr   string
	fShowtrendsPrefix string
	fBlacklist        string
	fMySQLDSN         string
	fMySQLDSNCAURL    string
	fPprofAddr        string
)

func init() {
	flag.BoolVar(&fProd, "prod", false, "disable development mode")
	flag.BoolVar(&fDiskCertCache, "use-disk-cert-cache", false, "cache cert on disk")
	flag.StringVar(&fKBFSLogFile, "kbfs-logfile", "kbp-kbfs.log",
		"path to KBFS log file; empty means print to stdout")
	flag.StringVar(&fShowtrendsAddr, "showtrends-addr",
		os.Getenv("SHOWTRENDS_ADDR"),
		"showtrends server address; empty disables stats reporting")
	flag.StringVar(&fShowtrendsPrefix, "showtrends-prefix", "kbp -",
		"prefix to showtrends stat names")
	// TODO: hook up support in kbpagesd.
	// TODO: when we make kbpagesd horizontally scalable, blacklist and
	// whitelist should be dynamically configurable.
	flag.StringVar(&fBlacklist, "blacklist", "",
		"a comma-separated list of domains to block")
	flag.StringVar(&fMySQLDSN, "mysql-dsn", "",
		"enable MySQL based storage and use this as the DSN")
	flag.StringVar(&fMySQLDSNCAURL, "mysql-dsn-ca-url", "",
		"enable TLS for MySQL using the CA hosted at this URL")
	flag.StringVar(&fPprofAddr, "pprof-addr", "",
		"if non-empty, expose net/http/pprof on this address (e.g. 127.0.0.1:6060); leave empty in prod unless diagnosing")
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
	logger *zap.Logger,
) libpages.ActivityStatsStorer {
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

	cfg, err := mysql.ParseDSN(fMySQLDSN)
	if err != nil {
		logger.Panic("parse mysql dsn", zap.Error(err))
		return nil
	}

	if len(fMySQLDSNCAURL) > 0 {
		resp, err := http.Get(fMySQLDSNCAURL) //nolint:gosec // G107: URL from trusted config flag for fetching CA cert
		if err != nil {
			logger.Panic("get ca", zap.Error(err))
			return nil
		}
		defer func() { _ = resp.Body.Close() }()
		if resp.StatusCode != 200 {
			logger.Panic("get ca", zap.Int("status code", resp.StatusCode))
			return nil
		}
		ca, err := io.ReadAll(resp.Body)
		if err != nil {
			logger.Panic("read ca", zap.Error(err))
			return nil
		}
		caPool := x509.NewCertPool()
		if ok := caPool.AppendCertsFromPEM(ca); !ok {
			logger.Panic("append ca", zap.Error(err))
			return nil
		}
		tlsConfig := &tls.Config{
			RootCAs:    caPool,
			MinVersion: tls.VersionTLS12,
		}
		if err = mysql.RegisterTLSConfig("custom", tlsConfig); err != nil {
			logger.Panic("register tls config", zap.Error(err))
			return nil
		}
		cfg.TLSConfig = "custom"
		logger.Info("registered tls config", zap.String("ca_url", fMySQLDSNCAURL))
	}

	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		logger.Panic("open mysql", zap.Error(err))
		return nil
	}
	mysqlStorer := libpages.NewMySQLActivityStatsStorer(db, logger)
	return mysqlStorer
}

const (
	activityStatsReportInterval = 5 * time.Minute
	activityStatsPath           = "./kbp-stats"
)

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
	_ = os.Setenv("KEYBASE_RUN_MODE", "prod")

	if fPprofAddr != "" {
		logger.Info("starting pprof listener", zap.String("addr", fPprofAddr))
		go func() {
			pprofServer := &http.Server{
				Addr:              fPprofAddr,
				ReadHeaderTimeout: 5 * time.Second,
			}
			if err := pprofServer.ListenAndServe(); err != nil {
				logger.Error("pprof listener exited", zap.Error(err))
			}
		}()
	}

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
		rpc.Protocol, error,
	) {
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
	if len(fShowtrendsAddr) != 0 {
		activityStorer := getStatsActivityStorerOrBust(logger)
		enabler := &libpages.ActivityStatsEnabler{
			Durations: []libpages.NameableDuration{
				{
					Duration: time.Hour, Name: "hourly",
				},
				{
					Duration: time.Hour * 24, Name: "daily",
				},
				{
					Duration: time.Hour * 24 * 7, Name: "weekly",
				},
			},
			Interval: activityStatsReportInterval,
			Storer:   activityStorer,
		}
		var closeStatsReporter func(context.Context) error
		statsReporter, closeStatsReporter = libpages.NewShowtrendsReporter(
			logger, fShowtrendsPrefix, fShowtrendsAddr, enabler)
		defer func() {
			if err := closeStatsReporter(context.Background()); err != nil {
				logger.Warn("close showtrends reporter", zap.Error(err))
			}
		}()
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
