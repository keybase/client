// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package main

import (
	"testing"

	"github.com/keybase/client/go/updater/keybase"
	"github.com/keybase/client/go/updater/util"
	"github.com/stretchr/testify/require"
)

func TestLoggerNil(t *testing.T) {
	log := logger{}
	log.Debug(nil)
	log.Debugf("")
	log.Info(nil)
	log.Infof("")
	log.Warning(nil)
	log.Warningf("")
	log.Error(nil)
	log.Errorf("")
}

func TestLoggerFile(t *testing.T) {
	log := logger{}

	dir, err := keybase.LogDir("KeybaseTest")
	require.NoError(t, err)
	if exists, _ := util.FileExists(dir); !exists {
		t.Logf("Creating %s", dir)
		dirErr := util.MakeDirs(dir, 0700, testLog)
		require.NoError(t, dirErr)
		defer util.RemoveFileAtPath(dir)
	}

	_, path, err := log.setLogToFile("KeybaseTest", "TestLoggerFile.log")
	defer util.RemoveFileAtPath(path)
	require.NoError(t, err)
	log.Debug("test")
}
