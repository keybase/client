// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build !darwin
// +build !darwin

package libkb

func DisableProcessTracing() error {
	return nil
}
