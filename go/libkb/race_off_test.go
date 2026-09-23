// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build !race

package libkb

// raceEnabled is true when the test binary was built with -race. Some tests
// only exercise a bug under the race detector and are runtime-skipped
// otherwise.
const raceEnabled = false
