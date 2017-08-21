// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package util

import (
	"os"
	"strconv"
	"time"
)

type envFn func(e string) string

// EnvDuration returns a duration from an environment variable or default if
// invalid or not specified
func EnvDuration(envVar string, defaultValue time.Duration) time.Duration {
	return envDuration(os.Getenv, envVar, defaultValue)
}

func envDuration(fn envFn, envVar string, defaultValue time.Duration) time.Duration {
	envVal := fn(envVar)
	if envVal == "" {
		return defaultValue
	}
	duration, err := time.ParseDuration(envVal)
	if err != nil {
		return defaultValue
	}
	return duration
}

// EnvBool returns a bool from an environment variable or default if invalid or
// not specified
func EnvBool(envVar string, defaultValue bool) bool {
	return envBool(os.Getenv, envVar, defaultValue)
}

func envBool(fn envFn, envVar string, defaultValue bool) bool {
	envVal := fn(envVar)
	if envVal == "" {
		return defaultValue
	}
	b, err := strconv.ParseBool(envVal)
	if err != nil {
		return defaultValue
	}
	return b
}
