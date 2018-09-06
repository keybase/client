package libkb

import (
	"errors"
	"sync"

	lru "github.com/hashicorp/golang-lru"
)

type MemDb struct {
	sync.Mutex
	lru *lru.Cache
}

var _ LocalDb = (*MemDb)(nil)

func NewMemDb() *MemDb {
	c, _ := lru.New(10000)
	return &MemDb{
		lru: c,
	}
}

func (m *MemDb) Open() error           { return nil }
func (m *MemDb) ForceOpen() error      { return nil }
func (m *MemDb) Close() error          { return nil }
func (m *MemDb) Nuke() (string, error) { return "", nil }
func (m *MemDb) OpenTransaction() (res LocalDbTransaction, err error) {
	return res, errors.New("not implemented")
}

func (m *MemDb) Put(id DbKey, aliases []DbKey, value []byte) error {
	m.Lock()
	defer m.Unlock()
	m.lru.Add(id, value)
	for _, a := range aliases {
		m.lru.Add(a, value)
	}
	return nil
}

func (m *MemDb) Delete(id DbKey) error {
	m.Lock()
	defer m.Unlock()
	m.lru.Remove(id)
	return nil
}

func (m *MemDb) Get(id DbKey) ([]byte, bool, error) {
	m.Lock()
	defer m.Unlock()
	val, ok := m.lru.Get(id)
	if !ok {
		return nil, false, nil
	}
	return val.([]byte), true, nil
}

func (m *MemDb) Lookup(alias DbKey) ([]byte, bool, error) {
	return m.Get(alias)
}
