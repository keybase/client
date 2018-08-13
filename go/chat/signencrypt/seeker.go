package signencrypt

import (
	"fmt"
	"io"

	"github.com/keybase/client/go/libkb"

	lru "github.com/hashicorp/golang-lru"
)

type decodingReadSeeker struct {
	source       io.ReadSeeker
	encKey       SecretboxKey
	verifyKey    VerifyKey
	sigPrefix    libkb.SignaturePrefix
	nonce        Nonce
	size, offset int64
	chunks       *lru.Cache
}

var _ io.ReadSeeker = (*decodingReadSeeker)(nil)

func NewDecodingReadSeeker(source io.ReadSeeker, size int64, encKey SecretboxKey, verifyKey VerifyKey,
	signaturePrefix libkb.SignaturePrefix, nonce Nonce) io.ReadSeeker {
	c, _ := lru.New(16)
	return &decodingReadSeeker{
		source:    source,
		size:      size,
		chunks:    c,
		encKey:    encKey,
		verifyKey: verifyKey,
		sigPrefix: signaturePrefix,
		nonce:     nonce,
	}
}

func (r *decodingReadSeeker) getChunksFromCache(chunks []chunkSpec) (res []byte, ok bool) {
	for _, c := range chunks {
		if pt, ok := r.chunks.Get(c.index); ok {
			res = append(res, pt.([]byte)...)
			fmt.Printf("getChunksFromCache: added: %v\n", len(pt.([]byte)))
		} else {
			return res, false
		}
	}
	return res, true
}

func (r *decodingReadSeeker) writeChunksToCache(pt []byte, chunks []chunkSpec) {
	start := chunks[0].ptStart
	for _, c := range chunks {
		fmt.Printf("writeChunksToCache: adding len: %d\n", len(pt[c.ptStart-start:c.ptEnd-start]))
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

func (r *decodingReadSeeker) extractPlaintext(plainText []byte, num int64, chunks []chunkSpec) []byte {
	datBegin := chunks[0].ptStart
	ptBegin := r.offset
	ptEnd := r.offset + num
	if ptEnd >= r.size {
		ptEnd = r.size
	}
	fmt.Printf("extractPlaintext: datBegin: %v ptBegin: %v ptEnd: %v\n", datBegin, ptBegin, ptEnd)
	return plainText[ptBegin-datBegin : ptEnd-datBegin]
}

func (r *decodingReadSeeker) Read(res []byte) (n int, err error) {
	if r.offset >= r.size {
		return 0, io.EOF
	}
	num := int64(len(res))
	end := r.offset + num
	if end >= r.size {
		end = r.size
	}
	fmt.Printf("+++ Read: offset: %v: len: %v end: %v\n", r.offset, len(res), end)
	chunks := getChunksInRange(r.offset, end, r.size)
	var chunkPlaintext []byte

	// Check for a full hit on all the chunks first
	var ok bool
	if chunkPlaintext, ok = r.getChunksFromCache(chunks); !ok {
		cipherText, err := r.fetchChunks(chunks)
		if err != nil {
			return n, err
		}
		for _, c := range chunks {
			fmt.Printf("chunk: index: %v ptstart: %v ptend: %v cstart: %v cend: %v\n", c.index, c.ptStart, c.ptEnd, c.cipherStart, c.cipherEnd)
		}
		decoder := NewDecoder(r.encKey, r.verifyKey, r.sigPrefix, r.nonce)
		decoder.setChunkNum(uint64(chunks[0].index))
		if chunkPlaintext, err = decoder.Write(cipherText); err != nil {
			return n, err
		}
		if finishPlaintext, err := decoder.Finish(); err == nil {
			chunkPlaintext = append(chunkPlaintext, finishPlaintext...)
		}
		r.writeChunksToCache(chunkPlaintext, chunks)
	}

	fmt.Printf("Read: len(chunkPlainText): %v\n", len(chunkPlaintext))
	plainText := r.extractPlaintext(chunkPlaintext, int64(num), chunks)
	copy(res, plainText)
	numRead := int64(len(plainText))
	fmt.Printf("--- Read: len(pt): %v\n", len(plainText))
	r.offset += numRead
	return int(numRead), nil
}

func (r *decodingReadSeeker) Seek(offset int64, whence int) (res int64, err error) {
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
