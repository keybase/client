// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package util

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// testEnvFn returns value
func testEnvFn(k, v string) func(e string) string {
	return func(e string) string {
		if k == e {
			return v
		}
		return ""
	}
}

func TestEnvDuration(t *testing.T) {
	duration := envDuration(testEnvFn("TEST", "1s"), "TEST", time.Minute)
	assert.Equal(t, time.Second, duration)
	duration = envDuration(testEnvFn("TEST", ""), "TEST", time.Minute)
	assert.Equal(t, time.Minute, duration)
	duration = envDuration(testEnvFn("TEST", "invalid"), "TEST", time.Minute)
	assert.Equal(t, time.Minute, duration)
	duration = EnvDuration("TEST", time.Hour)
	assert.Equal(t, time.Hour, duration)
}

func TestEnvBool(t *testing.T) {
	b := envBool(testEnvFn("TEST", "true"), "TEST", false)
	assert.True(t, b)
	b = envBool(testEnvFn("TEST", "1"), "TEST", false)
	assert.True(t, b)
	b = envBool(testEnvFn("TEST", "false"), "TEST", true)
	assert.False(t, b)
	b = envBool(testEnvFn("TEST", "0"), "TEST", false)
	assert.False(t, b)
	b = envBool(testEnvFn("TEST", ""), "TEST", false)
	assert.False(t, b)
	b = envBool(testEnvFn("TEST", ""), "TEST", true)
	assert.True(t, b)
	b = EnvBool("TEST", true)
	assert.True(t, b)
}
