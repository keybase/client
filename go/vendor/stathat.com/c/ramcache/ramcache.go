// Package ramcache implements an in-memory key/value cache with
// expirations based on access and insertion times.  It is safe
// for concurrent use by multiple goroutines.
package ramcache // import "stathat.com/c/ramcache"

import (
	"container/heap"
	"errors"
	"fmt"
	"sync"
	"time"
)

// ErrNotFound is returned when a key isn't found in the cache.
var ErrNotFound = errors.New("ramcache: key not found in cache")

// Ramcache is an in-memory key/value store.  It has two
// configuration durations: TTL (time to live) and MaxAge.
// Ramcache removes any objects that haven't been accessed in the
// TTL duration.
// Ramcache removes (on get) any objects that were created more
// than MaxAge time ago.
// This allows you to keep recently accessed objects cached but
// also delete them once they have been in the cache for MaxAge
// duration.
type Ramcache struct {
	cache  map[string]*item
	tqueue timeQueue
	TTL    time.Duration
	MaxAge time.Duration
	frozen bool
	done   chan bool
	sync.RWMutex
}

// New creates a Ramcache with a TTL of 5 minutes.  You can change
// this by setting the result's TTL to any time.Duration you want.
// You can also set the MaxAge on the result.
func New() *Ramcache {
	tq := make(timeQueue, 0)
	c := make(map[string]*item)
	d := make(chan bool)
	r := &Ramcache{cache: c, tqueue: tq, TTL: 5 * time.Minute, done: d}
	go r.cleanup()
	return r
}

// Get retrieves a value from the cache.
func (rc *Ramcache) Get(key string) (interface{}, error) {
	rc.Lock()
	defer rc.Unlock()
	i, ok := rc.cache[key]
	if !ok {
		return nil, ErrNotFound
	}
	if rc.MaxAge > 0 && time.Since(i.createdAt) > rc.MaxAge {
		heap.Remove(&rc.tqueue, i.index)
		delete(rc.cache, key)
		return nil, ErrNotFound
	}

	rc.tqueue.Access(i)
	return i.value, nil
}

// GetNoAccess retrieves a value from the cache, but does not
// update the access time.
func (rc *Ramcache) GetNoAccess(key string) (interface{}, error) {
	rc.Lock()
	defer rc.Unlock()
	i, ok := rc.cache[key]
	if !ok {
		return nil, ErrNotFound
	}
	if rc.MaxAge > 0 && time.Since(i.createdAt) > rc.MaxAge {
		heap.Remove(&rc.tqueue, i.index)
		delete(rc.cache, key)
		return nil, ErrNotFound
	}
	return i.value, nil
}

// Set inserts a value in the cache.  If an object already exists,
// it will be replaced, but the createdAt timestamp won't change.
func (rc *Ramcache) Set(key string, obj interface{}) error {
	rc.Lock()
	defer rc.Unlock()
	i := newItem(key, obj)
	existing, ok := rc.cache[key]
	if ok {
		heap.Remove(&rc.tqueue, existing.index)
		i.createdAt = existing.createdAt
	}
	rc.cache[key] = i
	rc.tqueue.Insert(i)
	return nil
}

// Delete deletes an item from the cache.
func (rc *Ramcache) Delete(key string) error {
	rc.Lock()
	defer rc.Unlock()
	i, ok := rc.cache[key]
	if !ok {
		return ErrNotFound
	}
	heap.Remove(&rc.tqueue, i.index)
	delete(rc.cache, key)
	return nil
}

// Remove deletes an item from the cache and returns it.
func (rc *Ramcache) Remove(key string) (interface{}, error) {
	rc.Lock()
	defer rc.Unlock()
	i, ok := rc.cache[key]
	if !ok {
		return nil, ErrNotFound
	}
	heap.Remove(&rc.tqueue, i.index)
	delete(rc.cache, key)
	return i.value, nil
}

