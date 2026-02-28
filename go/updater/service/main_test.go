// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package main

import (
	"runtime"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestServiceFlags(t *testing.T) {
	f := flags{
		pathToKeybase: "keybase",
	}
	svc := serviceFromFlags(f, logger{})
	require.NotNil(t, svc)
}

func TestServiceFlagsEmpty(t *testing.T) {
	svc := serviceFromFlags(flags{}, logger{})
	require.NotNil(t, svc)
}

func TestLoadFlags(t *testing.T) {
	f, _ := loadFlags()
	if runtime.GOOS == "linux" {
		assert.Equal(t, "keybase", f.appName)
	} else {
		assert.Equal(t, "Keybase", f.appName)
	}
}
