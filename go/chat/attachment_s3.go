package chat

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/sync/errgroup"
)

const minMultiSize = 5 * 1024 * 1024 // can't use Multi API with parts less than 5MB
const blockSize = 5 * 1024 * 1024    // 5MB is the minimum Multi part size

var ErrAbortOnPartMismatch = errors.New("local part mismatch, aborting upload")

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
func (a *AttachmentStore) PutS3(ctx context.Context, r io.Reader, size int64, task *UploadTask, previous *AttachmentInfo) (*PutS3Result, error) {
	region := a.regionFromParams(task.S3Params)
	b := a.s3Conn(task.S3Signer, region, task.S3Params.AccessKey).Bucket(task.S3Params.Bucket)

	if size <= minMultiSize {
		if err := a.putSingle(ctx, r, size, task.S3Params, b, task.Progress); err != nil {
			return nil, err
		}
	} else {
		objectKey, err := a.putMultiPipeline(ctx, r, size, task, b, previous)
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
func (a *AttachmentStore) putSingle(ctx context.Context, r io.Reader, size int64, params chat1.S3Params, b s3.BucketInt, progress ProgressReporter) error {
	a.log.Debug("s3 putSingle (size = %d)", size)

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
		a.log.Debug("s3 putSingle attempt %d", i+1)
		err := b.PutReader(ctx, params.ObjectKey, tee, size, "application/octet-stream", s3.ACL(params.Acl), s3.Options{})
		if err == nil {
			a.log.Debug("putSingle attempt %d success", i+1)
			return nil
		}
		a.log.Debug("putSingle attempt %d error: %s", i+1, err)
		lastErr = err

		// move back to beginning of sr buffer for retry
		sr.Seek(0, io.SeekStart)
		progWriter = newProgressWriter(progress, int(size))
		tee = io.TeeReader(sr, progWriter)
	}
	return fmt.Errorf("failed putSingle (last error: %s)", lastErr)
}

// putMultiPipeline uploads data in r to S3 using the Multi API.  It uses a
// pipeline to upload pipelineSize (default 10) blocks of data concurrently.
// Each block is 5MB. It returns the object key if no errors.  putMultiPipeline
// will return a different object key from params.ObjectKey if a previous Put is
// successfully resumed and completed.
func (a *AttachmentStore) putMultiPipeline(ctx context.Context, r io.Reader, size int64, task *UploadTask, b s3.BucketInt, previous *AttachmentInfo) (string, error) {
	a.log.Debug("s3 putMultiPipeline (size = %d)", size)

	if previous != nil {
		a.log.Debug("put multi, changing object key to %s", previous.ObjectKey)
		task.S3Params.ObjectKey = previous.ObjectKey
	}

	multi, err := b.Multi(ctx, task.S3Params.ObjectKey, "application/octet-stream", s3.ACL(task.S3Params.Acl))
	if err != nil {
		return "", fmt.Errorf("s3 Multi error: %s", err)
	}

	var previousParts map[int]s3.Part
	if previous != nil {
		previousParts = make(map[int]s3.Part)
		list, err := multi.ListParts(ctx)
		if err != nil {
			a.log.Debug("ignoring multi.ListParts error: %s", err)
		} else {
			for _, p := range list {
				previousParts[p.N] = p
			}
		}
	}

	// need to use ectx in everything in eg.Go() funcs since eg
	// will cancel ectx in eg.Wait().
	eg, ectx := errgroup.WithContext(ctx)
	blockCh := make(chan job)
	retCh := make(chan s3.Part)
	eg.Go(func() error {
		defer close(blockCh)
		return a.makeBlockJobs(ectx, r, blockCh)
	})
	for i := 0; i < a.pipelineSize; i++ {
		eg.Go(func() error {
			for b := range blockCh {
				if err := a.uploadPart(ectx, task, b, previous, previousParts, multi, retCh); err != nil {
					return err
				}
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

	if a.blockLimit > 0 {
		return "", errors.New("block limit hit, not completing multi upload")
	}

	a.log.Debug("s3 putMulti all parts uploaded, completing request")

	if err = multi.Complete(ctx, parts); err != nil {
		a.log.Debug("multi.Complete error: %s", err)
		return "", err
	}
	a.log.Debug("s3 putMulti success, %d parts", len(parts))

	return task.S3Params.ObjectKey, nil
}

type job struct {
	block []byte
	index int
}

func (a *AttachmentStore) makeBlockJobs(ctx context.Context, r io.Reader, blockCh chan job) error {
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
			// if block is not empty, create a job for it and put it in
			// blockCh.  Or, if the context has been canceled, then
			// stop this loop and return from this function.
			select {
			case blockCh <- job{block: block, index: partNumber}:
			case <-ctx.Done():
				return ctx.Err()
			}
		}
		if err == io.EOF || err == io.ErrUnexpectedEOF {
			break
		}

		if a.blockLimit > 0 && partNumber >= a.blockLimit {
			a.log.Debug("hit blockLimit of %d", a.blockLimit)
			break
		}
	}
	return nil

}

func (a *AttachmentStore) uploadPart(ctx context.Context, task *UploadTask, b job, previous *AttachmentInfo, previousParts map[int]s3.Part, multi s3.MultiInt, retCh chan s3.Part) error {
	a.log.Debug("start: upload part %d", b.index)
	md5sum := md5.Sum(b.block)
	md5hex := hex.EncodeToString(md5sum[:])
	if previous != nil {
		// check s3 previousParts for this block
		p, ok := previousParts[b.index]
		if ok && int(p.Size) == len(b.block) && p.ETag == `"`+md5hex+`"` {
			a.log.Debug("part %d already uploaded to s3", b.index)
			// check our own previous record for this part
			ok, err := StashVerifyPart(task.plaintextHash, task.ConversationID, b.index, md5hex)
			if err != nil {
				a.log.Debug("StashVerifyPart error: %s", err)
			} else if ok {
				a.log.Debug("part %d matched local upload record", b.index)
				select {
				case retCh <- p:
				case <-ctx.Done():
					return ctx.Err()
				}
				return nil
			} else {
				a.log.Debug("part %d failed local part record verification", b.index)
				return ErrAbortOnPartMismatch
			}
		} else if p.Size > 0 {
			// only abort if the part size from s3 is > 0
			a.log.Debug("part %d s3 mismatch:  size %d != expected %d or etag %s != expected %s", b.index, p.Size, len(b.block), p.ETag, md5hex)
			return ErrAbortOnPartMismatch
		}
	}

	// stash part info locally before attempting S3 put
	if err := StashRecordPart(task.plaintextHash, task.ConversationID, b.index, md5hex); err != nil {
		a.log.Debug("StashRecordPart error: %s", err)
	}

	part, putErr := a.putRetry(ctx, multi, b.index, b.block)
	if putErr != nil {
		return putErr
	}
	select {
	case retCh <- part:
	case <-ctx.Done():
		return ctx.Err()
	}

	a.log.Debug("finish: upload part %d", b.index)
	return nil
}

// putRetry sends a block to S3, retrying 10 times w/ backoff.
func (a *AttachmentStore) putRetry(ctx context.Context, multi s3.MultiInt, partNumber int, block []byte) (s3.Part, error) {
	var lastErr error
	for i := 0; i < 10; i++ {
		select {
		case <-ctx.Done():
			return s3.Part{}, ctx.Err()
		case <-time.After(libkb.BackoffDefault.Duration(i)):
		}
		a.log.Debug("attempt %d to upload part %d", i+1, partNumber)
		part, putErr := multi.PutPart(ctx, partNumber, bytes.NewReader(block))
		if putErr == nil {
			a.log.Debug("success in attempt %d to upload part %d", i+1, partNumber)
			return part, nil
		}
		a.log.Debug("error in attempt %d to upload part %d: %s", i+1, putErr)
		lastErr = putErr
	}
	return s3.Part{}, fmt.Errorf("failed to put part %d (last error: %s)", partNumber, lastErr)
}
