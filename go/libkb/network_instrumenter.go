package libkb

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	humanize "github.com/dustin/go-humanize"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

type NetworkStatsJSON struct {
	Local  []keybase1.InstrumentationStat `json:"local"`
	Remote []keybase1.InstrumentationStat `json:"remote"`
}

var internalHosts = map[string]struct{}{
	DevelServerURI:      {},
	StagingServerURI:    {},
	ProductionServerURI: {},
	ProductionSiteURI:   {},
}

func InstrumentationTagFromRequest(req *http.Request) string {
	if req.URL == nil {
		return ""
	}
	host := req.URL.Host
	path := req.URL.Path
	if _, ok := internalHosts[fmt.Sprintf("%s://%s", req.URL.Scheme, host)]; ok {
		host = ""
		path = strings.TrimPrefix(req.URL.Path, APIURIPathPrefix)
		path = strings.TrimPrefix(path, "/")
	}
	return fmt.Sprintf("%s %s%s", req.Method, host, path)
}

func AddRPCRecord(tag string, stat keybase1.InstrumentationStat, record rpc.InstrumentationRecord) keybase1.InstrumentationStat {
	if stat.NumCalls == 0 {
		stat.Ctime = keybase1.ToTime(time.Now())
	}
	if stat.Tag == "" {
		stat.Tag = tag
	}
	stat.Mtime = keybase1.ToTime(time.Now())
	stat.NumCalls++
	dur := keybase1.ToDurationMsec(record.Dur)
	stat.TotalDur += dur
	if dur > stat.MaxDur {
		stat.MaxDur = dur
	}
	if dur < stat.MinDur || stat.NumCalls == 1 {
		stat.MinDur = dur
	}

	stat.TotalSize += record.Size
	if record.Size > stat.MaxSize {
		stat.MaxSize = record.Size
	}
	if record.Size < stat.MinSize || stat.NumCalls == 1 {
		stat.MinSize = record.Size
	}

	stat.AvgDur = stat.TotalDur / keybase1.DurationMsec(stat.NumCalls)
	stat.AvgSize = stat.TotalSize / int64(stat.NumCalls)
	return stat
}

type DiskInstrumentationStorage struct {
	Contextified
	sync.Mutex
	src     keybase1.NetworkSource
	storage map[string]keybase1.InstrumentationStat

	eg      errgroup.Group
	stopCh  chan struct{}
	started bool
}

var _ rpc.NetworkInstrumenterStorage = (*DiskInstrumentationStorage)(nil)

func NewDiskInstrumentationStorage(g *GlobalContext, src keybase1.NetworkSource) *DiskInstrumentationStorage {
	return &DiskInstrumentationStorage{
		Contextified: NewContextified(g),
		src:          src,
		storage:      make(map[string]keybase1.InstrumentationStat),
	}
}

func (s *DiskInstrumentationStorage) Start(ctx context.Context) {
	defer s.G().CTrace(ctx, "DiskInstrumentationStorage: Start", nil)()
	s.Lock()
	defer s.Unlock()
	if s.started {
		return
	}
	s.stopCh = make(chan struct{})
	s.started = true
	s.eg.Go(func() error { return s.flushLoop(s.stopCh) })
}

func (s *DiskInstrumentationStorage) Stop(ctx context.Context) chan struct{} {
	defer s.G().CTrace(ctx, "DiskInstrumentationStorage: Stop", nil)()
	s.Lock()
	defer s.Unlock()
	ch := make(chan struct{})
	if s.started {
		close(s.stopCh)
		s.started = false
		go func() {
			if err := s.eg.Wait(); err != nil {
				s.G().Log.Debug("DiskInstrumentationStorage: flush: unable to wait for shutdown: %v", err)
			}
			close(ch)
		}()
	} else {
		close(ch)
	}
	return ch
}

func (s *DiskInstrumentationStorage) flushLoop(stopCh chan struct{}) error {
	ctx := context.Background()
	for {
		select {
		case <-stopCh:
			return s.Flush(ctx)
		case <-time.After(5 * time.Minute):
			if err := s.Flush(ctx); err != nil {
				s.G().Log.CDebugf(ctx, "DiskInstrumentationStorage: flushLoop: unable to flush: %v", err)
			}
		}
	}
}

