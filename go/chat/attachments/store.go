package attachments

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/go-crypto/ed25519"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/signencrypt"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"
)

type ReadResetter interface {
	io.Reader
	Reset() error
}

type UploadTask struct {
	S3Params       chat1.S3Params
	Filename       string
	FileSize       int64
	Plaintext      ReadResetter
	taskHash       []byte
	S3Signer       s3.Signer
	ConversationID chat1.ConversationID
	UserID         gregor1.UID
	OutboxID       chat1.OutboxID
	Preview        bool
	Progress       types.ProgressReporter
}

func (u *UploadTask) computeHash() {
	hasher := sha256.New()
	seed := fmt.Sprintf("%s:%v", u.OutboxID, u.Preview)
	io.Copy(hasher, bytes.NewReader([]byte(seed)))
	u.taskHash = hasher.Sum(nil)
}

func (u *UploadTask) hash() []byte {
	return u.taskHash
}

func (u *UploadTask) stashKey() StashKey {
	return NewStashKey(u.OutboxID, u.Preview)
}

func (u *UploadTask) Nonce() signencrypt.Nonce {
	var n [signencrypt.NonceSize]byte
	copy(n[:], u.taskHash)
	return &n
}

type Store interface {
	UploadAsset(ctx context.Context, task *UploadTask, encryptedOut io.Writer) (chat1.Asset, error)
	DownloadAsset(ctx context.Context, params chat1.S3Params, asset chat1.Asset, w io.Writer,
		signer s3.Signer, progress types.ProgressReporter) error
	GetAssetReader(ctx context.Context, params chat1.S3Params, asset chat1.Asset,
		signer s3.Signer) (io.ReadCloser, error)
	StreamAsset(ctx context.Context, params chat1.S3Params, asset chat1.Asset, signer s3.Signer) (io.ReadSeeker, error)
	DecryptAsset(ctx context.Context, w io.Writer, body io.Reader, asset chat1.Asset,
		progress types.ProgressReporter) error
	DeleteAsset(ctx context.Context, params chat1.S3Params, signer s3.Signer, asset chat1.Asset) error
	DeleteAssets(ctx context.Context, params chat1.S3Params, signer s3.Signer, assets []chat1.Asset) error
}

type streamCache struct {
	path  string
	cache *lru.Cache
}

type S3Store struct {
	utils.DebugLabeler
	libkb.Contextified

	s3signer s3.Signer
	s3c      s3.Root
	stash    AttachmentStash

	scMutex     sync.Mutex
	streamCache *streamCache

	// testing hooks
	testing    bool                        // true if we're in a test
	keyTester  func(encKey, sigKey []byte) // used for testing only to check key changes
	aborts     int                         // number of aborts
	blockLimit int                         // max number of blocks to upload
}

// NewS3Store creates a standard Store that uses a real
// S3 connection.
func NewS3Store(g *libkb.GlobalContext, runtimeDir string) *S3Store {
	return &S3Store{
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Attachments.Store", false),
		s3c:          &s3.AWS{},
		stash:        NewFileStash(runtimeDir),
		Contextified: libkb.NewContextified(g),
	}
}

// NewStoreTesting creates an Store suitable for testing
// purposes.  It is not exposed outside this package.
// It uses an in-memory s3 interface, reports enc/sig keys, and allows limiting
// the number of blocks uploaded.
func NewStoreTesting(log logger.Logger, kt func(enc, sig []byte), g *libkb.GlobalContext) *S3Store {
	return &S3Store{
		DebugLabeler: utils.NewDebugLabeler(log, "Attachments.Store", false),
		s3c:          &s3.Mem{},
		stash:        NewFileStash(os.TempDir()),
		keyTester:    kt,
		testing:      true,
		Contextified: libkb.NewContextified(g),
	}
}

