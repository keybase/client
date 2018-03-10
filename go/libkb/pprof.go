// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"path/filepath"
	"sort"
	"time"
)

// The number of CPU profile files to keep around and to bundle with
// sent logs.
const MaxCPUProfileFileCount = 5

// The number of trace files to keep around and to bundle with sent
// logs.
const MaxTraceFileCount = 5

const cpuProfilePrefix = "cpu"

const tracePrefix = "trace"

func makeProfileFilename(prefix, dir string, start time.Time, duration time.Duration) string {
	// Copied from oldLogFileTimeRangeTimeLayout from
	// logger/file.go. Chosen so that lexicographic sorting
	// approximately sorts by increasing start time; time zones
	// prevent it from being an exact sorting.
	startStr := start.Format("20060102T150405Z0700")
	filename := fmt.Sprintf("%s.%s.%s.out", prefix, startStr, duration)
	return filepath.Join(dir, filename)
}

// MakeCPUProfileFilename returns a filename to use for a CPU profile
// file in the given directory with the given start time and duration.
func MakeCPUProfileFilename(dir string, start time.Time, duration time.Duration) string {
	return makeProfileFilename(cpuProfilePrefix, dir, start, duration)
}

// MakeTraceFilename returns a filename to use for a trace file
// in the given directory with the given start time and duration.
func MakeTraceFilename(dir string, start time.Time, duration time.Duration) string {
	return makeProfileFilename(tracePrefix, dir, start, duration)
}

func getSortedFiles(prefix, dir string) ([]string, error) {
	pattern := filepath.Join(dir, prefix+".*.out")
	matches, err := filepath.Glob(pattern)
	if err != nil {
		return nil, err
	}
	sort.Strings(matches)
	return matches, nil
}

// GetSortedCPUProfileFiles returns all CPU profile files in the given
// directory approximately sorted by increasing start time.
func GetSortedCPUProfileFiles(dir string) ([]string, error) {
	return getSortedFiles(cpuProfilePrefix, dir)
}

// GetSortedTraceFiles returns all trace files in the given directory
// approximately sorted by increasing start time.
func GetSortedTraceFiles(dir string) ([]string, error) {
	return getSortedFiles(tracePrefix, dir)
}
