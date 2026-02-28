// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build ios || android
// +build ios android

package status

func keybaseProcessList() string {
	return "no process info available for mobile systems"
}
