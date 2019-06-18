package attachments

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"sync"

	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/sync/errgroup"
)

const s3PipelineMaxWidth = 10

type s3UploadPipeliner struct {
	sync.Mutex
	width   int
	waiters []chan struct{}
}

func (s *s3UploadPipeliner) QueueForTakeoff(ctx context.Context) error {
	s.Lock()
	if s.width >= s3PipelineMaxWidth {
		ch := make(chan struct{})
		s.waiters = append(s.waiters, ch)
		s.Unlock()
		select {
		case <-ch:
		case <-ctx.Done():
			return ctx.Err()
		}
		s.Lock()
		s.width++
		s.Unlock()
		return nil
	}
	s.width++
	s.Unlock()
	return nil
}

func (s *s3UploadPipeliner) Complete() {
	s.Lock()
	defer s.Unlock()
	if len(s.waiters) > 0 {
		close(s.waiters[0])
		if len(s.waiters) > 1 {
			s.waiters = s.waiters[1:]
		} else {
			s.waiters = nil
		}
	}
	if s.width > 0 {
		s.width--
	}
}

var s3UploadPipeline = &s3UploadPipeliner{}

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
func (a *S3Store) PutS3(ctx context.Context, r io.Reader, size int64, task *UploadTask, previous *AttachmentInfo) (res *PutS3Result, err error) {
	defer a.Trace(ctx, func() error { return err }, "PutS3")()
	region := a.regionFromParams(task.S3Params)
	b := a.s3Conn(task.S3Signer, region, task.S3Params.AccessKey).Bucket(task.S3Params.Bucket)

	multiPartUpload := size > minMultiSize
	if multiPartUpload && a.G().Env.GetAttachmentDisableMulti() {
		a.Debug(ctx, "PutS3: multi part upload manually disabled, overriding for size: %v", size)
		multiPartUpload = false
	}

	if !multiPartUpload {
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

	s3res := PutS3Result{
		Region:   task.S3Params.RegionName,
		Endpoint: task.S3Params.RegionEndpoint,
		Bucket:   task.S3Params.Bucket,
		Path:     task.S3Params.ObjectKey,
		Size:     size,
	}
	return &s3res, nil
}

// putSingle uploads data in r to S3 with the Put API.  It has to be
// used for anything less than 5MB.  It can be used for anything up
// to 5GB, but putMultiPipeline best for anything over 5MB.
func (a *S3Store) putSingle(ctx context.Context, r io.Reader, size int64, params chat1.S3Params,
	b s3.BucketInt, progress types.ProgressReporter) (err error) {
	defer a.Trace(ctx, func() error { return err }, fmt.Sprintf("putSingle(size=%d)", size))()

	progWriter := newProgressWriter(progress, size)
	tee := io.TeeReader(r, progWriter)

	if err := b.PutReader(ctx, params.ObjectKey, tee, size, "application/octet-stream", s3.ACL(params.Acl),
		s3.Options{}); err != nil {
		a.Debug(ctx, "putSingle: failed: %s", err)
		return NewErrorWrapper("failed putSingle", err)
	}
	progWriter.Finish()
	return nil
}

// putMultiPipeline uploads data in r to S3 using the Multi API.  It uses a
// pipeline to upload 10 blocks of data concurrently.
// Each block is 5MB. It returns the object key if no errors.  putMultiPipeline
// will return a different object key from params.ObjectKey if a previous Put is
// successfully resumed and completed.
func (a *S3Store) putMultiPipeline(ctx context.Context, r io.Reader, size int64, task *UploadTask, b s3.BucketInt, previous *AttachmentInfo) (res string, err error) {
	defer a.Trace(ctx, func() error { return err }, fmt.Sprintf("putMultiPipeline(size=%d)", size))()

	var multi s3.MultiInt
	if previous != nil {
		a.Debug(ctx, "putMultiPipeline: previous exists. Changing object key from %q to %q",
			task.S3Params.ObjectKey, previous.ObjectKey)
		task.S3Params.ObjectKey = previous.ObjectKey
	}

	multi, err = b.Multi(ctx, task.S3Params.ObjectKey, "application/octet-stream", s3.ACL(task.S3Params.Acl))
	if err != nil {
		a.Debug(ctx, "putMultiPipeline: b.Multi error: %s", err.Error())
		return "", NewErrorWrapper("s3 Multi error", err)
	}

	var previousParts map[int]s3.Part
	if previous != nil {
		previousParts = make(map[int]s3.Part)
		list, err := multi.ListParts(ctx)
		if err != nil {
			a.Debug(ctx, "putMultiPipeline: ignoring multi.ListParts error: %s", err)
			// dump previous since we can't check it anymore
			previous = nil
		} else {
			for _, p := range list {
				previousParts[p.N] = p
			}
		}
	}

	// need to use ectx in everything in eg.Go() funcs since eg
	// will cancel ectx in eg.Wait().
	a.Debug(ctx, "putMultiPipeline: beginning parts uploader process")
	eg, ectx := errgroup.WithContext(ctx)
	blockCh := make(chan job)
	retCh := make(chan s3.Part)
	eg.Go(func() error {
		defer close(blockCh)
		return a.makeBlockJobs(ectx, r, blockCh, task.stashKey(), previous)
	})
	eg.Go(func() error {
		for lb := range blockCh {
			if err := s3UploadPipeline.QueueForTakeoff(ectx); err != nil {
				return err
			}
			b := lb
			eg.Go(func() error {
				defer s3UploadPipeline.Complete()
				if err := a.uploadPart(ectx, task, b, previous, previousParts, multi, retCh); err != nil {
					return err
				}
				return nil
			})
		}
		return nil
	})
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
	a.Debug(ctx, "putMultiPipeline: all parts uploaded, completing request")
	if err := multi.Complete(ctx, parts); err != nil {
		a.Debug(ctx, "putMultiPipeline: Complete() failed: %s", err)
		return "", err
	}
	a.Debug(ctx, "putMultiPipeline: success, %d parts", len(parts))
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
func (a *S3Store) makeBlockJobs(ctx context.Context, r io.Reader, blockCh chan job, stashKey StashKey, previous *AttachmentInfo) error {
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
					a.Debug(ctx, "makeBlockJobs: part %d failed local part record verification", partNumber)
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
			a.Debug(ctx, "makeBlockJobs: hit blockLimit of %d", a.blockLimit)
			break
		}
	}
	return nil
}

