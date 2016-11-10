package chat

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"io"
	"time"

	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
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
func PutS3(ctx context.Context, log logger.Logger, r io.Reader, size int64, task *UploadTask, previous *AttachmentInfo) (*PutS3Result, error) {
	region := s3.Region{
		Name:             task.S3Params.RegionName,
		S3Endpoint:       task.S3Params.RegionEndpoint,
		S3BucketEndpoint: task.S3Params.RegionBucketEndpoint,
	}
	conn := s3.New(task.S3Signer, region)
	conn.AccessKey = task.S3Params.AccessKey

	b := conn.Bucket(task.S3Params.Bucket)

	if size <= minMultiSize {
		if err := putSingle(ctx, log, r, size, task.S3Params, b, task.Progress); err != nil {
			return nil, err
		}
	} else {
		objectKey, err := putMultiPipeline(ctx, log, r, size, task, b, previous)
		if err != nil {
			return nil, err
		}
		task.S3Params.ObjectKey = objectKey
	}

	res := PutS3Result{
		Region:   task.S3Params.RegionName,
		Endpoint: task.S3Params.RegionEndpoint,
		Bucket:   task.S3Params.Bucket,
		Path:     task.S3Params.ObjectKey,
		Size:     size,
	}

	return &res, nil
}

// putSingle uploads data in r to S3 with the Put API.  It has to be
// used for anything less than 5MB.  It can be used for anything up
// to 5GB, but putMultiPipeline best for anything over 5MB.
func putSingle(ctx context.Context, log logger.Logger, r io.Reader, size int64, params chat1.S3Params, b *s3.Bucket, progress ProgressReporter) error {
	log.Debug("s3 putSingle (size = %d)", size)

	// In order to be able to retry the upload, need to read in the entire
	// attachment.  But putSingle is only called for attachments <= 5MB, so
	// this isn't horrible.
	buf := make([]byte, size)
	n, err := io.ReadFull(r, buf)
	if err != nil {
		return err
	}
	if int64(n) != size {
		return fmt.Errorf("invalid read attachment size: %d (expected %d)", n, size)
	}
	sr := bytes.NewReader(buf)

	progWriter := newProgressWriter(progress, int(size))
	tee := io.TeeReader(sr, progWriter)

	var lastErr error
	for i := 0; i < 10; i++ {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(libkb.BackoffDefault.Duration(i)):
		}
		log.Debug("s3 putSingle attempt %d", i+1)
		err := b.PutReader(params.ObjectKey, tee, size, "application/octet-stream", s3.ACL(params.Acl), s3.Options{})
		if err == nil {
			log.Debug("putSingle attempt %d success", i+1)
			return nil
		}
		log.Debug("putSingle attempt %d error: %s", i+1, err)
		lastErr = err

		// move back to beginning of sr buffer for retry
		sr.Seek(0, io.SeekStart)
		progWriter = newProgressWriter(progress, int(size))
		tee = io.TeeReader(sr, progWriter)
	}
	return fmt.Errorf("failed putSingle (last error: %s)", lastErr)
}

