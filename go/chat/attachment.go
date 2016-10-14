package chat

import (
	"bytes"
	"fmt"
	"io"
	"time"

	"github.com/goamz/goamz/aws"
	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

const minMultiSize = 5 * 1024 * 1024 // can't use Multi API with parts less than 5MB
const blockSize = 5 * 1024 * 1024    // 5MB is the minimum Multi part size

// PutS3Result is the success result of calling PutS3.
type PutS3Result struct {
	Region   string
	Endpoint string
	Bucket   string
	Path     string
	Size     int64
}

// PutS3 uploads the data in Reader r to S3.  It chooses whether to use
// putSingle or putMultiPipeline based on the size of the object.
func PutS3(ctx context.Context, log logger.Logger, r io.Reader, size int64, params chat1.S3Params, signer s3.Signer) (*PutS3Result, error) {
	region := aws.Region{
		Name:             params.RegionName,
		S3Endpoint:       params.RegionEndpoint,
		S3BucketEndpoint: params.RegionBucketEndpoint,
	}
	conn := s3.New(signer, region)
	conn.AccessKey = params.AccessKey

	b := conn.Bucket(params.Bucket)

	if size <= minMultiSize {
		if err := putSingle(ctx, log, r, size, params, b); err != nil {
			return nil, err
		}
	} else {
		if err := putMultiPipeline(ctx, log, r, size, params, b); err != nil {
			return nil, err
		}
	}

	res := PutS3Result{
		Region:   params.RegionName,
		Endpoint: params.RegionEndpoint,
		Bucket:   params.Bucket,
		Path:     params.ObjectKey,
		Size:     size,
	}

	return &res, nil
}

// DownloadAsset gets an object from S3 as described in asset.
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

// putSingle uploads data in r to S3 with the Put API.  It has to be
// used for anything less than 5MB.  It can be used for anything up
// to 5GB, but putMultiPipeline best for anything over 5MB.
func putSingle(ctx context.Context, log logger.Logger, r io.Reader, size int64, params chat1.S3Params, b *s3.Bucket) error {
	log.Debug("s3 putSingle (size = %d)", size)

	var lastErr error
	for i := 0; i < 10; i++ {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(BackoffDefault.Duration(i)):
		}
		log.Debug("s3 putSingle attempt %d", i+1)
		err := b.PutReader(params.ObjectKey, r, size, "application/octet-stream", s3.ACL(params.Acl), s3.Options{})
		if err == nil {
			log.Debug("putSingle attempt %d success", i+1)
			return nil
		}
		log.Debug("putSingle attempt %d error: %s", i+1, err)
		lastErr = err
	}
	return fmt.Errorf("failed putSingle (last error: %s)", lastErr)
}

// putMultiPipeline uploads data in r to S3 using the Multi API.  It uses a
// pipeline to upload 10 blocks of data concurrently.  Each block is 5MB.
func putMultiPipeline(ctx context.Context, log logger.Logger, r io.Reader, size int64, params chat1.S3Params, b *s3.Bucket) error {
	log.Debug("s3 putMultiPipeline (size = %d)", size)
	multi, err := b.InitMulti(params.ObjectKey, "application/octet-stream", s3.ACL(params.Acl))
	if err != nil {
		log.Debug("InitMulti error: %s", err)
		return err
	}

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
			block := make([]byte, blockSize)
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

// putRetry sends a block to S3, retrying 10 times w/ backoff.
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
		log.Debug("error in attempt %d to upload part %d: %s", i+1, putErr)
		lastErr = putErr
	}
	return s3.Part{}, fmt.Errorf("failed to put part %d (last error: %s)", partNumber, lastErr)
}
