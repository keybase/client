package attachments

import (
	"bytes"
	"fmt"
	"io"
	"net/http"

	"github.com/keybase/client/go/chat/s3"
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

func (r *remoteAssetReader) Read(res []byte) (n int, err error) {
	num := len(res)
	header := make(http.Header)
	header.Add("Range", fmt.Sprintf("bytes=%d-%d", offset, num))
	resp, err := r.bucket.GetResponseWithHeaders(ctx, r.asset.Path, header)
	if err != nil {
		return 0, err
	}
	defer resp.Close()
	out := bytes.NewBuffer(res)
	if err := r.decryptor(out, resp.Body); err != nil {
		return 0, err
	}
	r.offset += num
	return num, nil
}

func (r *remoteAssetReader) Seek(offset int64, whence int) (int64, error) {
	switch whence {
	case io.SeekStart:
		r.offset = offset
	case io.SeekCurrent:
		r.offset += offset
	case io.SeekEnd:

	}
	return r.offset, nil
}
