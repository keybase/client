package attachments

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"sync"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

type uploaderTask struct {
	UID             gregor1.UID
	OutboxID        chat1.OutboxID
	ConvID          chat1.ConversationID
	Title, Filename string
	Metadata        []byte
	CallerPreview   *chat1.MakePreviewRes
}

type uploaderStatus struct {
	Status types.AttachmentUploaderTaskStatus
	Result types.AttachmentUploadResult
}

type Uploader struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	store    Store
	ri       func() chat1.RemoteInterface
	s3signer s3.Signer
	uploads  map[string]chan types.AttachmentUploadResult

	// testing
	tempDir string
}

var _ types.AttachmentUploader = (*Uploader)(nil)

func NewUploader(g *globals.Context, store Store, s3signer s3.Signer, ri func() chat1.RemoteInterface) *Uploader {
	return &Uploader{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Attachments.Uploader", false),
		store:        store,
		ri:           ri,
		s3signer:     s3signer,
		uploads:      make(map[string]chan types.AttachmentUploadResult),
	}
}

func (u *Uploader) SetPreviewTempDir(dir string) {
	u.tempDir = dir
}

func (u *Uploader) dbStatusKey(outboxID chat1.OutboxID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBAttachmentUploader,
		Key: "status:" + outboxID.String(),
	}
}

func (u *Uploader) dbTaskKey(outboxID chat1.OutboxID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBAttachmentUploader,
		Key: "task:" + outboxID.String(),
	}
}

func (u *Uploader) Complete(ctx context.Context, outboxID chat1.OutboxID) {
	defer u.Trace(ctx, func() error { return nil }, "Complete(%s)", outboxID)()
	status, err := u.getStatus(ctx, outboxID)
	if err != nil {
		u.Debug(ctx, "Complete: failed to get outboxID: %s", err)
		return
	}
	if status.Status == types.AttachmentUploaderTaskStatusUploading {
		u.Debug(ctx, "Complete: called on uploading attachment, ignoring: outboxID: %s", outboxID)
		return
	}
	if err := u.G().GetKVStore().Delete(u.dbStatusKey(outboxID)); err != nil {
		u.Debug(ctx, "Complete: failed to remove status: %s", err)
	}
	if err := u.G().GetKVStore().Delete(u.dbTaskKey(outboxID)); err != nil {
		u.Debug(ctx, "Complete: failed to remove task: %s", err)
	}
	NewPendingPreviews(u.G()).Remove(ctx, outboxID)
}

func (u *Uploader) Retry(ctx context.Context, outboxID chat1.OutboxID) (res chan types.AttachmentUploadResult, err error) {
	defer u.Trace(ctx, func() error { return err }, "Retry(%s)", outboxID)()
	ustatus, err := u.getStatus(ctx, outboxID)
	if err != nil {
		return nil, err
	}
	switch ustatus.Status {
	case types.AttachmentUploaderTaskStatusUploading, types.AttachmentUploaderTaskStatusFailed:
		task, err := u.getTask(ctx, outboxID)
		if err != nil {
			return nil, err
		}
		return u.upload(ctx, task.UID, task.ConvID, task.OutboxID, task.Title, task.Filename, task.Metadata,
			task.CallerPreview)
	case types.AttachmentUploaderTaskStatusSuccess:
		ch := make(chan types.AttachmentUploadResult, 1)
		ch <- ustatus.Result
		return ch, nil
	}
	return nil, fmt.Errorf("unknown retry status: %v", ustatus.Status)
}

func (u *Uploader) Status(ctx context.Context, outboxID chat1.OutboxID) (status types.AttachmentUploaderTaskStatus, res types.AttachmentUploadResult, err error) {
	defer u.Trace(ctx, func() error { return err }, "Status(%s)", outboxID)()
	ustatus, err := u.getStatus(ctx, outboxID)
	if err != nil {
		return status, res, err
	}
	return ustatus.Status, ustatus.Result, nil
}

func (u *Uploader) getStatus(ctx context.Context, outboxID chat1.OutboxID) (res uploaderStatus, err error) {
	tkey := u.dbStatusKey(outboxID)
	found, err := u.G().GetKVStore().GetInto(&res, tkey)
	if err != nil {
		return res, err
	}
	if !found {
		return res, libkb.NotFoundError{Msg: "no task found for outboxID"}
	}
	return res, nil
}

