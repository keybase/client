package chat

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"time"

	"github.com/goamz/goamz/aws"
	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

type UploadS3Result struct {
	Region   string
	Endpoint string
	Bucket   string
	Path     string
	Size     int64
}

func UploadS3(log logger.Logger, r io.Reader, filename string, params chat1.S3AttachmentParams) (*UploadS3Result, error) {
	var body bytes.Buffer
	mpart := multipart.NewWriter(&body)

	// the order of these is important:
	if err := mpart.WriteField("key", params.ObjectKey); err != nil {
		return nil, err
	}
	if err := mpart.WriteField("acl", params.Acl); err != nil {
		return nil, err
	}
	if err := mpart.WriteField("X-Amz-Credential", params.Credential); err != nil {
		return nil, err
	}
	if err := mpart.WriteField("X-Amz-Algorithm", params.Algorithm); err != nil {
		return nil, err
	}
	if err := mpart.WriteField("X-Amz-Date", params.Date); err != nil {
		return nil, err
	}
	if err := mpart.WriteField("Policy", params.Policy); err != nil {
		return nil, err
	}
	if err := mpart.WriteField("X-Amz-Signature", params.Signature); err != nil {
		return nil, err
	}
	part, err := mpart.CreateFormFile("file", filepath.Base(filename))
	if err != nil {
		return nil, err
	}

	n, err := io.Copy(part, r)
	if err != nil {
		return nil, err
	}
	log.Debug("copied %d bytes to multipart", n)

	if err := mpart.Close(); err != nil {
		return nil, err
	}

	// XXX retry
	resp, err := http.Post(params.Endpoint, mpart.FormDataContentType(), &body)
	if err != nil {
		return nil, err
	}
	log.Debug("s3 post response: %+v", resp)
	bstr, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()
	log.Debug("s3 post response body:  %s", bstr)

	// XXX check response
	res := UploadS3Result{
		Bucket: params.Bucket,
		Path:   params.ObjectKey,
		Size:   int64(n),
	}

	return &res, nil
}

func PutS3(ctx context.Context, log logger.Logger, r io.Reader, size int64, params chat1.S3Params, signer s3.Signer) (*UploadS3Result, error) {
	region := aws.Region{
		Name:             params.RegionName,
		S3Endpoint:       params.RegionEndpoint,
		S3BucketEndpoint: params.RegionBucketEndpoint,
	}
	conn := s3.New(signer, region)
	conn.AccessKey = params.AccessKey

	b := conn.Bucket(params.Bucket)

	if size <= 5*1024*1024 {
		if err := putSingle(log, r, size, params, b); err != nil {
			return nil, err
		}
	} else {
		if err := putMultiPipeline(ctx, log, r, size, params, b); err != nil {
			return nil, err
		}
	}

	res := UploadS3Result{
		Region:   params.RegionName,
		Endpoint: params.RegionEndpoint,
		Bucket:   params.Bucket,
		Path:     params.ObjectKey,
		Size:     size,
	}

	return &res, nil
}

func putSingle(log logger.Logger, r io.Reader, size int64, params chat1.S3Params, b *s3.Bucket) error {
	log.Debug("s3 putSingle (size = %d)", size)
	return b.PutReader(params.ObjectKey, r, size, "application/octet-stream", s3.ACL(params.Acl), s3.Options{})

}

func putMulti(log logger.Logger, r io.Reader, size int64, params chat1.S3Params, b *s3.Bucket) error {
	log.Debug("s3 putMulti (size = %d)", size)
	multi, err := b.InitMulti(params.ObjectKey, "application/octet-stream", s3.ACL(params.Acl))
	if err != nil {
		log.Debug("InitMulti error: %s", err)
		return err
	}

	blockSize := 5 * 1024 * 1024
	var parts []s3.Part
	var partNumber int
	for {
		partNumber++
		block := make([]byte, 5*1024*1024)
		n, err := r.Read(block)
		if err != nil && err != io.EOF {
			return err
		}
		if n < blockSize {
			block = block[:n]
		}
		if n > 0 {
			log.Debug("start: upload part %d", partNumber)
			part, putErr := multi.PutPart(partNumber, bytes.NewReader(block))
			if putErr != nil {
				return putErr
			}
			parts = append(parts, part)
			log.Debug("finish: upload part %d", partNumber)
		}
		if err == io.EOF {
			break
		}
	}

	log.Debug("s3 putMulti all parts uploaded, completing request")

	if err = multi.Complete(parts); err != nil {
		log.Debug("multi.Complete error: %s", err)
		return err
	}
	log.Debug("s3 putMulti success, %d parts", len(parts))
	return nil
}

