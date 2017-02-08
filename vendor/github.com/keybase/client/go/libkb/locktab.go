// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"golang.org/x/net/context"
	"sync"
)

type NamedLock struct {
	sync.Mutex
	lctx   VLogContext
	refs   int
	name   string
	parent *LockTable
}

func (l *NamedLock) incref() {
	l.refs++
}

func (l *NamedLock) decref() {
	l.refs--
}

func (l *NamedLock) Release(ctx context.Context) {
	l.lctx.GetVDebugLog().CLogf(ctx, VLog1, "+ LockTable.Release(%s)", l.name)
	l.Unlock()
	l.parent.Lock()
	l.decref()
	if l.refs == 0 {
		l.lctx.GetVDebugLog().CLogf(ctx, VLog1, "| LockTable.unref(%s)", l.name)
		delete(l.parent.locks, l.name)
	}
	l.parent.Unlock()
	l.lctx.GetLog().CDebugf(ctx, "- LockTable.Unlock(%s)", l.name)
}

type LockTable struct {
	sync.Mutex
	locks map[string]*NamedLock
}

func (t *LockTable) init() {
	if t.locks == nil {
		t.locks = make(map[string]*NamedLock)
	}
}

func (t *LockTable) AcquireOnName(ctx context.Context, g VLogContext, s string) (ret *NamedLock) {
	g.GetLog().CDebugf(ctx, "+ LockTable.Lock(%s)", s)
	t.Lock()
	t.init()
	if ret = t.locks[s]; ret == nil {
		ret = &NamedLock{lctx: g, refs: 0, name: s, parent: t}
		t.locks[s] = ret
	}
	ret.incref()
	t.Unlock()
	ret.Lock()
	g.GetVDebugLog().CLogf(ctx, VLog1, "- LockTable.Lock(%s)", s)
	return ret
}