func (a *S3Store) UploadAsset(ctx context.Context, task *UploadTask, encryptedOut io.Writer) (res chat1.Asset, err error) {
	defer a.Trace(ctx, func() error { return err }, "UploadAsset")()
	// compute plaintext hash
	if task.hash() == nil {
		task.computeHash()
	} else {
		if !a.testing {
			return res, errors.New("task.plaintextHash not nil")
		}
		a.Debug(ctx, "UploadAsset: skipping plaintextHash calculation due to existing plaintextHash (testing only feature)")
	}

	// encrypt the stream
	enc := NewSignEncrypter()
	len := enc.EncryptedLen(task.FileSize)

	// check for previous interrupted upload attempt
	var previous *AttachmentInfo
	resumable := len > minMultiSize // can only resume multi uploads
	if resumable {
		previous = a.previousUpload(ctx, task)
	}

	res, err = a.uploadAsset(ctx, task, enc, previous, resumable, encryptedOut)

	// if the upload is aborted, reset the stream and start over to get new keys
	if err == ErrAbortOnPartMismatch && previous != nil {
		a.Debug(ctx, "UploadAsset: resume call aborted, resetting stream and starting from scratch")
		a.aborts++
		previous = nil
		task.Plaintext.Reset()
		task.computeHash()
		return a.uploadAsset(ctx, task, enc, nil, resumable, encryptedOut)
	}

	return res, err
}

func (a *S3Store) uploadAsset(ctx context.Context, task *UploadTask, enc *SignEncrypter,
	previous *AttachmentInfo, resumable bool, encryptedOut io.Writer) (asset chat1.Asset, err error) {
	defer a.Trace(ctx, func() error { return err }, "uploadAsset")()
	var encReader io.Reader
	if previous != nil {
		a.Debug(ctx, "uploadAsset: found previous upload for %s in conv %s", task.Filename,
			task.ConversationID)
		encReader, err = enc.EncryptResume(task.Plaintext, task.Nonce(), previous.EncKey, previous.SignKey, previous.VerifyKey)
		if err != nil {
			return chat1.Asset{}, err
		}
	} else {
		encReader, err = enc.EncryptWithNonce(task.Plaintext, task.Nonce())
		if err != nil {
			return chat1.Asset{}, err
		}
		if resumable {
			a.startUpload(ctx, task, enc)
		}
	}

	if a.testing && a.keyTester != nil {
		a.Debug(ctx, "uploadAsset: Store.keyTester exists, reporting keys")
		a.keyTester(enc.EncryptKey(), enc.VerifyKey())
	}

	// compute ciphertext hash
	hash := sha256.New()
	tee := io.TeeReader(io.TeeReader(encReader, hash), encryptedOut)

	// post to s3
	length := int64(enc.EncryptedLen(task.FileSize))
	upRes, err := a.PutS3(ctx, tee, length, task, previous)
	if err != nil {
		if err == ErrAbortOnPartMismatch && previous != nil {
			// erase information about previous upload attempt
			a.finishUpload(ctx, task)
		}
		ew, ok := err.(*ErrorWrapper)
		if ok {
			a.Debug(ctx, "uploadAsset: PutS3 error details: %s", ew.Details())
		}
		return chat1.Asset{}, err
	}
	a.Debug(ctx, "uploadAsset: chat attachment upload: %+v", upRes)

	asset = chat1.Asset{
		Filename:  filepath.Base(task.Filename),
		Region:    upRes.Region,
		Endpoint:  upRes.Endpoint,
		Bucket:    upRes.Bucket,
		Path:      upRes.Path,
		Size:      upRes.Size,
		Key:       enc.EncryptKey(),
		VerifyKey: enc.VerifyKey(),
		EncHash:   hash.Sum(nil),
		Nonce:     task.Nonce()[:],
	}

	if resumable {
		a.finishUpload(ctx, task)
	}

	return asset, nil
}

func (a *S3Store) getAssetBucket(asset chat1.Asset, params chat1.S3Params, signer s3.Signer) s3.BucketInt {
	region := a.regionFromAsset(asset)
	return a.s3Conn(signer, region, params.AccessKey).Bucket(asset.Bucket)
}

func (a *S3Store) GetAssetReader(ctx context.Context, params chat1.S3Params, asset chat1.Asset,
	signer s3.Signer) (io.ReadCloser, error) {
	b := a.getAssetBucket(asset, params, signer)
	return b.GetReader(ctx, asset.Path)
}

