// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

// Package dokan is a binding to the Dokan usermode filesystem binding library on Windows.
package dokan

// Mount mounts a FileSystem to the given drive letter.
func Mount(fs FileSystem, driveletter byte) error {
	var slot = fsTableStore(fs)
	ctx := allocCtx(slot)
	defer ctx.Free()
	return ctx.Run(driveletter)
}
