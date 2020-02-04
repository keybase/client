package rpc

import (
	"errors"
	"fmt"
	"sync"
	"time"
)

type NetworkInstrumenterStorage interface {
	Put(tag string, record InstrumentationRecord) error
}

func RPCInstrumentTag(methodType MethodType, method string) string {
	return fmt.Sprintf("%s %s", methodType, method)
}

type InstrumentationRecord struct {
	Ctime time.Time
	Dur   time.Duration
	Size  int64
}

type DummyInstrumentationStorage struct{}

func NewDummyInstrumentationStorage() *DummyInstrumentationStorage {
	return &DummyInstrumentationStorage{}
}

var _ NetworkInstrumenterStorage = (*DummyInstrumentationStorage)(nil)

func (d *DummyInstrumentationStorage) Put(tag string, record InstrumentationRecord) error { return nil }

type MemoryInstrumentationStorage struct {
	sync.Mutex
	storage map[string][]InstrumentationRecord
}

var _ NetworkInstrumenterStorage = (*MemoryInstrumentationStorage)(nil)

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
	*InstrumentationRecord
	storage NetworkInstrumenterStorage
	tag     string
}

func NewNetworkInstrumenter(storage NetworkInstrumenterStorage, tag string) *NetworkInstrumenter {
	return &NetworkInstrumenter{
		InstrumentationRecord: &InstrumentationRecord{
			Ctime: time.Now(),
		},
		tag:     tag,
		storage: storage,
	}
}

func (r *NetworkInstrumenter) IncrementSize(size int64) {
	if r.InstrumentationRecord != nil {
		r.Size += size
	}
}

func (r *NetworkInstrumenter) EndCall() {
	if r.InstrumentationRecord != nil {
		r.Dur = time.Since(r.Ctime)
	}
}

func (r *NetworkInstrumenter) RecordAndFinish(size int64) error {
	r.IncrementSize(size)
	r.EndCall()
	return r.Finish()
}

func (r *NetworkInstrumenter) Finish() error {
	if r.InstrumentationRecord == nil {
		return errors.New("record already finished")
	}
	rec := *r.InstrumentationRecord
	r.InstrumentationRecord = nil
	return r.storage.Put(r.tag, rec)
}
