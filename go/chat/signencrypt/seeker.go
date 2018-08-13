package signencrypt

import (
	"fmt"
	"io"

	"github.com/keybase/client/go/libkb"

	lru "github.com/hashicorp/golang-lru"
)

type decodingReadSeeker struct {
	source                   io.ReadSeeker
	size, sealedSize, offset int64
	decoder                  *Decoder
	chunks                   *lru.Cache
}

var _ io.ReadSeeker = (*decodingReadSeeker)(nil)

func NewDecodingReadSeeker(source io.ReadSeeker, size int64, encKey SecretboxKey, verifyKey VerifyKey,
	signaturePrefix libkb.SignaturePrefix, nonce Nonce) io.ReadSeeker {
	decoder := NewDecoder(encKey, verifyKey, libkb.SignaturePrefixChatAttachment, nonce)
	c, _ := lru.New(16)
	return &decodingReadSeeker{
		source:     source,
		size:       size,
		sealedSize: GetSealedSize(size),
		decoder:    decoder,
		chunks:     c,
	}
}

func (r *decodingReadSeeker) fetchChunks(chunks []ChunkSpec) (res []byte, err error) {
	begin := chunks[0].CipherStart
	end := chunks[len(chunks)-1].CipherEnd
	if end >= r.sealedSize {
		end = r.sealedSize
	}
	num := end - begin

	// Check for a full hit on all the chunks first
	// TODO

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

func (r *decodingReadSeeker) extractPlaintext(plainText []byte, num int64, chunks []ChunkSpec) []byte {
	datBegin := chunks[0].PTStart
	ptBegin := r.offset
	ptEnd := r.offset + num
	if ptEnd >= r.size {
		ptEnd = r.size
	}
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
	fmt.Printf("Read: offset: %v: len: %v end: %v\n", r.offset, len(res), end)
	chunks := GetChunksInRange(r.offset, end)
	cipherText, err := r.fetchChunks(chunks)
	if err != nil {
		return n, err
	}
	for _, c := range chunks {
		fmt.Printf("chunk: index: %v ptstart: %v ptend: %v cstart: %v cend: %v\n", c.Index, c.PTStart, c.PTEnd, c.CipherStart, c.CipherEnd)
	}
	r.decoder.SetChunkNum(uint64(chunks[0].Index))
	chunkPlainText, err := r.decoder.Write(cipherText)
	if err != nil {
		return n, err
	}
	plainText := r.extractPlaintext(chunkPlainText, int64(num), chunks)
	copy(res, plainText)
	numRead := int64(len(plainText))
	fmt.Printf("Read: len(pt): %v\n", len(plainText))
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
