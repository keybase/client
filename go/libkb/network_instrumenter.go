package libkb

import (
	"fmt"
	"strings"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

func toInstrumentationDiskRecord(record rpc.InstrumentationRecord) keybase1.InstrumentationDiskRecord {
	return keybase1.InstrumentationDiskRecord{
		Ctime: keybase1.ToTime(record.Ctime),
		Dur:   keybase1.ToDurationMsec(record.Dur),
		Size:  record.Size,
	}
}

type DiskInstrumentationStorage struct {
	Contextified
	sync.Mutex
	storage map[string][]rpc.InstrumentationRecord

	eg     errgroup.Group
	stopCh chan struct{}
}

var _ rpc.InstrumenterStorage = (*DiskInstrumentationStorage)(nil)

func NewDiskInstrumentationStorage(g *GlobalContext) *DiskInstrumentationStorage {
	return &DiskInstrumentationStorage{
		Contextified: NewContextified(g),
		storage:      make(map[string][]rpc.InstrumentationRecord),
	}
}

func (s *DiskInstrumentationStorage) Start() {
	defer s.G().CTraceTimed(context.TODO(), "DiskInstrumentationStorage: Start", func() error { return nil })()
	s.Lock()
	defer s.Unlock()
	s.stopCh = make(chan struct{})
	s.eg.Go(func() error { return s.flushLoop(s.stopCh) })
}

func (s *DiskInstrumentationStorage) Stop() chan struct{} {
	defer s.G().CTraceTimed(context.TODO(), "DiskInstrumentationStorage: Stop", func() error { return nil })()
	s.Lock()
	defer s.Unlock()
	ch := make(chan struct{})
	if s.stopCh != nil {
		close(s.stopCh)
		s.stopCh = nil
		go func() {
			if err := s.eg.Wait(); err != nil {
				s.G().Log.Debug("unable to wait for shutdown: %v", err)
			}
			close(ch)
		}()
	} else {
		close(ch)
	}
	return ch
}

func (s *DiskInstrumentationStorage) flushLoop(stopCh chan struct{}) error {
	for {
		select {
		case <-stopCh:
			return s.Flush()
		case <-time.After(5 * time.Minute):
			if err := s.Flush(); err != nil {
				s.G().Log.Debug("unable to flush: %v", err)
			}
		}
	}
}

func (s *DiskInstrumentationStorage) Flush() (err error) {
	s.Lock()
	storage := s.storage
	s.storage = make(map[string][]rpc.InstrumentationRecord)
	s.Unlock()
	return s.flush(storage)
}

func (s *DiskInstrumentationStorage) flush(storage map[string][]rpc.InstrumentationRecord) (err error) {
	defer s.G().CTraceTimed(context.TODO(), "DiskInstrumentationStorage: flush", func() error { return err })()
	for tag, records := range storage {
		for _, record := range records {
			if err := s.G().LocalDb.PutObjMsgpack(s.dbKey(tag, record.Ctime), nil, toInstrumentationDiskRecord(record)); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *DiskInstrumentationStorage) dbKey(tag string, ctime time.Time) DbKey {
	return DbKey{
		Typ: DBNetworkInstrumentation,
		Key: fmt.Sprintf("%s:%d", tag, ctime.Unix()),
	}
}

func (s *DiskInstrumentationStorage) getAllKeysLocked() (keys []DbKey, err error) {
	prefix := DbKey{
		Typ: DBNetworkInstrumentation,
	}.ToBytes()
	dbKeys, err := s.G().LocalDb.KeysWithPrefixes(prefix)
	if err != nil {
		return nil, fmt.Errorf("could not get KeysWithPrefixes: %v", err)
	}
	keys = make([]DbKey, 0, len(dbKeys))
	for dbKey := range dbKeys {
		if dbKey.Typ == DBNetworkInstrumentation {
			keys = append(keys, dbKey)
		}
	}
	return keys, nil
}

func (s *DiskInstrumentationStorage) GetAll() (res map[string][]keybase1.InstrumentationDiskRecord, err error) {
	defer s.G().CTraceTimed(context.TODO(), "DiskInstrumentationStorage: GetAll", func() error { return err })()
	s.Lock()
	defer s.Unlock()

	if err := s.flush(s.storage); err != nil {
		return nil, err
	}

	dbKeys, err := s.getAllKeysLocked()
	if err != nil {
		return nil, err
	}
	res = make(map[string][]keybase1.InstrumentationDiskRecord)
	for _, dbKey := range dbKeys {
		tag := strings.Split(dbKey.Key, ":")[0]
		var record keybase1.InstrumentationDiskRecord
		ok, err := s.G().LocalDb.GetIntoMsgpack(&record, dbKey)
		if err != nil {
			return nil, err
		}
		if !ok {
			continue
		}
		// Keep only window of the past month
		if time.Since(record.Ctime.Time()) > time.Hour*24*30 {
			if err := s.G().LocalDb.Delete(dbKey); err != nil {
				s.G().Log.Debug("unable to delete old record: %v", err)
			}
			continue
		}
		res[tag] = append(res[tag], record)
	}
	return res, nil
}

func (s *DiskInstrumentationStorage) Stats() (res []keybase1.InstrumentationStat, err error) {
	defer s.G().CTraceTimed(context.TODO(), "DiskInstrumentationStorage: Stats", func() error { return err })()
	all, err := s.GetAll()
	if err != nil {
		return nil, err
	}
	for tag, records := range all {
		stat := keybase1.InstrumentationStat{
			Tag:      tag,
			NumCalls: len(records),
		}
		for i, record := range records {
			stat.TotalDur += record.Dur
			if record.Dur > stat.MaxDur {
				stat.MaxDur = record.Dur
			}
			if record.Dur < stat.MinDur || i == 0 {
				stat.MinDur = record.Dur
			}

			stat.TotalSize += record.Size
			if record.Size > stat.MaxSize {
				stat.MaxSize = record.Size
			}
			if record.Size < stat.MinSize || i == 0 {
				stat.MinSize = record.Size
			}
		}

		if len(records) > 0 {
			stat.AvgDur = stat.TotalDur / keybase1.DurationMsec(len(records))
			stat.AvgSize = stat.TotalSize / int64(len(records))
		}
		res = append(res, stat)
	}

	return res, nil
}

func (s *DiskInstrumentationStorage) Put(tag string, record rpc.InstrumentationRecord) error {
	s.Lock()
	defer s.Unlock()
	s.storage[tag] = append(s.storage[tag], record)
	return nil
}
