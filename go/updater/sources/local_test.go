// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package sources

import (
	"path/filepath"
	"runtime"
	"testing"

	"github.com/keybase/client/go/updater"
	"github.com/keybase/go-logging"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var log = &logging.Logger{Module: "test"}

func TestLocalUpdateSource(t *testing.T) {
	_, filename, _, _ := runtime.Caller(0)
	path := filepath.Join(filepath.Dir(filename), "../test/test.zip")
	jsonPath := filepath.Join(filepath.Dir(filename), "../test/update.json")
	local := NewLocalUpdateSource(path, jsonPath, log)
	assert.Equal(t, local.Description(), "Local")

	update, err := local.FindUpdate(updater.UpdateOptions{})
	require.NoError(t, err)
	require.NotNil(t, update)
}
