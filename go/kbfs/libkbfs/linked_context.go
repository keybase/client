// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
)

// linkedContext is a context that takes values (and keys) from a
// linked context but has independent cancellation behaviour.
type linkedContext struct {
	context.Context
	linked context.Context
}

func newLinkedContext(ctx context.Context) context.Context {
	return &linkedContext{context.Background(), ctx}
}

// Value takes the value from the linked Context.
func (l *linkedContext) Value(key interface{}) interface{} {
	return l.linked.Value(key)
}
