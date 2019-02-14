package lru

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
)

// DiskLRUCleaner keeps the disk state in sync with a DiskLRU which stores
// pointers to files on disk. On db nukes or cache cleaning a value can be
// removed from DiskLRU but be stranded on disk, so we periodically clean this
// up.
type DiskLRUCleaner struct {
	sync.Mutex

	cacheDir      string
	lastClean     time.Time
	cleanDuration time.Duration
	diskLRU       *DiskLRU
	stopCh        chan struct{}
}

func NewDiskLRUCleaner(cacheDir string, diskLRU *DiskLRU) *DiskLRUCleaner {
	return &DiskLRUCleaner{
		cacheDir:      cacheDir,
		cleanDuration: time.Hour,
		diskLRU:       diskLRU,
		stopCh:        make(chan struct{}),
	}
}

func (d *DiskLRUCleaner) Start(mctx libkb.MetaContext) {
	go d.loop(mctx)
	mctx.G().PushShutdownHook(func() error {
		d.Stop()
		return nil
	})
}

func (d *DiskLRUCleaner) Stop() {
	d.Lock()
	defer d.Unlock()
	close(d.stopCh)
}

func (d *DiskLRUCleaner) debug(m libkb.MetaContext, msg string, args ...interface{}) {
	m.CDebugf("DiskLRUCleaner: %s", fmt.Sprintf(msg, args...))
}

func (d *DiskLRUCleaner) loop(mctx libkb.MetaContext) {
	for {
		select {
		case <-time.After(d.cleanDuration):
			d.Clean(mctx)
			d.debug(mctx, "loop: next run: %v", time.Now().Add(d.cleanDuration))
		case <-d.stopCh:
			return
		}
	}
}

func (d *DiskLRUCleaner) Clean(mctx libkb.MetaContext) (err error) {
	mctx.CTraceTimed("DiskLRUCleaner: Clean", func() error { return err })
	d.Lock()
	defer d.Unlock()

	if err := os.MkdirAll(d.cacheDir, os.ModePerm); err != nil {
		return err
	}
	// reverse map of filepaths to lru keys
	cacheRevMap := map[string]string{}
	allVals, err := d.diskLRU.AllValues(mctx.Ctx(), mctx.G())
	if err != nil {
		return err
	}
	for _, entry := range allVals {
		path, ok := entry.Value.(string)
		if !ok {
			continue
		}
		cacheRevMap[path] = entry.Key
	}

	files, err := filepath.Glob(filepath.Join(d.cacheDir, "*"))
	if err != nil {
		return err
	}

	d.debug(mctx, "Clean: found %d files to delete in %s, %d in cache", len(files), d.cacheDir, len(cacheRevMap))
	for _, v := range files {
		if _, ok := cacheRevMap[v]; !ok {
			if err := os.Remove(v); err != nil {
				d.debug(mctx, "Clean: failed to delete file %q: %s", v, err)
			}
		}
	}
	return nil
}
