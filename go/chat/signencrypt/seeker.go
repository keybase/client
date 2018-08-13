package signencrypt

import (
	"context"
	"io"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"

	lru "github.com/hashicorp/golang-lru"
)

type decodingReadSeeker struct {
	utils.DebugLabeler

	ctx          context.Context
	source       io.ReadSeeker
	encKey       SecretboxKey
	verifyKey    VerifyKey
	sigPrefix    libkb.SignaturePrefix
	nonce        Nonce
	size, offset int64
	chunks       *lru.Cache
}

var _ io.ReadSeeker = (*decodingReadSeeker)(nil)

func NewDecodingReadSeeker(ctx context.Context, log logger.Logger, source io.ReadSeeker, size int64,
	encKey SecretboxKey, verifyKey VerifyKey, signaturePrefix libkb.SignaturePrefix, nonce Nonce,
	c *lru.Cache) io.ReadSeeker {
	if c == nil {
		c, _ = lru.New(20)
	}
	return &decodingReadSeeker{
		DebugLabeler: utils.NewDebugLabeler(log, "DecodingReadSeeker", true),
		source:       source,
		size:         size,
		chunks:       c,
		encKey:       encKey,
		verifyKey:    verifyKey,
		sigPrefix:    signaturePrefix,
		nonce:        nonce,
	}
}

func (r *decodingReadSeeker) getChunksFromCache(chunks []chunkSpec) (res []byte, ok bool) {
	for _, c := range chunks {
		if pt, ok := r.chunks.Get(c.index); ok {
			res = append(res, pt.([]byte)...)
			r.Debug(r.ctx, "getChunksFromCache: added: index: %d len: %v", c.index, len(pt.([]byte)))
		} else {
			r.Debug(r.ctx, "getChunksFromCache: missed: %v", c.index)
			return res, false
		}
	}
	return res, true
}

func (r *decodingReadSeeker) writeChunksToCache(pt []byte, chunks []chunkSpec) {
	start := chunks[0].ptStart
	for _, c := range chunks {
		r.Debug(r.ctx, "writeChunksToCache: adding index: %d len: %d", c.index,
			len(pt[c.ptStart-start:c.ptEnd-start]))
		r.chunks.Add(c.index, pt[c.ptStart-start:c.ptEnd-start])
	}
}

func (r *decodingReadSeeker) fetchChunks(chunks []chunkSpec) (res []byte, err error) {
	begin := chunks[0].cipherStart
	end := chunks[len(chunks)-1].cipherEnd
	num := end - begin

	if _, err := r.source.Seek(begin, io.SeekStart); err != nil {
		return res, err
	}
	var bufOffset int64
	res = make([]byte, num)
	for {
		n, err := r.source.Read(res[bufOffset:])
		if err != nil {
			return res, err
		}
		bufOffset += int64(n)
		if bufOffset >= num {
			break
		}
	}
	return res, nil
}

func (r *decodingReadSeeker) clamp(offset int64) int64 {
	if offset >= r.size {
		offset = r.size
	}
	return offset
}

func (r *decodingReadSeeker) extractPlaintext(plainText []byte, num int64, chunks []chunkSpec) []byte {
	datBegin := chunks[0].ptStart
	ptBegin := r.offset
	ptEnd := r.clamp(r.offset + num)
	r.Debug(r.ctx, "extractPlaintext: datBegin: %v ptBegin: %v ptEnd: %v", datBegin, ptBegin, ptEnd)
	return plainText[ptBegin-datBegin : ptEnd-datBegin]
}

func (r *decodingReadSeeker) Read(res []byte) (n int, err error) {
	defer r.Trace(r.ctx, func() error { return err }, "Read(%v,%v)", r.offset, len(res))()
	if r.offset >= r.size {
		return 0, io.EOF
	}
	num := int64(len(res))
	chunkEnd := r.clamp(r.offset + num)
	r.Debug(r.ctx, "Read: chunkEnd: %v", chunkEnd)
	chunks := getChunksInRange(r.offset, chunkEnd, r.size)
	var chunkPlaintext []byte

	// Check for a full hit on all the chunks first
	var ok bool
	if chunkPlaintext, ok = r.getChunksFromCache(chunks); !ok {
		chunkEnd = r.clamp(r.offset + 4*DefaultPlaintextChunkLength)
		prefetchChunks := getChunksInRange(r.offset, chunkEnd, r.size)
		cipherText, err := r.fetchChunks(prefetchChunks)
		if err != nil {
			return n, err
		}
		for _, c := range prefetchChunks {
			r.Debug(r.ctx, "Read: chunk: index: %v ptstart: %v ptend: %v cstart: %v cend: %v", c.index,
				c.ptStart, c.ptEnd, c.cipherStart, c.cipherEnd)
		}
		decoder := NewDecoder(r.encKey, r.verifyKey, r.sigPrefix, r.nonce)
		decoder.setChunkNum(uint64(prefetchChunks[0].index))
		if chunkPlaintext, err = decoder.Write(cipherText); err != nil {
			return n, err
		}
		if finishPlaintext, err := decoder.Finish(); err == nil {
			chunkPlaintext = append(chunkPlaintext, finishPlaintext...)
		}
		r.writeChunksToCache(chunkPlaintext, prefetchChunks)
	}

	r.Debug(r.ctx, "Read: len(chunkPlainText): %v", len(chunkPlaintext))
	plainText := r.extractPlaintext(chunkPlaintext, int64(num), chunks)
	copy(res, plainText)
	numRead := int64(len(plainText))
	r.Debug(r.ctx, "Read: len(pt): %v", len(plainText))
	r.offset += numRead
	return int(numRead), nil
}

func (r *decodingReadSeeker) Seek(offset int64, whence int) (res int64, err error) {
	defer r.Trace(r.ctx, func() error { return err }, "Seek(%v,%v)", offset, whence)()
	switch whence {
	case io.SeekStart:
		r.offset = offset
	case io.SeekCurrent:
		r.offset += offset
	case io.SeekEnd:
		r.offset = r.size - offset
	}
	return r.offset, nil
}
