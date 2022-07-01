// Copyright 2015-2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"bytes"
	"time"

	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/metricsutil"
	"golang.org/x/net/context"
)

// GetEncodedMetrics returns metrics encoded as bytes for metrics file.
func GetEncodedMetrics(config libkbfs.Config) func(context.Context) ([]byte, time.Time, error) {
	return func(context.Context) ([]byte, time.Time, error) {
		if registry := config.MetricsRegistry(); registry != nil {
			b := bytes.NewBuffer(nil)
			metricsutil.WriteMetrics(registry, b)
			return b.Bytes(), time.Time{}, nil
		}
		return []byte("Metrics have been turned off.\n"), time.Time{}, nil
	}
}
