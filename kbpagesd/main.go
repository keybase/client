// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"context"
	"flag"
	"os"

	"github.com/keybase/kbfs/env"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/libpages"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var (
	fProd          bool
	fDiskCertCache bool
)

func init() {
	flag.BoolVar(&fProd, "prod", false, "disable development mode")
	flag.BoolVar(&fDiskCertCache, "use-disk-cert-cache", false, "cache cert on disk")
}

func main() {
	flag.Parse()

	ctx, cancel := context.WithCancel(context.Background())
	var logger *zap.Logger
	var err error
	if fProd {
		logger, err = zap.NewProduction()
	} else {
		loggerConfig := zap.NewDevelopmentConfig()
		loggerConfig.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
		loggerConfig.DisableStacktrace = true
		logger, err = loggerConfig.Build()
	}
	if err != nil {
		panic(err)
	}

	// Hack to make libkbfs.Init connect to prod {md,b}server all the time.
	os.Setenv("KEYBASE_RUN_MODE", "prod")

	kbCtx := env.NewContext()
	params := libkbfs.DefaultInitParams(kbCtx)
	params.EnableJournal = false
	params.Debug = true
	kbfsLog, err := libkbfs.InitLog(params, kbCtx)
	if err != nil {
		logger.Panic("libkbfs.InitLog", zap.Error(err))
	}
	kbConfig, err := libkbfs.Init(
		ctx, kbCtx, params, nil, cancel, kbfsLog)
	if err != nil {
		logger.Panic("libkbfs.Init", zap.Error(err))
	}

	serverConfig := libpages.ServerConfig{
		// Connect to staging Let's Encrypt server while we are testing since
		// the rate-limit is way higher.
		UseStaging:       true,
		Logger:           logger,
		UseDiskCertCache: fDiskCertCache,
	}
	libpages.ListenAndServe(ctx, serverConfig, kbConfig)
}
