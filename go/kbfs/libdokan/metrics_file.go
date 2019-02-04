// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"github.com/keybase/client/go/kbfs/libfs"
)

// NewMetricsFile returns a special read file that contains a text
// representation of all metrics.
func NewMetricsFile(fs *FS) *SpecialReadFile {
	return &SpecialReadFile{read: libfs.GetEncodedMetrics(fs.config), fs: fs}
}
