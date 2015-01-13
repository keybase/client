package libkb

import (
	"sync"
)

type NamedLock struct {
	refs   int
	name   string
	parent *LockTable
	lock   sync.Mutex
}

func (l *NamedLock) incref() {
	l.refs++
}

func (l *NamedLock) decref() {
	l.refs--
}

func (l *NamedLock) Unlock() {
	G.Log.Debug("+ LockTable.Unlock(%s)", l.name)
	l.lock.Unlock()
	l.parent.lock.Lock()
	l.decref()
	if l.refs == 0 {
		G.Log.Debug("| LockTable.unref(%s)", l.name)
		delete(l.parent.locks, l.name)
	}
	l.parent.lock.Unlock()
	G.Log.Debug("- LockTable.Unlock(%s)", l.name)
}

type LockTable struct {
	lock  sync.Mutex
	locks map[string]*NamedLock
}

func NewLockTable() *LockTable {
	return &LockTable{
		locks: make(map[string]*NamedLock),
	}
}

func (t *LockTable) Lock(s string) (ret *NamedLock) {
	G.Log.Debug("+ LockTable.Lock(%s)", s)
	t.lock.Lock()
	if ret = t.locks[s]; ret == nil {
		ret = &NamedLock{refs: 0, name: s, parent: t}
		t.locks[s] = ret
	}
	ret.incref()
	t.lock.Unlock()
	ret.lock.Lock()
	G.Log.Debug("- LockTable.Lock(%s)", s)
	return ret
}