// addJob creates a job and puts it on blockCh, unless the blockCh isn't ready and the context has been canceled.
func (a *S3Store) addJob(ctx context.Context, blockCh chan job, block []byte, partNumber int, hash string) error {
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
func (a *S3Store) uploadPart(ctx context.Context, task *UploadTask, b job, previous *AttachmentInfo, previousParts map[int]s3.Part, multi s3.MultiInt, retCh chan s3.Part) (err error) {
	defer a.Trace(ctx, func() error { return err }, fmt.Sprintf("uploadPart(%d)", b.index))()

	// check to see if this part has already been uploaded.
	// for job `b` to be here, it has already passed local stash verification.
	if previous != nil {
		// check s3 previousParts for this block
		p, ok := previousParts[b.index]
		if ok && int(p.Size) == len(b.block) && p.ETag == b.etag() {
			a.Debug(ctx, "uploadPart: part %d already uploaded to s3", b.index)

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
			a.Debug(ctx, "uploadPart: part %d s3 mismatch:  size %d != expected %d or etag %s != expected %s",
				b.index, p.Size, len(b.block), p.ETag, b.etag())
			return ErrAbortOnPartMismatch
		}

		// this part doesn't exist on s3, so it needs to be uploaded
		a.Debug(ctx, "uploadPart: part %d not uploaded to s3 by previous upload attempt", b.index)
	}

	// stash part info locally before attempting S3 put
	// doing this before attempting the S3 put is important
	// for security concerns.
	if err := a.stash.RecordPart(task.stashKey(), b.index, b.hash); err != nil {
		a.Debug(ctx, "uploadPart: StashRecordPart error: %s", err)
	}

	part, putErr := multi.PutPart(ctx, b.index, bytes.NewReader(b.block))
	if putErr != nil {
		return NewErrorWrapper(fmt.Sprintf("failed to put part %d", b.index), putErr)
	}

	// put the successfully uploaded part information in the retCh
	// unless the context has been canceled.
	select {
	case retCh <- part:
	case <-ctx.Done():
		a.Debug(ctx, "uploadPart: upload part %d, context canceled", b.index)
		return ctx.Err()
	}

	return nil
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

type S3Signer struct {
	ri func() chat1.RemoteInterface
}

func NewS3Signer(ri func() chat1.RemoteInterface) *S3Signer {
	return &S3Signer{
		ri: ri,
	}
}

// Sign implements github.com/keybase/go/chat/s3.Signer interface.
func (s *S3Signer) Sign(payload []byte) ([]byte, error) {
	arg := chat1.S3SignArg{
		Payload: payload,
		Version: 1,
	}
	return s.ri().S3Sign(context.Background(), arg)
}