func (a *S3Store) DecryptAsset(ctx context.Context, w io.Writer, body io.Reader, asset chat1.Asset,
	progress types.ProgressReporter) error {
	// compute hash
	hash := sha256.New()
	verify := io.TeeReader(body, hash)

	// to keep track of download progress
	progWriter := newProgressWriter(progress, asset.Size)
	tee := io.TeeReader(verify, progWriter)

	// decrypt body
	dec := NewSignDecrypter()
	var decBody io.Reader
	if asset.Nonce != nil {
		var nonce [signencrypt.NonceSize]byte
		copy(nonce[:], asset.Nonce)
		decBody = dec.DecryptWithNonce(tee, &nonce, asset.Key, asset.VerifyKey)
	} else {
		decBody = dec.Decrypt(tee, asset.Key, asset.VerifyKey)
	}

	n, err := io.Copy(w, decBody)
	if err != nil {
		return err
	}

	a.Debug(ctx, "DecryptAsset: downloaded and decrypted to %d plaintext bytes", n)
	progWriter.Finish()

	// validate the EncHash
	if !hmac.Equal(asset.EncHash, hash.Sum(nil)) {
		return fmt.Errorf("invalid attachment content hash")
	}
	a.Debug(ctx, "DecryptAsset: attachment content hash is valid")
	return nil
}

// DownloadAsset gets an object from S3 as described in asset.
func (a *S3Store) DownloadAsset(ctx context.Context, params chat1.S3Params, asset chat1.Asset,
	w io.Writer, signer s3.Signer, progress types.ProgressReporter) error {
	if asset.Key == nil || asset.VerifyKey == nil || asset.EncHash == nil {
		return fmt.Errorf("unencrypted attachments not supported: asset: %#v", asset)
	}
	body, err := a.GetAssetReader(ctx, params, asset, signer)
	defer func() {
		if body != nil {
			body.Close()
		}
	}()
	if err != nil {
		return err
	}
	a.Debug(ctx, "DownloadAsset: downloading %s from s3", asset.Path)
	return a.DecryptAsset(ctx, w, body, asset, progress)
}

type s3Seeker struct {
	utils.DebugLabeler
	ctx    context.Context
	asset  chat1.Asset
	bucket s3.BucketInt
	offset int64
}

func newS3Seeker(ctx context.Context, log logger.Logger, asset chat1.Asset, bucket s3.BucketInt) *s3Seeker {
	return &s3Seeker{
		DebugLabeler: utils.NewDebugLabeler(log, "s3Seeker", false),
		ctx:          ctx,
		asset:        asset,
		bucket:       bucket,
	}
}

func (s *s3Seeker) Read(b []byte) (n int, err error) {
	defer s.Trace(s.ctx, func() error { return err }, "Read(%v,%v)", s.offset, len(b))()
	if s.offset >= s.asset.Size {
		return 0, io.EOF
	}
	rc, err := s.bucket.GetReaderWithRange(s.ctx, s.asset.Path, s.offset, s.offset+int64(len(b)))
	if err != nil {
		return 0, err
	}
	defer rc.Close()
	var buf bytes.Buffer
	if _, err := io.Copy(&buf, rc); err != nil {
		return 0, err
	}
	copy(b, buf.Bytes())
	return len(b), nil
}

func (s *s3Seeker) Seek(offset int64, whence int) (res int64, err error) {
	defer s.Trace(s.ctx, func() error { return err }, "Seek(%v,%v)", s.offset, whence)()
	switch whence {
	case io.SeekStart:
		s.offset = offset
	case io.SeekCurrent:
		s.offset += offset
	case io.SeekEnd:
		s.offset = s.asset.Size - offset
	}
	return s.offset, nil
}

func (a *S3Store) getStreamerCache(asset chat1.Asset) *lru.Cache {
	a.scMutex.Lock()
	defer a.scMutex.Unlock()
	if a.streamCache != nil && a.streamCache.path == asset.Path {
		return a.streamCache.cache
	}
	c, _ := lru.New(20) // store 20MB in memory while streaming
	a.streamCache = &streamCache{
		path:  asset.Path,
		cache: c,
	}
	return c
}