func putMultiPipeline(ctx context.Context, log logger.Logger, r io.Reader, size int64, params chat1.S3Params, b *s3.Bucket) error {
	log.Debug("s3 putMultiPipeline (size = %d)", size)
	multi, err := b.InitMulti(params.ObjectKey, "application/octet-stream", s3.ACL(params.Acl))
	if err != nil {
		log.Debug("InitMulti error: %s", err)
		return err
	}

	const blockSize = 5 * 1024 * 1024

	type job struct {
		block []byte
		index int
	}
	eg, ctx := errgroup.WithContext(ctx)
	blockCh := make(chan job)
	retCh := make(chan s3.Part)
	eg.Go(func() error {
		defer close(blockCh)
		var partNumber int
		for {
			partNumber++
			block := make([]byte, 5*1024*1024)
			n, err := r.Read(block)
			if err != nil && err != io.EOF {
				return err
			}
			if n < blockSize {
				block = block[:n]
			}
			if n > 0 {
				select {
				case blockCh <- job{block: block, index: partNumber}:
				case <-ctx.Done():
					return ctx.Err()
				}
			}
			if err == io.EOF {
				break
			}
		}
		return nil
	})
	for i := 0; i < 10; i++ {
		eg.Go(func() error {
			for b := range blockCh {
				log.Debug("start: upload part %d", b.index)
				// part, putErr := multi.PutPart(b.index, bytes.NewReader(b.block))
				part, putErr := putRetry(ctx, log, multi, b.index, b.block)
				if putErr != nil {
					return putErr
				}
				select {
				case retCh <- part:
				case <-ctx.Done():
					return ctx.Err()
				}
				log.Debug("finish: upload part %d", b.index)
			}
			return nil
		})
	}

	go func() {
		eg.Wait()
		close(retCh)
	}()

	var parts []s3.Part
	for p := range retCh {
		parts = append(parts, p)
	}
	if err := eg.Wait(); err != nil {
		return err
	}

	log.Debug("s3 putMulti all parts uploaded, completing request")

	if err = multi.Complete(parts); err != nil {
		log.Debug("multi.Complete error: %s", err)
		return err
	}
	log.Debug("s3 putMulti success, %d parts", len(parts))
	return nil
}

func putRetry(ctx context.Context, log logger.Logger, multi *s3.Multi, partNumber int, block []byte) (s3.Part, error) {
	var lastErr error
	for i := 0; i < 10; i++ {
		select {
		case <-ctx.Done():
			return s3.Part{}, ctx.Err()
		case <-time.After(BackoffDefault.Duration(i)):
		}
		log.Debug("attempt %d to upload part %d", i+1, partNumber)
		part, putErr := multi.PutPart(partNumber, bytes.NewReader(block))
		if putErr == nil {
			log.Debug("success in attempt %d to upload part %d", i+1, partNumber)
			return part, nil
		}
		log.Debug("error in attempt %d to upload part %d: %s", putErr)
		lastErr = putErr
	}
	return s3.Part{}, fmt.Errorf("failed to put part %d (last error: %s)", partNumber, lastErr)
}

func DownloadAsset(ctx context.Context, log logger.Logger, params chat1.S3Params, asset chat1.Asset, w io.Writer, signer s3.Signer) error {
	region := aws.Region{
		Name:       asset.Region,
		S3Endpoint: asset.Endpoint,
	}
	conn := s3.New(signer, region)
	conn.AccessKey = params.AccessKey

	b := conn.Bucket(asset.Bucket)

	body, err := b.GetReader(asset.Path)
	defer func() {
		if body != nil {
			body.Close()
		}
	}()
	if err != nil {
		return err
	}

	n, err := io.Copy(w, body)
	if err != nil {
		return err
	}

	log.Debug("downloaded %d bytes", n)

	return nil
}
