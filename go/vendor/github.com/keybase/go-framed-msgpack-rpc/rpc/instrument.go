package rpc

import (
	"fmt"
	"sync"
	"time"
)

func RPCInstrumentTag(methodType MethodType, method string) string {
	return fmt.Sprintf("%s %s", methodType, method)
}

type InstrumentationRecord struct {
	Ctime time.Time
	Dur   time.Duration
	Size  int64
}

type InstrumenterStorage interface {
	Put(tag string, record InstrumentationRecord) error
}

type DummyInstrumentationStorage struct{}

var _ InstrumenterStorage = (*DummyInstrumentationStorage)(nil)

func (d *DummyInstrumentationStorage) Put(tag string, record InstrumentationRecord) error { return nil }

type MemoryInstrumentationStorage struct {
	sync.Mutex
	storage map[string][]InstrumentationRecord
}

var _ InstrumenterStorage = (*MemoryInstrumentationStorage)(nil)

func NewMemoryInstrumentationStorage() *MemoryInstrumentationStorage {
	return &MemoryInstrumentationStorage{
		storage: make(map[string][]InstrumentationRecord),
	}
}

func (s *MemoryInstrumentationStorage) Put(tag string, record InstrumentationRecord) error {
	s.Lock()
	defer s.Unlock()
	s.storage[tag] = append(s.storage[tag], record)
	return nil
}

type NetworkInstrumenter struct {
	sync.Mutex
	storage InstrumenterStorage
}

func NewNetworkInstrumenter(storage InstrumenterStorage) *NetworkInstrumenter {
	return &NetworkInstrumenter{
		storage: storage,
	}
}

func (d *NetworkInstrumenter) Instrument(tag string) func(int64) error {
	ctime := time.Now()
	return func(size int64) error {
		dur := time.Since(ctime)
		return d.storage.Put(tag, InstrumentationRecord{
			Ctime: ctime,
			Dur:   dur,
			Size:  size,
		})
	}
}