// putMultiPipeline uploads data in r to S3 using the Multi API.  It uses a
// pipeline to upload 10 blocks of data concurrently.  Each block is 5MB.
// It returns the object key if no errors.  putMultiPipeline will return
// a different object key from params.ObjectKey if a previous Put is
// successfully resumed and completed.
func putMultiPipeline(ctx context.Context, log logger.Logger, r io.Reader, size int64, task *UploadTask, b *s3.Bucket, previous *AttachmentInfo) (string, error) {
	log.Debug("s3 putMultiPipeline (size = %d)", size)

	if previous != nil {
		log.Debug("put multi, changing object key to %s", previous.ObjectKey)
		task.S3Params.ObjectKey = previous.ObjectKey
	}

	multi, err := b.Multi(task.S3Params.ObjectKey, "application/octet-stream", s3.ACL(task.S3Params.Acl))
	if err != nil {
		log.Debug("Multi error: %s", err)
		return "", err
	}

	var previousParts []s3.Part
	if previous != nil {
		previousParts, err = multi.ListParts()
		if err != nil {
			log.Debug("ignoring multi.ListParts error: %s", err)
		}
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
			// must call io.ReadFull to ensure full block read
			n, err := io.ReadFull(r, block)
			// io.ErrUnexpectedEOF will be returned for last partial block,
			// which is ok.
			if err != nil && err != io.ErrUnexpectedEOF && err != io.EOF {
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
			if err == io.EOF || err == io.ErrUnexpectedEOF {
				break
			}
		}
		return nil
	})
	for i := 0; i < 10; i++ {
		eg.Go(func() error {
			for b := range blockCh {
				log.Debug("start: upload part %d", b.index)
				md5sum := md5.Sum(b.block)
				md5hex := hex.EncodeToString(md5sum[:])
				if previous != nil && len(previousParts) > b.index {
					// check s3 previousParts for this block
					p := previousParts[b.index-1] // part list starts at index 1
					if int(p.Size) == len(b.block) && p.ETag == `"`+md5hex+`"` {
						log.Debug("part %d already uploaded to s3", b.index)
						// check our own previous record for this part
						ok, err := StashVerifyPart(task.PlaintextHash, task.ConversationID, b.index, md5hex)
						if err != nil {
							log.Debug("StashVerifyPart error: %s", err)
						} else if ok {
							log.Debug("part %d matched local upload record", b.index)
							select {
							case retCh <- p:
							case <-ctx.Done():
								return ctx.Err()
							}
							continue
						} else {
							log.Debug("part %d failed local part record verification", b.index)
							// XXX abort this upload
						}
					} else {
						log.Debug("part %d s3 mismatch:  size %d != expected %d or etag %s != expected %s", b.index, p.Size, len(b.block), p.ETag, md5hex)
						// XXX abort this upload
					}
				}
				part, putErr := putRetry(ctx, log, multi, b.index, b.block)
				if putErr != nil {
					return putErr
				}
				select {
				case retCh <- part:
				case <-ctx.Done():
					return ctx.Err()
				}

				if err := StashRecordPart(task.PlaintextHash, task.ConversationID, b.index, md5hex); err != nil {
					log.Debug("StashRecordPart error: %s", err)
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

	var complete int64
	var parts []s3.Part
	for p := range retCh {
		parts = append(parts, p)
		complete += p.Size
		if task.Progress != nil {
			task.Progress(int(complete), int(size))
		}
	}
	if err := eg.Wait(); err != nil {
		return "", err
	}

	log.Debug("s3 putMulti all parts uploaded, completing request")

	if err = multi.Complete(parts); err != nil {
		log.Debug("multi.Complete error: %s", err)
		return "", err
	}
	log.Debug("s3 putMulti success, %d parts", len(parts))

	return task.S3Params.ObjectKey, nil
}

// putRetry sends a block to S3, retrying 10 times w/ backoff.
func putRetry(ctx context.Context, log logger.Logger, multi *s3.Multi, partNumber int, block []byte) (s3.Part, error) {
	var lastErr error
	for i := 0; i < 10; i++ {
		select {
		case <-ctx.Done():
			return s3.Part{}, ctx.Err()
		case <-time.After(libkb.BackoffDefault.Duration(i)):
		}
		log.Debug("attempt %d to upload part %d", i+1, partNumber)
		part, putErr := multi.PutPart(partNumber, bytes.NewReader(block))
		if putErr == nil {
			log.Debug("success in attempt %d to upload part %d", i+1, partNumber)
			log.Debug("part: %+v", part)
			return part, nil
		}
		log.Debug("error in attempt %d to upload part %d: %s", i+1, putErr)
		lastErr = putErr
	}
	return s3.Part{}, fmt.Errorf("failed to put part %d (last error: %s)", partNumber, lastErr)
}