func (a *S3Store) StreamAsset(ctx context.Context, params chat1.S3Params, asset chat1.Asset,
	signer s3.Signer) (io.ReadSeeker, error) {
	if asset.Key == nil || asset.VerifyKey == nil || asset.EncHash == nil {
		return nil, fmt.Errorf("unencrypted attachments not supported: asset: %#v", asset)
	}
	b := a.getAssetBucket(asset, params, signer)
	ptsize := signencrypt.GetPlaintextSize(asset.Size)
	var xencKey [signencrypt.SecretboxKeySize]byte
	copy(xencKey[:], asset.Key)
	var xverifyKey [ed25519.PublicKeySize]byte
	copy(xverifyKey[:], asset.VerifyKey)
	var nonce [signencrypt.NonceSize]byte
	if asset.Nonce != nil {
		copy(nonce[:], asset.Nonce)
	}
	// Make a ReadSeeker, and pass along the cache if we hit for the given path. We may get
	// a bunch of these calls for a given playback session.
	source := newS3Seeker(ctx, a.GetLog(), asset, b)
	return signencrypt.NewDecodingReadSeeker(ctx, a.GetLog(), source, ptsize, &xencKey, &xverifyKey,
		kbcrypto.SignaturePrefixChatAttachment, &nonce, a.getStreamerCache(asset)), nil
}

func (a *S3Store) startUpload(ctx context.Context, task *UploadTask, encrypter *SignEncrypter) {
	info := AttachmentInfo{
		ObjectKey: task.S3Params.ObjectKey,
		EncKey:    encrypter.encKey,
		SignKey:   encrypter.signKey,
		VerifyKey: encrypter.verifyKey,
	}
	if err := a.stash.Start(task.stashKey(), info); err != nil {
		a.Debug(ctx, "startUpload: StashStart error: %s", err)
	}
}

func (a *S3Store) finishUpload(ctx context.Context, task *UploadTask) {
	if err := a.stash.Finish(task.stashKey()); err != nil {
		a.Debug(ctx, "finishUpload: StashFinish error: %s", err)
	}
}

func (a *S3Store) previousUpload(ctx context.Context, task *UploadTask) *AttachmentInfo {
	info, found, err := a.stash.Lookup(task.stashKey())
	if err != nil {
		a.Debug(ctx, "previousUpload: StashLookup error: %s", err)
		return nil
	}
	if !found {
		return nil
	}
	return &info
}

func (a *S3Store) regionFromParams(params chat1.S3Params) s3.Region {
	return s3.Region{
		Name:             params.RegionName,
		S3Endpoint:       params.RegionEndpoint,
		S3BucketEndpoint: params.RegionBucketEndpoint,
	}
}

func (a *S3Store) regionFromAsset(asset chat1.Asset) s3.Region {
	return s3.Region{
		Name:       asset.Region,
		S3Endpoint: asset.Endpoint,
	}
}

func (a *S3Store) s3Conn(signer s3.Signer, region s3.Region, accessKey string) s3.Connection {
	conn := a.s3c.New(a.G(), signer, region)
	conn.SetAccessKey(accessKey)
	return conn
}

func (a *S3Store) DeleteAssets(ctx context.Context, params chat1.S3Params, signer s3.Signer, assets []chat1.Asset) error {

	epick := libkb.FirstErrorPicker{}
	for _, asset := range assets {
		if err := a.DeleteAsset(ctx, params, signer, asset); err != nil {
			a.Debug(ctx, "DeleteAssets: DeleteAsset error: %s", err)
			epick.Push(err)
		}
	}

	return epick.Error()
}

func (a *S3Store) DeleteAsset(ctx context.Context, params chat1.S3Params, signer s3.Signer, asset chat1.Asset) error {
	region := a.regionFromAsset(asset)
	b := a.s3Conn(signer, region, params.AccessKey).Bucket(asset.Bucket)
	return b.Del(ctx, asset.Path)
}
