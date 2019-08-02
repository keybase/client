package attachments

import (
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"sync"

	disklru "github.com/keybase/client/go/lru"

	"github.com/keybase/client/go/encrypteddb"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

const (
	uploadedPreviewsDir = "uploadedpreviews"
	uploadedFullsDir    = "uploadedfulls"
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

type uploaderResult struct {
	sync.Mutex
	subs []chan types.AttachmentUploadResult
	res  *types.AttachmentUploadResult
}

var _ types.AttachmentUploaderResultCb = (*uploaderResult)(nil)

func newUploaderResult() *uploaderResult {
	return &uploaderResult{}
}

func (r *uploaderResult) Wait() (ch chan types.AttachmentUploadResult) {
	r.Lock()
	defer r.Unlock()
	ch = make(chan types.AttachmentUploadResult, 1)
	if r.res != nil {
		// If we already have received a result and something waits, just return it right away
		ch <- *r.res
		return ch
	}
	r.subs = append(r.subs, ch)
	return ch
}

func (r *uploaderResult) trigger(res types.AttachmentUploadResult) {
	r.Lock()
	defer r.Unlock()
	r.res = &res
	for _, sub := range r.subs {
		sub <- res
	}
}

type uploaderTaskStorage struct {
	globals.Contextified
	utils.DebugLabeler
}

func newUploaderTaskStorage(g *globals.Context) *uploaderTaskStorage {
	return &uploaderTaskStorage{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "uploaderTaskStorage", false),
	}
}

func (u *uploaderTaskStorage) getDir() string {
	return filepath.Join(u.G().GetEnv().GetSharedDataDir(), "uploadertasks")
}

func (u *uploaderTaskStorage) taskOutboxIDPath(outboxID chat1.OutboxID) string {
	return filepath.Join(u.getDir(), fmt.Sprintf("task_%s", outboxID.String()))
}

func (u *uploaderTaskStorage) statusOutboxIDPath(outboxID chat1.OutboxID) string {
	return filepath.Join(u.getDir(), fmt.Sprintf("status_%s", outboxID.String()))
}

func (u *uploaderTaskStorage) file(outboxID chat1.OutboxID, getPath func(chat1.OutboxID) string) (*encrypteddb.EncryptedFile, error) {
	dir := u.getDir()
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		return nil, err
	}
	return encrypteddb.NewFile(u.G().ExternalG(), getPath(outboxID),
		func(ctx context.Context) ([32]byte, error) {
			return storage.GetSecretBoxKey(ctx, u.G().ExternalG(), storage.DefaultSecretUI)
		}), nil
}

func (u *uploaderTaskStorage) saveTask(ctx context.Context, task uploaderTask) error {
	tf, err := u.file(task.OutboxID, u.taskOutboxIDPath)
	if err != nil {
		return err
	}
	return tf.Put(ctx, task)
}

func (u *uploaderTaskStorage) getTask(ctx context.Context, outboxID chat1.OutboxID) (res uploaderTask, err error) {
	tf, err := u.file(outboxID, u.taskOutboxIDPath)
	if err != nil {
		return res, err
	}
	if err := tf.Get(ctx, &res); err != nil {
		return res, err
	}
	return res, nil
}

func (u *uploaderTaskStorage) completeTask(ctx context.Context, outboxID chat1.OutboxID) {
	if err := os.Remove(u.taskOutboxIDPath(outboxID)); err != nil {
		u.Debug(ctx, "completeTask: failed to remove task file: outboxID: %s err: %s", outboxID, err)
	}
	if err := os.Remove(u.statusOutboxIDPath(outboxID)); err != nil {
		u.Debug(ctx, "completeTask: failed to remove status file: outboxID: %s err: %s", outboxID, err)
	}
}

func (u *uploaderTaskStorage) setStatus(ctx context.Context, outboxID chat1.OutboxID, status uploaderStatus) error {
	sf, err := u.file(outboxID, u.statusOutboxIDPath)
	if err != nil {
		return err
	}
	return sf.Put(ctx, status)
}

func (u *uploaderTaskStorage) getStatus(ctx context.Context, outboxID chat1.OutboxID) (res uploaderStatus, err error) {
	sf, err := u.file(outboxID, u.statusOutboxIDPath)
	if err != nil {
		return res, err
	}
	if err := sf.Get(ctx, &res); err != nil {
		return res, err
	}
	return res, nil
}

type activeUpload struct {
	uploadCtx      context.Context
	uploadCancelFn context.CancelFunc
	uploadResult   *uploaderResult
}

