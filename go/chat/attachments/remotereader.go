package attachments

import (
	"bytes"
	"io"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/go-crypto/ed25519"

	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/signencrypt"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

type remoteAssetStreamer struct {
	utils.DebugLabeler
	bucket    s3.BucketInt
	ctx       context.Context
	offset    int64
	asset     chat1.Asset
	decryptor *signencrypt.Decoder
}

var _ io.ReadSeeker = (*remoteAssetStreamer)(nil)

func newRemoteAssetStreamer(ctx context.Context, log logger.Logger, bucket s3.BucketInt, asset chat1.Asset) *remoteAssetStreamer {
	var xencKey [signencrypt.SecretboxKeySize]byte
	copy(xencKey[:], asset.Key)
	var xverifyKey [ed25519.PublicKeySize]byte
	copy(xverifyKey[:], asset.VerifyKey)
	var nonce [signencrypt.NonceSize]byte
	if asset.Nonce != nil {
		copy(nonce[:], asset.Nonce)
	}
	decoder := signencrypt.NewDecoder(&xencKey, &xverifyKey, libkb.SignaturePrefixChatAttachment, &nonce)
	return &remoteAssetStreamer{
		DebugLabeler: utils.NewDebugLabeler(log, "remoteAssetStreamer", false),
		bucket:       bucket,
		ctx:          ctx,
		asset:        asset,
		decryptor:    decoder,
	}
}

func (r *remoteAssetStreamer) getAssetSize() int64 {
	return signencrypt.GetPlaintextSize(r.asset.Size)
}

func (r *remoteAssetStreamer) fetchChunks(chunks []signencrypt.ChunkSpec) ([]byte, error) {
	begin := chunks[0].CipherStart
	end := chunks[len(chunks)-1].CipherEnd
	rc, err := r.bucket.GetReaderWithRange(r.ctx, r.asset.Path, begin, end)
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	var res bytes.Buffer
	if _, err := io.Copy(&res, rc); err != nil {
		return nil, err
	}
	return res.Bytes(), nil
}

func (r *remoteAssetStreamer) extractPlaintext(plainText []byte, num int64, chunks []signencrypt.ChunkSpec) []byte {
	datBegin := chunks[0].PTStart
	ptBegin := r.offset
	ptEnd := r.offset + num
	if ptEnd >= r.getAssetSize() {
		ptEnd = r.getAssetSize()
	}
	r.Debug(r.ctx, "extractPlaintext: assetSize: %v ptBegin: %v ptEnd: %v", r.getAssetSize(), ptBegin, ptEnd)
	return plainText[ptBegin-datBegin : ptEnd-datBegin]
}

func (r *remoteAssetStreamer) Read(res []byte) (n int, err error) {
	defer r.Trace(r.ctx, func() error { return err }, "Read(%v,%d)", r.offset, len(res))()
	if r.offset >= r.getAssetSize() {
		return 0, io.EOF
	}
	num := int64(len(res))
	end := r.offset + num
	chunks := signencrypt.GetChunksInRange(r.offset, end)
	for _, c := range chunks {
		r.Debug(r.ctx, "Read: chunk: %+v", c)
	}
	cipherText, err := r.fetchChunks(chunks)
	if err != nil {
		return n, err
	}
	r.decryptor.SetChunkNum(uint64(chunks[0].Index))
	chunkPlainText, err := r.decryptor.Write(cipherText)
	if err != nil {
		return n, err
	}
	plainText := r.extractPlaintext(chunkPlainText, int64(num), chunks)
	copy(res, plainText)
	numRead := int64(len(plainText))
	r.offset += numRead
	r.Debug(r.ctx, "Read: numRead: %d", numRead)
	return int(numRead), nil
}

func (r *remoteAssetStreamer) Seek(offset int64, whence int) (res int64, err error) {
	defer r.Trace(r.ctx, func() error { return err }, "Seek(%v,%v)", offset, whence)()
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
