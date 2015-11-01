// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !windows

package client

func HasColor() bool {
	// TODO Color should be based on whether log format supports it
	logFormatHasColor := map[string]bool{
		"":        true,
		"default": true,
		"fancy":   true,
	}
	return logFormatHasColor[G.Env.GetLogFormat()]
}