func (s *DiskInstrumentationStorage) Flush(ctx context.Context) (err error) {
	s.Lock()
	storage := s.storage
	s.storage = make(map[string]keybase1.InstrumentationStat)
	s.Unlock()
	return s.flush(ctx, storage)
}

func (s *DiskInstrumentationStorage) flush(ctx context.Context, storage map[string]keybase1.InstrumentationStat) (err error) {
	defer s.G().CTrace(ctx, "DiskInstrumentationStorage: flush", &err)()
	for tag, record := range storage {
		var existing keybase1.InstrumentationStat
		found, err := s.G().LocalDb.GetIntoMsgpack(&existing, s.dbKey(tag))
		if err != nil {
			return err
		}
		// Keep only window of the past month
		if found && time.Since(existing.Ctime.Time()) <= time.Hour*24*30 {
			record = existing.AppendStat(record)
		}
		if err := s.G().LocalDb.PutObjMsgpack(s.dbKey(tag), nil, record); err != nil {
			return err
		}
	}
	return nil
}

func (s *DiskInstrumentationStorage) keyPrefix() string {
	return fmt.Sprintf("src:%d", s.src)
}

func (s *DiskInstrumentationStorage) dbKey(tag string) DbKey {
	return DbKey{
		Typ: DBNetworkInstrumentation,
		Key: fmt.Sprintf("%s|%s", s.keyPrefix(), tag),
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

func (s *DiskInstrumentationStorage) GetAll(ctx context.Context) (res []keybase1.InstrumentationStat, err error) {
	defer s.G().CTrace(ctx, "DiskInstrumentationStorage: GetAll", &err)()
	s.Lock()
	defer s.Unlock()

	if err := s.flush(ctx, s.storage); err != nil {
		return nil, err
	}

	dbKeys, err := s.getAllKeysLocked()
	if err != nil {
		return nil, err
	}
	keyPrefix := s.keyPrefix()
	for _, dbKey := range dbKeys {
		// ensure key matches expected format
		keyParts := strings.Split(dbKey.Key, "|")
		if len(keyParts) < 2 || keyParts[0] != keyPrefix {
			continue
		}
		var record keybase1.InstrumentationStat
		ok, err := s.G().LocalDb.GetIntoMsgpack(&record, dbKey)
		if err != nil {
			return nil, err
		} else if !ok {
			continue
		}
		res = append(res, record)
	}
	return res, nil
}

func (s *DiskInstrumentationStorage) Stats(ctx context.Context) (res []keybase1.InstrumentationStat, err error) {
	defer s.G().CTrace(ctx, "DiskInstrumentationStorage: Stats", &err)()
	return s.GetAll(ctx)
}

var tagLogBlacklist = map[string]struct{}{
	"Call gregor.1.incoming.ping": {},
}

func (s *DiskInstrumentationStorage) logRecord(ctx context.Context, tag string, record rpc.InstrumentationRecord) {
	if s.src == keybase1.NetworkSource_LOCAL {
		return
	}
	if _, ok := tagLogBlacklist[tag]; !ok {
		s.G().PerfLog.CDebugf(ctx, "%s %v %s", tag, record.Dur, humanize.Bytes(uint64(record.Size)))
		s.G().RuntimeStats.PushPerfEvent(keybase1.PerfEvent{
			EventType: keybase1.PerfEventType_NETWORK,
			Message:   tag,
			Ctime:     keybase1.ToTime(record.Ctime),
		})
	}
}

func (s *DiskInstrumentationStorage) Put(ctx context.Context, tag string, record rpc.InstrumentationRecord) error {
	s.Lock()
	defer s.Unlock()
	s.storage[tag] = AddRPCRecord(tag, s.storage[tag], record)
	s.logRecord(ctx, tag, record)
	return nil
}

func NetworkInstrumenterStorageFromSrc(g *GlobalContext, src keybase1.NetworkSource) rpc.NetworkInstrumenterStorage {
	switch src {
	case keybase1.NetworkSource_LOCAL:
		return g.LocalNetworkInstrumenterStorage
	case keybase1.NetworkSource_REMOTE:
		return g.RemoteNetworkInstrumenterStorage
	default:
		return rpc.NewDummyInstrumentationStorage()
	}
}
