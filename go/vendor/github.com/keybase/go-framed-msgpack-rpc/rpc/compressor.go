package rpc

import (
	"bytes"
	"compress/gzip"
)

type compressor interface {
	Compress([]byte) ([]byte, error)
	Decompress([]byte) ([]byte, error)
}

type gzipCompressor struct {
	writer *gzip.Writer
	reader *gzip.Reader
}

var _ compressor = (*gzipCompressor)(nil)

func newGzipCompressor() *gzipCompressor {
	return &gzipCompressor{}
}

func (c *gzipCompressor) Compress(data []byte) ([]byte, error) {
	var buf bytes.Buffer
	if c.writer == nil {
		c.writer = gzip.NewWriter(&buf)
	} else {
		c.writer.Reset(&buf)
	}

	if _, err := c.writer.Write(data); err != nil {
		return nil, err
	}
	if err := c.writer.Flush(); err != nil {
		return nil, err
	}
	if err := c.writer.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func (c *gzipCompressor) Decompress(data []byte) ([]byte, error) {
	in := bytes.NewBuffer(data)
	if c.reader == nil {
		reader, err := gzip.NewReader(in)
		if err != nil {
			return nil, err
		}
		c.reader = reader
	} else {
		if err := c.reader.Reset(in); err != nil {
			return nil, err
		}
	}

	var out bytes.Buffer
	if _, err := out.ReadFrom(c.reader); err != nil {
		return nil, err
	}
	if err := c.reader.Close(); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

type compressorCacher struct {
	algs map[CompressionType]compressor
}

func newCompressorCacher() *compressorCacher {
	return &compressorCacher{
		algs: make(map[CompressionType]compressor),
	}
}

func (c *compressorCacher) getCompressor(ctype CompressionType) compressor {
	impl, ok := c.algs[ctype]
	if !ok {
		impl = ctype.NewCompressor()
		c.algs[ctype] = impl
	}
	return impl
}
