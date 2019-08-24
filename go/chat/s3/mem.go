package s3

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"github.com/keybase/client/go/libkb"
	"io"
	"io/ioutil"
	"sort"
	"sync"

	"golang.org/x/net/context"
)

type Mem struct {
	mc     *MemConn
	mcMake sync.Once
}

var _ Root = &Mem{}

func (m *Mem) New(g *libkb.GlobalContext, signer Signer, region Region) Connection {
	return m.NewMemConn()
}

type MemConn struct {
	buckets map[string]*MemBucket
	sync.Mutex
}

func (m *Mem) NewMemConn() *MemConn {
	m.mcMake.Do(func() {
		m.mc = &MemConn{
			buckets: make(map[string]*MemBucket),
		}
	})
	return m.mc
}

var _ Connection = &MemConn{}

func (s *MemConn) SetAccessKey(key string) {}

func (s *MemConn) Bucket(name string) BucketInt {
	s.Lock()
	defer s.Unlock()
	b, ok := s.buckets[name]
	if ok {
		return b
	}
	b = NewMemBucket(s, name)
	s.buckets[name] = b
	return b
}

func (s *MemConn) AllMultis() []*MemMulti {
	s.Lock()
	defer s.Unlock()
	var all []*MemMulti
	for _, b := range s.buckets {
		for _, m := range b.multis {
			all = append(all, m)
		}
	}
	return all
}

type MemBucket struct {
	conn    *MemConn
	name    string
	objects map[string][]byte
	multis  map[string]*MemMulti
	sync.Mutex
}

func NewMemBucket(conn *MemConn, name string) *MemBucket {
	return &MemBucket{
		conn:    conn,
		name:    name,
		objects: make(map[string][]byte),
		multis:  make(map[string]*MemMulti),
	}
}

var _ BucketInt = &MemBucket{}

func (b *MemBucket) GetReader(ctx context.Context, path string) (io.ReadCloser, error) {
	b.Lock()
	defer b.Unlock()
	obj, ok := b.objects[path]
	if !ok {
		return nil, fmt.Errorf("bucket %q, path %q does not exist", b.name, path)
	}
	return ioutil.NopCloser(bytes.NewBuffer(obj)), nil
}

func (b *MemBucket) GetReaderWithRange(ctx context.Context, path string, begin, end int64) (io.ReadCloser, error) {
	b.Lock()
	defer b.Unlock()
	obj, ok := b.objects[path]
	if !ok {
		return nil, fmt.Errorf("bucket %q, path %q does not exist", b.name, path)
	}
	if end >= int64(len(obj)) {
		end = int64(len(obj))
	}
	return ioutil.NopCloser(bytes.NewBuffer(obj[begin:end])), nil
}

func (b *MemBucket) PutReader(ctx context.Context, path string, r io.Reader, length int64, contType string, perm ACL, options Options) error {
	b.Lock()
	defer b.Unlock()

	var buf bytes.Buffer
	_, err := buf.ReadFrom(r)
	if err != nil {
		return err
	}
	b.objects[path] = buf.Bytes()

	return nil
}

func (b *MemBucket) Del(ctx context.Context, path string) error {
	b.Lock()
	defer b.Unlock()

	delete(b.objects, path)
	return nil
}

func (b *MemBucket) setObject(path string, data []byte) {
	b.Lock()
	defer b.Unlock()
	b.objects[path] = data
}

func (b *MemBucket) Multi(ctx context.Context, key, contType string, perm ACL) (MultiInt, error) {
	b.Lock()
	defer b.Unlock()
	m, ok := b.multis[key]
	if ok {
		return m, nil
	}
	m = NewMemMulti(b, key)
	b.multis[key] = m
	return m, nil
}

type MemMulti struct {
	bucket      *MemBucket
	path        string
	parts       map[int]*part
	numPutParts int
	sync.Mutex
}

var _ MultiInt = &MemMulti{}

func NewMemMulti(b *MemBucket, path string) *MemMulti {
	return &MemMulti{
		bucket: b,
		path:   path,
		parts:  make(map[int]*part),
	}
}

func (m *MemMulti) ListParts(ctx context.Context) ([]Part, error) {
	m.Lock()
	defer m.Unlock()

	var ps []Part
	for _, p := range m.parts {
		ps = append(ps, p.export())
	}
	return ps, nil
}

func (m *MemMulti) Complete(ctx context.Context, parts []Part) error {
	m.Lock()
	defer m.Unlock()

	// match parts coming in with existing parts
	var scratch partList
	for _, p := range parts {
		if pp, ok := m.parts[p.N]; ok {
			scratch = append(scratch, pp)
		}
	}

	// assemble into one block
	sort.Sort(scratch)
	var buf bytes.Buffer
	for _, p := range scratch {
		buf.Write(p.data)
	}

	// store in bucket
	m.bucket.setObject(m.path, buf.Bytes())

	return nil
}

func (m *MemMulti) PutPart(ctx context.Context, index int, r io.ReadSeeker) (Part, error) {
	m.Lock()
	defer m.Unlock()

	var buf bytes.Buffer
	_, err := buf.ReadFrom(r)
	if err != nil {
		return Part{}, err
	}
	p := newPart(index, buf)
	m.parts[index] = p

	m.numPutParts++

	return p.export(), nil
}

// NumPutParts returns the number of times PutPart was called.
func (m *MemMulti) NumPutParts() int {
	m.Lock()
	defer m.Unlock()

	return m.numPutParts
}

type part struct {
	index int
	hash  string
	data  []byte
}

func newPart(index int, buf bytes.Buffer) *part {
	p := &part{
		index: index,
		data:  buf.Bytes(),
	}
	h := md5.Sum(p.data)
	p.hash = hex.EncodeToString(h[:])
	return p
}

func (p *part) export() Part {
	return Part{N: p.index, ETag: `"` + p.hash + `"`, Size: int64(len(p.data))}
}

type partList []*part

func (x partList) Len() int           { return len(x) }
func (x partList) Less(a, b int) bool { return x[a].index < x[b].index }
func (x partList) Swap(a, b int)      { x[a], x[b] = x[b], x[a] }
