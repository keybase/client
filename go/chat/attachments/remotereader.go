package attachments

import (
	"bytes"
	"io"

	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/signencrypt"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

type decryptorFn func(io.Writer, io.Reader) error

type remoteAssetReader struct {
	bucket    s3.BucketInt
	ctx       context.Context
	offset    int64
	asset     chat1.Asset
	decryptor decryptorFn
}

var _ io.ReadSeeker = (*remoteAssetReader)(nil)

func newRemoteAssetReader(ctx context.Context, bucket s3.BucketInt, asset chat1.Asset, decryptor decryptorFn) *remoteAssetReader {
	return &remoteAssetReader{
		bucket:    bucket,
		ctx:       ctx,
		asset:     asset,
		decryptor: decryptor,
	}
}

func (r *remoteAssetReader) fetchChunks(chunks []signencrypt.ChunkSpec) ([]byte, error) {
	begin := chunks[0].CipherStart
	end := chunks[len(chunks)-1].CipherEnd
	rc, err := r.bucket.GetReaderWithRange(r.ctx, r.asset.Path, begin, end)
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	res := bytes.NewBuffer(nil)
	if _, err := io.Copy(res, rc); err != nil {
		return nil, err
	}
	return res.Bytes(), nil
}

func (r *remoteAssetReader) extractPlaintext(plainText []byte, num int64, chunks []signencrypt.ChunkSpec) []byte {
	datBegin := chunks[0].PTStart
	ptBegin := r.offset
	ptEnd := r.offset + num
	return plainText[ptBegin-datBegin : ptEnd-datBegin]
}

func (r *remoteAssetReader) Read(res []byte) (n int, err error) {
	num := int64(len(res))
	end := r.offset + num
	chunks := signencrypt.GetChunksInRange(r.offset, end)
	cipherText, err := r.fetchChunks(chunks)
	if err != nil {
		return n, err
	}
	plainTextBuf := bytes.NewBuffer(nil)
	if err := r.decryptor(plainTextBuf, bytes.NewReader(cipherText)); err != nil {
		return n, err
	}
	plainText := r.extractPlaintext(plainTextBuf.Bytes(), int64(num), chunks)
	copy(res, plainText)
	r.offset += num
	return int(num), nil
}

func (r *remoteAssetReader) Seek(offset int64, whence int) (int64, error) {
	switch whence {
	case io.SeekStart:
		r.offset = offset
	case io.SeekCurrent:
		r.offset += offset
	case io.SeekEnd:
		r.offset = r.asset.Size - offset
	}
	return r.offset, nil
}
