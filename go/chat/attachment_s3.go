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

// ErrAbortOnPartMismatch is returned when there is a mismatch between a current
// part and a previous attempt part.  If ErrAbortOnPartMismatch is returned,
// the caller should abort the upload attempt and start from scratch.
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

	progWriter := newProgressWriter(progress, size)
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
			progWriter.Finish()
			return nil
		}
		a.log.Debug("putSingle attempt %d error: %s", i+1, err)
		lastErr = err

		// move back to beginning of sr buffer for retry
		sr.Seek(0, io.SeekStart)
		progWriter = newProgressWriter(progress, size)
		tee = io.TeeReader(sr, progWriter)
	}
	return NewErrorWrapper("failed putSingle, last error", lastErr)
}

// putMultiPipeline uploads data in r to S3 using the Multi API.  It uses a
// pipeline to upload 10 blocks of data concurrently.
// Each block is 5MB. It returns the object key if no errors.  putMultiPipeline
// will return a different object key from params.ObjectKey if a previous Put is
// successfully resumed and completed.
func (a *AttachmentStore) putMultiPipeline(ctx context.Context, r io.Reader, size int64, task *UploadTask, b s3.BucketInt, previous *AttachmentInfo) (string, error) {
	a.log.Debug("s3 putMultiPipeline (size = %d)", size)

	var multi s3.MultiInt

	if previous != nil {
		a.log.Debug("put multi, previous exists. Changing object key from %q to %q", task.S3Params.ObjectKey, previous.ObjectKey)
		task.S3Params.ObjectKey = previous.ObjectKey
	}

	multi, err := b.Multi(ctx, task.S3Params.ObjectKey, "application/octet-stream", s3.ACL(task.S3Params.Acl))
	if err != nil {
		a.log.Debug("putMultiPipeline b.Multi error: %s", err)
		return "", NewErrorWrapper("s3 Multi error", err)
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
		return a.makeBlockJobs(ectx, r, blockCh, task.stashKey(), previous)
	})
	for i := 0; i < 10; i++ {
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

	var parts []s3.Part
	progWriter := newProgressWriter(task.Progress, size)
	for p := range retCh {
		parts = append(parts, p)
		progWriter.Update(int(p.Size))
	}
	if err := eg.Wait(); err != nil {
		return "", err
	}

	if a.blockLimit > 0 {
		return "", errors.New("block limit hit, not completing multi upload")
	}

	a.log.Debug("s3 putMulti all parts uploaded, completing request")

	if err := multi.Complete(ctx, parts); err != nil {
		a.log.Debug("multi.Complete error: %s", err)
		return "", err
	}
	a.log.Debug("s3 putMulti success, %d parts", len(parts))
	// Just to make sure the UI gets the 100% call
	progWriter.Finish()

	return task.S3Params.ObjectKey, nil
}

type job struct {
	block []byte
	index int
	hash  string
}

func (j job) etag() string {
	return `"` + j.hash + `"`
}

// makeBlockJobs reads ciphertext chunks from r and creates jobs that it puts onto blockCh.
// If this is a resumed upload, it verifies the blocks against the local stash before
// creating jobs.
func (a *AttachmentStore) makeBlockJobs(ctx context.Context, r io.Reader, blockCh chan job, stashKey StashKey, previous *AttachmentInfo) error {
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
			md5sum := md5.Sum(block)
			md5hex := hex.EncodeToString(md5sum[:])

			if previous != nil {
				// resuming an upload, so check local stash record
				// and abort on mismatch before adding a job for this block
				// because if we don't it amounts to nonce reuse
				lhash, found := previous.Parts[partNumber]
				if found && lhash != md5hex {
					a.log.Debug("part %d failed local part record verification", partNumber)
					return ErrAbortOnPartMismatch
				}
			}

			if err := a.addJob(ctx, blockCh, block, partNumber, md5hex); err != nil {
				return err
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

// addJob creates a job and puts it on blockCh, unless the blockCh isn't ready and the context has been canceled.
func (a *AttachmentStore) addJob(ctx context.Context, blockCh chan job, block []byte, partNumber int, hash string) error {
	// Create a job, unless the context has been canceled.
	select {
	case blockCh <- job{block: block, index: partNumber, hash: hash}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// uploadPart handles uploading a job to S3.  The job `b` has already passed local stash verification.
// If this is a resumed upload, it checks the previous parts reported by S3 and will skip uploading
// any that already exist.
func (a *AttachmentStore) uploadPart(ctx context.Context, task *UploadTask, b job, previous *AttachmentInfo, previousParts map[int]s3.Part, multi s3.MultiInt, retCh chan s3.Part) error {
	a.log.Debug("start: upload part %d", b.index)

	// check to see if this part has already been uploaded.
	// for job `b` to be here, it has already passed local stash verification.
	if previous != nil {
		// check s3 previousParts for this block
		p, ok := previousParts[b.index]
		if ok && int(p.Size) == len(b.block) && p.ETag == b.etag() {
			a.log.Debug("part %d already uploaded to s3", b.index)

			// part already uploaded, so put it in the retCh unless the context
			// has been canceled
			select {
			case retCh <- p:
			case <-ctx.Done():
				return ctx.Err()
			}

			// nothing else to do
			return nil
		}

		if p.Size > 0 {
			// only abort if the part size from s3 is > 0.
			a.log.Debug("part %d s3 mismatch:  size %d != expected %d or etag %s != expected %s", b.index, p.Size, len(b.block), p.ETag, b.etag())
			return ErrAbortOnPartMismatch
		}

		// this part doesn't exist on s3, so it needs to be uploaded
		a.log.Debug("part %d not uploaded to s3 by previous upload attempt", b.index)
	}

	// stash part info locally before attempting S3 put
	// doing this before attempting the S3 put is important
	// for security concerns.
	if err := a.stash.RecordPart(task.stashKey(), b.index, b.hash); err != nil {
		a.log.Debug("StashRecordPart error: %s", err)
	}

	part, putErr := a.putRetry(ctx, multi, b.index, b.block)
	if putErr != nil {
		return putErr
	}

	// put the successfully uploaded part information in the retCh
	// unless the context has been canceled.
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
	return s3.Part{}, NewErrorWrapper(fmt.Sprintf("failed to put part %d", partNumber), lastErr)
}

type ErrorWrapper struct {
	prefix string
	err    error
}

func NewErrorWrapper(prefix string, err error) *ErrorWrapper {
	return &ErrorWrapper{prefix: prefix, err: err}
}

func (e *ErrorWrapper) Error() string {
	return fmt.Sprintf("%s: %s (%T)", e.prefix, e.err, e.err)
}

func (e *ErrorWrapper) Details() string {
	switch err := e.err.(type) {
	case *s3.Error:
		return fmt.Sprintf("%s: error %q, status code: %d, code: %s, message: %s, bucket: %s", e.prefix, e.err, err.StatusCode, err.Code, err.Message, err.BucketName)
	default:
		return fmt.Sprintf("%s: error %q, no details for type %T", e.prefix, e.err, e.err)
	}
}