func (u *Uploader) setStatus(ctx context.Context, outboxID chat1.OutboxID, status uploaderStatus) error {
	key := u.dbStatusKey(outboxID)
	return u.G().GetKVStore().PutObj(key, nil, status)
}

func (u *Uploader) getTask(ctx context.Context, outboxID chat1.OutboxID) (res uploaderTask, err error) {
	tkey := u.dbTaskKey(outboxID)
	found, err := u.G().GetKVStore().GetInto(&res, tkey)
	if err != nil {
		return res, err
	}
	if !found {
		return res, libkb.NotFoundError{Msg: "no task found for outboxID"}
	}
	return res, nil
}

func (u *Uploader) saveTask(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	outboxID chat1.OutboxID, title, filename string, metadata []byte, callerPreview *chat1.MakePreviewRes) error {
	task := uploaderTask{
		UID:           uid,
		OutboxID:      outboxID,
		ConvID:        convID,
		Title:         title,
		Filename:      filename,
		Metadata:      metadata,
		CallerPreview: callerPreview,
	}
	tkey := u.dbTaskKey(outboxID)
	if err := u.G().GetKVStore().PutObj(tkey, nil, task); err != nil {
		return err
	}
	return nil
}

func (u *Uploader) Register(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	outboxID chat1.OutboxID, title, filename string, metadata []byte, callerPreview *chat1.MakePreviewRes) (res chan types.AttachmentUploadResult, err error) {
	defer u.Trace(ctx, func() error { return err }, "Register(%s)", outboxID)()
	// Write down the task information
	if err := u.saveTask(ctx, uid, convID, outboxID, title, filename, metadata, callerPreview); err != nil {
		return nil, err
	}
	var ustatus uploaderStatus
	ustatus.Status = types.AttachmentUploaderTaskStatusUploading
	if err := u.setStatus(ctx, outboxID, ustatus); err != nil {
		return nil, err
	}
	// Start upload
	return u.upload(ctx, uid, convID, outboxID, title, filename, metadata, callerPreview)
}

func (u *Uploader) checkAndSetUploading(outboxID chat1.OutboxID, res chan types.AttachmentUploadResult) (existing chan types.AttachmentUploadResult) {
	u.Lock()
	defer u.Unlock()
	if existing = u.uploads[outboxID.String()]; existing != nil {
		return existing
	}
	u.uploads[outboxID.String()] = res
	return nil
}

func (u *Uploader) doneUploading(outboxID chat1.OutboxID) {
	u.Lock()
	defer u.Unlock()
	delete(u.uploads, outboxID.String())
}

func (u *Uploader) uploadPreviewFile(ctx context.Context) (f *os.File, err error) {
	baseDir := u.G().GetCacheDir()
	if u.tempDir != "" {
		baseDir = u.tempDir
	}
	dir := filepath.Join(baseDir, "uploadedpreviews")
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		return nil, err
	}
	return ioutil.TempFile(dir, "up")
}

