package cache

import "gopkg.in/src-d/go-git.v4/plumbing"

const (
	initialQueueSize = 20
	MaxSize          = 10 * MiByte
)

type ObjectFIFO struct {
	objects map[plumbing.Hash]plumbing.EncodedObject
	order   *queue

	maxSize    FileSize
	actualSize FileSize
}

// NewObjectFIFO returns an Object cache that keeps the newest objects that fit
// into the specific memory size
func NewObjectFIFO(size FileSize) *ObjectFIFO {
	return &ObjectFIFO{
		objects: make(map[plumbing.Hash]plumbing.EncodedObject),
		order:   newQueue(initialQueueSize),
		maxSize: size,
	}
}

// Add adds a new object to the cache. If the object size is greater than the
// cache size, the object is not added.
func (c *ObjectFIFO) Add(o plumbing.EncodedObject) {
	// if the size of the object is bigger or equal than the cache size,
	// skip it
	if FileSize(o.Size()) >= c.maxSize {
		return
	}

	// if the object is into the cache, do not add it again
	if _, ok := c.objects[o.Hash()]; ok {
		return
	}

	// delete the oldest object if cache is full
	if c.actualSize >= c.maxSize {
		h := c.order.Pop()
		o := c.objects[h]
		if o != nil {
			c.actualSize -= FileSize(o.Size())
			delete(c.objects, h)
		}
	}

	c.objects[o.Hash()] = o
	c.order.Push(o.Hash())
	c.actualSize += FileSize(o.Size())
}

// Get returns an object by his hash. If the object is not found in the cache, it
// returns nil
func (c *ObjectFIFO) Get(k plumbing.Hash) plumbing.EncodedObject {
	return c.objects[k]
}

// Clear the content of this object cache
func (c *ObjectFIFO) Clear() {
	c.objects = make(map[plumbing.Hash]plumbing.EncodedObject)
	c.order = newQueue(initialQueueSize)
	c.actualSize = 0
}