// CreatedAt returns the time the key was inserted into the cache.
func (rc *Ramcache) CreatedAt(key string) (t time.Time, err error) {
	rc.RLock()
	defer rc.RUnlock()
	i, ok := rc.cache[key]
	if !ok {
		err = ErrNotFound
		return
	}
	t = i.createdAt
	return
}

// Count returns the number of elements in the cache.
func (rc *Ramcache) Count() int {
	rc.RLock()
	defer rc.RUnlock()
	return len(rc.cache)
}

// Keys returns all the keys in the cache.
func (rc *Ramcache) Keys() []string {
	rc.RLock()
	defer rc.RUnlock()
	var result []string
	for k := range rc.cache {
		result = append(result, k)
	}
	return result
}

// Shutdown cleanly stops any background work, allowing Ramcache
// to be garbage collected.
func (rc *Ramcache) Shutdown() {
	close(rc.done)
}

func (rc *Ramcache) cleanup() {
	for {
		select {
		case <-time.After(10 * time.Second):
			rc.clean(time.Now())
		case <-rc.done:
			return
		}
	}
}

func (rc *Ramcache) clean(now time.Time) {
	rc.Lock()
	defer rc.Unlock()
	if rc.frozen {
		return
	}
	for i := 0; i < 10000; i++ {
		if rc.tqueue.Len() == 0 {
			return
		}
		top := heap.Pop(&rc.tqueue).(*item)
		if now.Sub(top.accessedAt) > rc.TTL {
			delete(rc.cache, top.key)
		} else {
			heap.Push(&rc.tqueue, top)
			return
		}
	}
}

// Freeze stops Ramcache from removing any expired entries.
func (rc *Ramcache) Freeze() {
	rc.Lock()
	rc.frozen = true
	rc.Unlock()
}

// Each will call f for every entry in the cache.
func (rc *Ramcache) Each(f func(key string, value interface{})) {
	rc.RLock()
	defer rc.Unlock()
	for k, v := range rc.cache {
		f(k, v.value)
	}
}

// An item is something cached in the Ramcache, and managed in the timeQueue.
type item struct {
	key        string
	value      interface{}
	createdAt  time.Time
	accessedAt time.Time
	index      int
}

func newItem(key string, val interface{}) *item {
	now := time.Now()
	return &item{key: key, value: val, createdAt: now, accessedAt: now, index: -1}
}

// A timeQueue implements heap.Interface and holds items
type timeQueue []*item

func (tq timeQueue) Len() int { return len(tq) }

func (tq timeQueue) Less(i, j int) bool {
	return tq[i].accessedAt.Before(tq[j].accessedAt)
}

func (tq timeQueue) Swap(i, j int) {
	tq[i], tq[j] = tq[j], tq[i]
	tq[i].index = i
	tq[j].index = j
}

func (tq *timeQueue) Push(x interface{}) {
	a := *tq
	n := len(a)
	// a = a[0 : n+1]
	itm := x.(*item)
	itm.index = n
	// a[n] = itm
	a = append(a, itm)
	*tq = a
}

func (tq *timeQueue) Pop() interface{} {
	a := *tq
	n := len(a)
	itm := a[n-1]
	itm.index = -1
	*tq = a[0 : n-1]
	return itm
}

func (tq *timeQueue) Access(itm *item) {
	heap.Remove(tq, itm.index)
	itm.accessedAt = time.Now()
	heap.Push(tq, itm)
}

func (tq *timeQueue) Insert(itm *item) {
	heap.Push(tq, itm)
}

// Bool is a convenience method to type assert a Ramcache reply
// into a boolean value.
func Bool(reply interface{}, err error) (bool, error) {
	if err != nil {
		return false, err
	}
	b, ok := reply.(bool)
	if !ok {
		return false, fmt.Errorf("ramcache: unexpected type for Bool, got %T", reply)
	}
	return b, nil
}