func (u *Uploader) upload(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	outboxID chat1.OutboxID, title, filename string, metadata []byte, callerPreview *chat1.MakePreviewRes) (res chan types.AttachmentUploadResult, err error) {
	// Check to see if we are already uploading this message and set upload status if not
	res = make(chan types.AttachmentUploadResult, 1)
	if existing := u.checkAndSetUploading(outboxID, res); existing != nil {
		u.Debug(ctx, "upload: already uploading: %s, returning early", outboxID)
		return existing, nil
	}
	defer func() {
		if err != nil {
			// we only get an error back here if we didn't actually start upload, so stop it here now
			u.doneUploading(outboxID)
		}
	}()

	// Stat the file to get size
	finfo, err := os.Stat(filename)
	if err != nil {
		return res, err
	}
	src, err := newFileReadResetter(filename)
	if err != nil {
		return res, err
	}

	progress := func(bytesComplete, bytesTotal int64) {
		u.G().ActivityNotifier.AttachmentUploadProgress(ctx, uid, convID, outboxID, bytesComplete, bytesTotal)
	}

	// preprocess asset (get content type, create preview if possible)
	var ures types.AttachmentUploadResult
	ures.Metadata = metadata
	pre, err := PreprocessAsset(ctx, u.G(), u.DebugLabeler, filename, callerPreview)
	if err != nil {
		return res, err
	}
	if pre.Preview != nil {
		u.Debug(ctx, "upload: created preview in preprocess")
		// Store the preview in pending storage
		if err := NewPendingPreviews(u.G()).Put(ctx, outboxID, pre); err != nil {
			return res, err
		}
	}

	var g *errgroup.Group
	var s3params chat1.S3Params
	paramsCh := make(chan struct{})
	bgctx := libkb.CopyTagsToBackground(ctx)
	g, bgctx = errgroup.WithContext(bgctx)
	if os.Getenv("CHAT_S3_FAKE") == "1" {
		bgctx = s3.NewFakeS3Context(bgctx)
	}
	g.Go(func() (err error) {
		u.Debug(bgctx, "upload: fetching s3 params")
		u.G().ActivityNotifier.AttachmentUploadStart(bgctx, uid, convID, outboxID)
		if s3params, err = u.ri().GetS3Params(bgctx, convID); err != nil {
			return err
		}
		close(paramsCh)
		return nil
	})

	// upload attachment and (optional) preview concurrently
	g.Go(func() (err error) {
		select {
		case <-paramsCh:
		case <-bgctx.Done():
			return bgctx.Err()
		}
		u.Debug(bgctx, "upload: uploading assets")
		task := UploadTask{
			S3Params:       s3params,
			Filename:       filename,
			FileSize:       int(finfo.Size()),
			Plaintext:      src,
			S3Signer:       u.s3signer,
			ConversationID: convID,
			UserID:         uid,
			Progress:       progress,
		}
		ures.Object, err = u.store.UploadAsset(bgctx, &task, nil)
		if err != nil {
			u.Debug(bgctx, "upload: error uploading primary asset to s3: %s", err)
		} else {
			ures.Object.Title = title
			ures.Object.MimeType = pre.ContentType
			ures.Object.Metadata = pre.BaseMetadata()
		}
		u.Debug(bgctx, "upload: asset upload complete")
		return err
	})

	if pre.Preview != nil {
		g.Go(func() error {
			select {
			case <-paramsCh:
			case <-bgctx.Done():
				return bgctx.Err()
			}
			// copy the params so as not to mess with the main params above
			previewParams := s3params

			// set up file to write out encrypted preview to
			encryptedOut, err := u.uploadPreviewFile(ctx)
			if err != nil {
				u.Debug(bgctx, "upload: failed to create uploaded preview file: %s", err)
				encryptedOut = nil
			} else {
				defer encryptedOut.Close()
			}

			// add preview suffix to object key (P in hex)
			// the s3path in gregor is expecting hex here
			previewParams.ObjectKey += "50"
			task := UploadTask{
				S3Params:       previewParams,
				Filename:       filename,
				FileSize:       len(pre.Preview),
				Plaintext:      newBufReadResetter(pre.Preview),
				S3Signer:       u.s3signer,
				ConversationID: convID,
				UserID:         uid,
			}
			preview, err := u.store.UploadAsset(bgctx, &task, encryptedOut)
			if err == nil {
				ures.Preview = &preview
				ures.Preview.MimeType = pre.PreviewContentType
				ures.Preview.Metadata = pre.PreviewMetadata()
				ures.Preview.Tag = chat1.AssetTag_PRIMARY
				if encryptedOut != nil {
					if err := u.G().AttachmentURLSrv.GetAttachmentFetcher().PutUploadedAsset(ctx,
						encryptedOut.Name(), preview); err != nil {
						u.Debug(bgctx, "upload: failed to put uploaded asset into fetcher: %s", err)
					}
				}
			} else {
				u.Debug(bgctx, "upload: error uploading preview asset to s3: %s", err)
			}
			u.Debug(bgctx, "upload: preview upload complete")
			return err
		})
	}
	go func() {
		var errStr string
		status := types.AttachmentUploaderTaskStatusSuccess
		if err := g.Wait(); err != nil {
			status = types.AttachmentUploaderTaskStatusFailed
			ures.Error = new(string)
			*ures.Error = err.Error()
			errStr = err.Error()
		}
		if err := u.setStatus(bgctx, outboxID, uploaderStatus{
			Status: status,
			Result: ures,
		}); err != nil {
			u.Debug(bgctx, "failed to set status on upload success: %s", err)
		}
		u.Debug(bgctx, "upload: upload complete: status: %v err: %s", status, errStr)
		// Ping Deliverer to notify that some of the message in the outbox might be read to send
		u.G().MessageDeliverer.ForceDeliverLoop(bgctx)
		res <- ures
		u.doneUploading(outboxID)
	}()
	return res, nil
}
