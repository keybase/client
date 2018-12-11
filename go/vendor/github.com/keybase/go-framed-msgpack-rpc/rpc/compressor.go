package rpc

import (
	"sync"
)

type compressor interface {
	Compress([]byte) ([]byte, error)
	Decompress([]byte) ([]byte, error)
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
