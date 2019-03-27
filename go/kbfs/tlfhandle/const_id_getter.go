// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package tlfhandle

import (
	"context"

	"github.com/keybase/client/go/kbfs/tlf"
)

// ConstIDGetter is an IDGetter that always returns the same TLF ID.
type ConstIDGetter struct {
	ID tlf.ID
}

var _ IDGetter = ConstIDGetter{}

// GetIDForHandle implements the IDGetter interface for ConstIDGetter.
func (c ConstIDGetter) GetIDForHandle(_ context.Context, _ *Handle) (
	tlf.ID, error) {
	return c.ID, nil
}

// ValidateLatestHandleNotFinal implements the IDGetter interface for
// ConstIDGetter.
func (c ConstIDGetter) ValidateLatestHandleNotFinal(
	_ context.Context, _ *Handle) (bool, error) {
	return true, nil
}
