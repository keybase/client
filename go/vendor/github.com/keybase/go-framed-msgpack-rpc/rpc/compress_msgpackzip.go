package rpc

import "github.com/keybase/msgpackzip"

type msgpackzipCompressor struct{}

var _ compressor = (*msgpackzipCompressor)(nil)

func newMsgpackzipCompressor() *msgpackzipCompressor {
	return &msgpackzipCompressor{}
}

func (c *msgpackzipCompressor) Compress(data []byte) ([]byte, error) {
	return msgpackzip.Compress(data)
}

func (c *msgpackzipCompressor) Decompress(data []byte) ([]byte, error) {
	return msgpackzip.Inflate(data)
}
