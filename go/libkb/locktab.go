// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"sync"
	"time"

	"golang.org/x/net/context"
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
	l.lctx.GetVDebugLog().CLogf(ctx, VLog1, "- LockTable.Unlock(%s)", l.name)
}

type LockTable struct {
	sync.Mutex
	locks map[string]*NamedLock
}

func NewLockTable() *LockTable {
	return &LockTable{}
}

func (t *LockTable) init() {
	if t.locks == nil {
		t.locks = make(map[string]*NamedLock)
	}
}

// AcquireOnName acquires s's lock.
// Never gives up.
func (t *LockTable) AcquireOnName(ctx context.Context, g VLogContext, s string) (ret *NamedLock) {
	g.GetVDebugLog().CLogf(ctx, VLog1, "+ LockTable.Lock(%s)", s)
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

// AcquireOnNameWithContext acquires s's lock.
// Returns (ret, nil) if the lock was acquired.
// Returns (nil, err) if it was not. The error is from ctx.Err().
func (t *LockTable) AcquireOnNameWithContext(ctx context.Context, g VLogContext, s string) (ret *NamedLock, err error) {
	g.GetVDebugLog().CLogf(ctx, VLog1, "+ LockTable.Lock(%s)", s)
	err = AcquireWithContext(ctx, t)
	if err != nil {
		g.GetVDebugLog().CLogf(ctx, VLog1, "- LockTable.Lock(%s) outer canceled: %v", s, err)
		return nil, err
	}
	t.init()
	if ret = t.locks[s]; ret == nil {
		ret = &NamedLock{lctx: g, refs: 0, name: s, parent: t}
		t.locks[s] = ret
	}
	ret.incref()
	t.Unlock()
	err = AcquireWithContext(ctx, ret)
	if err != nil {
		g.GetVDebugLog().CLogf(ctx, VLog1, "- LockTable.Lock(%s) inner canceled: %v", s, err)
		return nil, err
	}
	g.GetVDebugLog().CLogf(ctx, VLog1, "- LockTable.Lock(%s)", s)
	return ret, nil
}

// AcquireOnNameWithContextAndTimeout acquires s's lock.
// Returns (ret, nil) if the lock was acquired.
// Returns (nil, err) if it was not. The error is from ctx.Err() or context.DeadlineExceeded.
func (t *LockTable) AcquireOnNameWithContextAndTimeout(ctx context.Context, g VLogContext, s string, timeout time.Duration) (ret *NamedLock, err error) {
	ctx2, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return t.AcquireOnNameWithContext(ctx2, g, s)
}
