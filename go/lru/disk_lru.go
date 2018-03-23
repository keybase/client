package lru

import (
	"container/list"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	context "golang.org/x/net/context"
)

type DiskLRUEntry struct {
	Key          string
	Value        interface{}
	Ctime        time.Time
	LastAccessed time.Time
}

type diskLRUIndexMarshaled struct {
	Version   int
	EntryKeys []string
}

type diskLRUIndex struct {
	sync.Mutex
	Version     int
	EntryKeys   *list.List
	entryKeyMap map[string]*list.Element
	dirty       bool
}

func newDiskLRUIndex(version int) *diskLRUIndex {
	return &diskLRUIndex{
		EntryKeys:   list.New(),
		Version:     version,
		entryKeyMap: make(map[string]*list.Element),
	}
}

func (d *diskLRUIndex) exists(key string) *list.Element {
	return d.entryKeyMap[key]
}

func (d *diskLRUIndex) Exists(key string) bool {
	d.Lock()
	defer d.Unlock()
	return (d.exists(key) != nil)
}

func (d *diskLRUIndex) remove(key string) {
	if el, ok := d.entryKeyMap[key]; ok {
		d.EntryKeys.Remove(el)
		delete(d.entryKeyMap, key)
	}
}

func (d *diskLRUIndex) Remove(key string) {
	d.Lock()
	defer d.Unlock()
	d.dirty = true
	d.remove(key)
}

func (d *diskLRUIndex) put(key string) {
	d.entryKeyMap[key] = d.EntryKeys.PushFront(key)
}

func (d *diskLRUIndex) Put(key string) {
	d.Lock()
	defer d.Unlock()
	d.dirty = true
	if d.exists(key) != nil {
		d.remove(key)
	}
	d.put(key)
}

func (d *diskLRUIndex) IsDirty() bool {
	d.Lock()
	defer d.Unlock()
	return d.dirty
}

func (d *diskLRUIndex) ClearDirty() {
	d.Lock()
	defer d.Unlock()
	d.dirty = false
}

func (d *diskLRUIndex) Marshal() diskLRUIndexMarshaled {
	var m diskLRUIndexMarshaled
	m.Version = d.Version
	for e := d.EntryKeys.Front(); e != nil; e = e.Next() {
		m.EntryKeys = append(m.EntryKeys, e.Value.(string))
	}
	return m
}

func (d *diskLRUIndex) Unmarshal(m diskLRUIndexMarshaled) {
	d.EntryKeys = list.New()
	d.Version = m.Version
	d.entryKeyMap = make(map[string]*list.Element)
	for _, k := range m.EntryKeys {
		d.entryKeyMap[k] = d.EntryKeys.PushBack(k)
	}
}

func (d *diskLRUIndex) Size() int {
	d.Lock()
	d.Unlock()
	return d.EntryKeys.Len()
}

func (d *diskLRUIndex) OldestKey() (string, error) {
	d.Lock()
	defer d.Unlock()
	if d.EntryKeys.Len() == 0 {
		return "", errors.New("index is empty")
	}
	return d.EntryKeys.Back().Value.(string), nil
}

// DiskLRU maintains a cache of files on the disk in a LRU manner.
type DiskLRU struct {
	sync.Mutex

	index   *diskLRUIndex
	name    string
	version int
	maxSize int

	lastFlush     time.Time
	flushDuration time.Duration

	// testing
	flushCh chan struct{}
}

func NewDiskLRU(name string, version int, maxSize int) *DiskLRU {
	return &DiskLRU{
		name:          name,
		version:       version,
		maxSize:       maxSize,
		flushDuration: time.Minute,
	}
}

func (d *DiskLRU) debug(ctx context.Context, lctx libkb.LRUContext, msg string, args ...interface{}) {
	lctx.GetLog().CDebugf(ctx, fmt.Sprintf("DiskLRU: %s(%d): ", d.name, d.version)+msg, args...)
}

func (d *DiskLRU) indexKey() libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBDiskLRUIndex,
		Key: fmt.Sprintf("%s:%d", d.name, d.version),
	}
}

func (d *DiskLRU) entryKey(key string) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBDiskLRUEntries,
		Key: fmt.Sprintf("%s:%d:%s", d.name, d.version, key),
	}
}

func (d *DiskLRU) readIndex(ctx context.Context, lctx libkb.LRUContext) (res *diskLRUIndex, err error) {
	// Check memory and stash if we read with no error
	if d.index != nil {
		return d.index, nil
	}
	defer func() {
		if err == nil && res != nil {
			d.index = res
		}
	}()

	// Grab from the disk if we miss on memory
	var marshalIndex diskLRUIndexMarshaled
	res = new(diskLRUIndex)
	found, err := lctx.GetKVStore().GetInto(&marshalIndex, d.indexKey())
	if err != nil {
		return nil, err
	}
	if !found {
		return newDiskLRUIndex(d.version), nil
	}
	res.Unmarshal(marshalIndex)
	return res, nil
}

