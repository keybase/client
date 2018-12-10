package rpc

import (
	"bytes"
	"compress/gzip"
	"io"
	"io/ioutil"
	"sync"
)

type compressor interface {
	Compress([]byte) ([]byte, error)
	Decompress([]byte) ([]byte, error)
}

var gzipWriterPool = sync.Pool{
	New: func() interface{} {
		return gzip.NewWriter(ioutil.Discard)
	},
}

var gzipReaderPool = sync.Pool{
	New: func() interface{} {
		return new(gzip.Reader)
	},
}

type gzipCompressor struct{}

var _ compressor = (*gzipCompressor)(nil)

func newGzipCompressor() *gzipCompressor {
	return &gzipCompressor{}
}

func (c *gzipCompressor) getGzipWriter(writer io.Writer) (*gzip.Writer, func()) {
	gzipWriter := gzipWriterPool.Get().(*gzip.Writer)
	gzipWriter.Reset(writer)
	return gzipWriter, func() {
		gzipWriterPool.Put(gzipWriter)
	}
}
func (c *gzipCompressor) getGzipReader(reader io.Reader) (*gzip.Reader, func(), error) {
	gzipReader := gzipReaderPool.Get().(*gzip.Reader)
	if err := gzipReader.Reset(reader); err != nil {
		return nil, func() {}, err
	}
	return gzipReader, func() {
		gzipReaderPool.Put(gzipReader)
	}, nil
}

func (c *gzipCompressor) Compress(data []byte) ([]byte, error) {

	var buf bytes.Buffer
	writer, reclaim := c.getGzipWriter(&buf)
	defer reclaim()

	if _, err := writer.Write(data); err != nil {
		return nil, err
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func (c *gzipCompressor) Decompress(data []byte) ([]byte, error) {

	in := bytes.NewReader(data)
	reader, reclaim, err := c.getGzipReader(in)
	if err != nil {
		return nil, err
	}
	defer reclaim()

	var out bytes.Buffer
	if _, err := out.ReadFrom(reader); err != nil {
		return nil, err
	}
	if err := reader.Close(); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

type compressorCacher struct {
	sync.Mutex
	algs map[CompressionType]compressor
}

func newCompressorCacher() *compressorCacher {
	return &compressorCacher{
		algs: make(map[CompressionType]compressor),
	}
}

func (c *compressorCacher) getCompressor(ctype CompressionType) compressor {
	c.Lock()
	defer c.Unlock()

	impl, ok := c.algs[ctype]
	if !ok {
		impl = ctype.NewCompressor()
		c.algs[ctype] = impl
	}
	return impl
}