type Uploader struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	store                 Store
	taskStorage           *uploaderTaskStorage
	ri                    func() chat1.RemoteInterface
	s3signer              s3.Signer
	uploads               map[string]*activeUpload
	previewsLRU, fullsLRU *disklru.DiskLRU

	// testing
	tempDir string
}

var _ types.AttachmentUploader = (*Uploader)(nil)

func NewUploader(g *globals.Context, store Store, s3signer s3.Signer,
	ri func() chat1.RemoteInterface, size int) *Uploader {
	return &Uploader{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Attachments.Uploader", false),
		store:        store,
		ri:           ri,
		s3signer:     s3signer,
		uploads:      make(map[string]*activeUpload),
		taskStorage:  newUploaderTaskStorage(g),
		previewsLRU:  disklru.NewDiskLRU(uploadedPreviewsDir, 1, size),
		fullsLRU:     disklru.NewDiskLRU(uploadedFullsDir, 1, size),
	}
}

func (u *Uploader) SetPreviewTempDir(dir string) {
	u.Lock()
	defer u.Unlock()
	u.tempDir = dir
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
	u.taskStorage.completeTask(ctx, outboxID)
	NewPendingPreviews(u.G()).Remove(ctx, outboxID)
	// just always attempt to remove the upload temp dir for this outbox ID, even if it might not be there
	os.RemoveAll(u.getUploadTempDir(outboxID))
}

func (u *Uploader) Retry(ctx context.Context, outboxID chat1.OutboxID) (res types.AttachmentUploaderResultCb, err error) {
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
		ur := newUploaderResult()
		ur.trigger(ustatus.Result)
		return ur, nil
	}
	return nil, fmt.Errorf("unknown retry status: %v", ustatus.Status)
}

func (u *Uploader) Cancel(ctx context.Context, outboxID chat1.OutboxID) (err error) {
	defer u.Trace(ctx, func() error { return err }, "Cancel(%s)", outboxID)()
	// check if we are actively uploading the outbox ID and cancel it
	u.Lock()
	var ch chan types.AttachmentUploadResult
	existing := u.uploads[outboxID.String()]
	if existing != nil {
		existing.uploadCancelFn()
		ch = existing.uploadResult.Wait()
	}
	u.Unlock()

	// Wait for the uploader to cancel
	if ch != nil {
		<-ch
	}

	// Take the whole record out of commission
	u.Complete(ctx, outboxID)
	return nil
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
	return u.taskStorage.getStatus(ctx, outboxID)
}

func (u *Uploader) setStatus(ctx context.Context, outboxID chat1.OutboxID, status uploaderStatus) error {
	return u.taskStorage.setStatus(ctx, outboxID, status)
}

func (u *Uploader) getTask(ctx context.Context, outboxID chat1.OutboxID) (uploaderTask, error) {
	return u.taskStorage.getTask(ctx, outboxID)
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
	if err := u.taskStorage.saveTask(ctx, task); err != nil {
		return err
	}
	return nil
}

func (u *Uploader) Register(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	outboxID chat1.OutboxID, title, filename string, metadata []byte, callerPreview *chat1.MakePreviewRes) (res types.AttachmentUploaderResultCb, err error) {
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

func (u *Uploader) checkAndSetUploading(uploadCtx context.Context, outboxID chat1.OutboxID,
	uploadCancelFn context.CancelFunc) (upload *activeUpload, inprogress bool) {
	u.Lock()
	defer u.Unlock()
	if upload = u.uploads[outboxID.String()]; upload != nil {
		return upload, true
	}
	upload = &activeUpload{
		uploadCtx:      uploadCtx,
		uploadCancelFn: uploadCancelFn,
		uploadResult:   newUploaderResult(),
	}
	u.uploads[outboxID.String()] = upload
	return upload, false
}

func (u *Uploader) doneUploading(outboxID chat1.OutboxID) {
	u.Lock()
	defer u.Unlock()
	if existing := u.uploads[outboxID.String()]; existing != nil {
		existing.uploadCancelFn()
	}
	delete(u.uploads, outboxID.String())
}

func (u *Uploader) getBaseDir() string {
	u.Lock()
	defer u.Unlock()
	baseDir := u.G().GetCacheDir()
	if u.tempDir != "" {
		baseDir = u.tempDir
	}
	return baseDir
}

// normalizeFilenameFromCache substitutes the existing cache dir value into the
// file path since it's possible for the path to the cache dir to change,
// especially on mobile.
func (u *Uploader) normalizeFilenameFromCache(dir, file string) string {
	file = filepath.Base(file)
	return filepath.Join(dir, file)
}

func (u *Uploader) uploadFile(ctx context.Context, diskLRU *disklru.DiskLRU, dirname, prefix string) (f *os.File, err error) {
	baseDir := u.getBaseDir()
	dir := filepath.Join(baseDir, dirname)
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		return nil, err
	}
	f, err = ioutil.TempFile(dir, prefix)
	if err != nil {
		return nil, err
	}

	// Add an entry to the disk LRU mapping with the tmpfilename to limit the
	// number of resources on disk. If we evict something we remove the
	// remnants.
	evicted, err := diskLRU.Put(ctx, u.G(), f.Name(), f.Name())
	if err != nil {
		return nil, err
	}
	if evicted != nil {
		path := u.normalizeFilenameFromCache(dir, evicted.Value.(string))
		if oerr := os.Remove(path); oerr != nil {
			u.Debug(ctx, "failed to remove file at %s, %v", path, oerr)
		}
	}
	return f, nil
}