func (d *DiskLRU) writeIndex(ctx context.Context, lctx libkb.LRUContext, index *diskLRUIndex,
	forceFlush bool) error {
	if forceFlush || lctx.GetClock().Now().Sub(d.lastFlush) > d.flushDuration {
		marshalIndex := index.Marshal()
		if err := lctx.GetKVStore().PutObj(d.indexKey(), nil, marshalIndex); err != nil {
			return err
		}
		d.lastFlush = lctx.GetClock().Now()
		index.ClearDirty()
		if d.flushCh != nil {
			d.flushCh <- struct{}{}
		}
	}
	return nil
}

func (d *DiskLRU) readEntry(ctx context.Context, lctx libkb.LRUContext, key string) (found bool, res DiskLRUEntry, err error) {
	found, err = lctx.GetKVStore().GetInto(&res, d.entryKey(key))
	if err != nil {
		return false, res, err
	}
	if !found {
		return false, res, nil
	}
	return true, res, nil
}

func (d *DiskLRU) accessEntry(ctx context.Context, lctx libkb.LRUContext, index *diskLRUIndex,
	entry *DiskLRUEntry) error {
	// Promote the key in the index
	index.Put(entry.Key)
	// Write out the entry with new accessed time
	entry.LastAccessed = lctx.GetClock().Now()
	return lctx.GetKVStore().PutObj(d.entryKey(entry.Key), nil, entry)
}

func (d *DiskLRU) Get(ctx context.Context, lctx libkb.LRUContext, key string) (found bool, res DiskLRUEntry, err error) {
	d.Lock()
	defer d.Unlock()

	var index *diskLRUIndex
	defer func() {
		// Commit the index
		if err == nil && index != nil && index.IsDirty() {
			d.writeIndex(ctx, lctx, index, false)
		}
	}()

	// Grab entry index
	index, err = d.readIndex(ctx, lctx)
	if err != nil {
		return found, res, err
	}
	// Check for a straight up miss
	if !index.Exists(key) {
		return false, res, nil
	}
	// Read entry
	found, res, err = d.readEntry(ctx, lctx, key)
	if err != nil {
		return found, res, err
	}
	if !found {
		// remove from index
		index.Remove(key)
		return false, res, nil
	}
	// update last accessed time for the entry
	if err = d.accessEntry(ctx, lctx, index, &res); err != nil {
		return found, res, err
	}

	return true, res, nil
}

func (d *DiskLRU) removeEntry(ctx context.Context, lctx libkb.LRUContext, index *diskLRUIndex, key string) error {
	index.Remove(key)
	return lctx.GetKVStore().Delete(d.entryKey(key))
}

func (d *DiskLRU) addEntry(ctx context.Context, lctx libkb.LRUContext, index *diskLRUIndex, key string,
	value interface{}) (evicted *DiskLRUEntry, err error) {

	// Add the new item
	index.Put(key)
	item := DiskLRUEntry{
		Key:          key,
		Value:        value,
		Ctime:        lctx.GetClock().Now(),
		LastAccessed: lctx.GetClock().Now(),
	}
	if err = lctx.GetKVStore().PutObj(d.entryKey(key), nil, item); err != nil {
		return nil, err
	}

	if index.Size() > d.maxSize {
		// Evict the oldest item
		var found bool
		var lastItem DiskLRUEntry
		lastKey, err := index.OldestKey()
		if err == nil {
			found, lastItem, err = d.readEntry(ctx, lctx, lastKey)
			if err != nil {
				return nil, err
			}
			if found {
				evicted = &lastItem
				d.debug(ctx, lctx, "addEntry: evicting item: key: %s", lastKey)
			}
			if err = d.removeEntry(ctx, lctx, index, lastKey); err != nil {
				return nil, err
			}
		} else {
			d.debug(ctx, lctx, "addEntry: failed to find oldest key, check cache config")
		}
	}

	return evicted, nil
}

func (d *DiskLRU) Put(ctx context.Context, lctx libkb.LRUContext, key string, value interface{}) (evicted *DiskLRUEntry, err error) {
	d.Lock()
	defer d.Unlock()

	var index *diskLRUIndex
	defer func() {
		// Commit the index
		if err == nil && index != nil && index.IsDirty() {
			d.writeIndex(ctx, lctx, index, false)
		}
	}()

	// Grab entry index
	index, err = d.readIndex(ctx, lctx)
	if err != nil {
		return nil, err
	}
	// Remove existing entry from the index (we don't need to remove entry off the disk, since we will
	// overwrite it with new stuff)
	if index.Exists(key) {
		index.Remove(key)
	}
	// Add the item
	return d.addEntry(ctx, lctx, index, key, value)
}

func (d *DiskLRU) ClearMemory(ctx context.Context, lctx libkb.LRUContext) {
	d.Lock()
	defer d.Unlock()
	d.flush(ctx, lctx)
	d.index = nil
}

func (d *DiskLRU) flush(ctx context.Context, lctx libkb.LRUContext) error {
	if d.index != nil {
		return d.writeIndex(ctx, lctx, d.index, true)
	}
	return nil
}

func (d *DiskLRU) Flush(ctx context.Context, lctx libkb.LRUContext) error {
	d.Lock()
	defer d.Unlock()
	return d.flush(ctx, lctx)
}