func (u *Uploader) uploadPreviewFile(ctx context.Context) (f *os.File, err error) {
	return u.uploadFile(ctx, u.previewsLRU, uploadedPreviewsDir, "up")
}

func (u *Uploader) uploadFullFile(ctx context.Context, md chat1.AssetMetadata) (f *os.File, err error) {
	// make sure we want to stash this full asset in our local cache
	typ, err := md.AssetType()
	if err != nil {
		return nil, err
	}
	switch typ {
	case chat1.AssetMetadataType_IMAGE:
		// we will stash these guys
	default:
		return nil, fmt.Errorf("not storing full of type: %v", typ)
	}
	return u.uploadFile(ctx, u.fullsLRU, uploadedFullsDir, "fl")
}

func (u *Uploader) upload(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	outboxID chat1.OutboxID, title, filename string, metadata []byte, callerPreview *chat1.MakePreviewRes) (res types.AttachmentUploaderResultCb, err error) {

	// Create the errgroup first so we can register the context in the upload map
	var g *errgroup.Group
	var cancelFn context.CancelFunc
	bgctx := libkb.CopyTagsToBackground(ctx)
	g, bgctx = errgroup.WithContext(bgctx)
	if os.Getenv("CHAT_S3_FAKE") == "1" {
		bgctx = s3.NewFakeS3Context(bgctx)
	}
	bgctx, cancelFn = context.WithCancel(bgctx)

	// Check to see if we are already uploading this message and set upload status if not
	upload, inprogress := u.checkAndSetUploading(bgctx, outboxID, cancelFn)
	if inprogress {
		u.Debug(ctx, "upload: already uploading: %s, returning early", outboxID)
		return upload.uploadResult, nil
	}
	defer func() {
		if err != nil {
			// we only get an error back here if we didn't actually start upload, so stop it here now
			u.doneUploading(outboxID)
		}
	}()

	// Stat the file to get size
	finfo, err := StatOSOrKbfsFile(ctx, u.G().GlobalContext, filename)
	if err != nil {
		return res, err
	}
	src, err := NewReadCloseResetter(bgctx, u.G().GlobalContext, filename)
	if err != nil {
		return res, err
	}

	deferToBackgroundRoutine := false
	defer func() {
		if !deferToBackgroundRoutine {
			src.Close()
		}
	}()

	progress := func(bytesComplete, bytesTotal int64) {
		u.G().ActivityNotifier.AttachmentUploadProgress(ctx, uid, convID, outboxID, bytesComplete, bytesTotal)
	}

	// preprocess asset (get content type, create preview if possible)
	var pre Preprocess
	var ures types.AttachmentUploadResult
	ures.Metadata = metadata
	pp := NewPendingPreviews(u.G())
	if pre, err = pp.Get(ctx, outboxID); err != nil {
		u.Debug(ctx, "upload: no pending preview, generating one: %s", err)
		if pre, err = PreprocessAsset(ctx, u.G(), u.DebugLabeler, src, filename, u.G().NativeVideoHelper,
			callerPreview); err != nil {
			return res, err
		}
		if pre.Preview != nil {
			u.Debug(ctx, "upload: created preview in preprocess")
			// Store the preview in pending storage
			if err = pp.Put(ctx, outboxID, pre); err != nil {
				return res, err
			}
		}
	}

	var s3params chat1.S3Params
	paramsCh := make(chan struct{})
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

		// set up file to write out encrypted preview to
		var encryptedOut io.Writer
		uf, err := u.uploadFullFile(ctx, pre.BaseMetadata())
		if err != nil {
			u.Debug(bgctx, "upload: failed to create uploaded full file: %s", err)
			encryptedOut = ioutil.Discard
			uf = nil
		} else {
			defer uf.Close()
			encryptedOut = uf
		}

		u.Debug(bgctx, "upload: uploading assets")
		task := UploadTask{
			S3Params:       s3params,
			Filename:       filename,
			FileSize:       finfo.Size(),
			Plaintext:      src,
			S3Signer:       u.s3signer,
			ConversationID: convID,
			UserID:         uid,
			OutboxID:       outboxID,
			Preview:        false,
			Progress:       progress,
		}
		ures.Object, err = u.store.UploadAsset(bgctx, &task, encryptedOut)
		if err != nil {
			u.Debug(bgctx, "upload: error uploading primary asset to s3: %s", err)
		} else {
			ures.Object.Title = title
			ures.Object.MimeType = pre.ContentType
			ures.Object.Metadata = pre.BaseMetadata()
			if uf != nil {
				if err := u.G().AttachmentURLSrv.GetAttachmentFetcher().PutUploadedAsset(ctx,
					uf.Name(), ures.Object); err != nil {
					u.Debug(bgctx, "upload: failed to put uploaded asset into fetcher: %s", err)
				}
			}
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
			var encryptedOut io.Writer
			up, err := u.uploadPreviewFile(ctx)
			if err != nil {
				u.Debug(bgctx, "upload: failed to create uploaded preview file: %s", err)
				encryptedOut = ioutil.Discard
				up = nil
			} else {
				defer up.Close()
				encryptedOut = up
			}

			// add preview suffix to object key (P in hex)
			// the s3path in gregor is expecting hex here
			previewParams.ObjectKey += "50"
			task := UploadTask{
				S3Params:       previewParams,
				Filename:       filename,
				FileSize:       int64(len(pre.Preview)),
				Plaintext:      NewBufReadResetter(pre.Preview),
				S3Signer:       u.s3signer,
				ConversationID: convID,
				UserID:         uid,
				OutboxID:       outboxID,
				Preview:        true,
			}
			preview, err := u.store.UploadAsset(bgctx, &task, encryptedOut)
			if err == nil {
				ures.Preview = &preview
				ures.Preview.MimeType = pre.PreviewContentType
				ures.Preview.Metadata = pre.PreviewMetadata()
				ures.Preview.Tag = chat1.AssetTag_PRIMARY
				if up != nil {
					if err := u.G().AttachmentURLSrv.GetAttachmentFetcher().PutUploadedAsset(ctx,
						up.Name(), preview); err != nil {
						u.Debug(bgctx, "upload: failed to put uploaded preview asset into fetcher: %s", err)
					}
				}
			} else {
				u.Debug(bgctx, "upload: error uploading preview asset to s3: %s", err)
			}
			u.Debug(bgctx, "upload: preview upload complete")
			return err
		})
	}

	deferToBackgroundRoutine = true
	go func() {
		defer src.Close()
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
		upload.uploadResult.trigger(ures)
		u.doneUploading(outboxID)
	}()
	return upload.uploadResult, nil
}

func (u *Uploader) getUploadTempDir(outboxID chat1.OutboxID) string {
	return filepath.Join(u.G().GetSharedCacheDir(), "uploadtemps", outboxID.String())
}

func (u *Uploader) GetUploadTempFile(ctx context.Context, outboxID chat1.OutboxID, filename string) (string, error) {
	dir := u.getUploadTempDir(outboxID)
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		return "", err
	}
	return filepath.Join(dir, filepath.Base(filename)), nil
}

func (u *Uploader) OnDbNuke(mctx libkb.MetaContext) error {
	baseDir := u.getBaseDir()
	previewsDir := filepath.Join(baseDir, uploadedPreviewsDir)
	if err := u.previewsLRU.CleanOutOfSync(mctx, previewsDir); err != nil {
		u.Debug(mctx.Ctx(), "unable to run clean for uploadedPreviews: %v", err)
	}
	fullsDir := filepath.Join(baseDir, uploadedFullsDir)
	if err := u.fullsLRU.CleanOutOfSync(mctx, fullsDir); err != nil {
		u.Debug(mctx.Ctx(), "unable to run clean for uploadedFulls: %v", err)
	}
	return nil
}
