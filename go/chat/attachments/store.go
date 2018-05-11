package attachments

import (
	"crypto/hmac"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"

	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/signencrypt"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type ReadResetter interface {
	io.Reader
	Reset() error
}

type UploadTask struct {
	S3Params       chat1.S3Params
	Filename       string
	FileSize       int
	Plaintext      ReadResetter
	plaintextHash  []byte
	S3Signer       s3.Signer
	ConversationID chat1.ConversationID
	UserID         keybase1.UID
	Progress       types.ProgressReporter
}

func (u *UploadTask) computePlaintextHash() error {
	plaintextHasher := sha256.New()
	io.Copy(plaintextHasher, u.Plaintext)
	u.plaintextHash = plaintextHasher.Sum(nil)

	// reset the stream to the beginning of the file
	return u.Plaintext.Reset()
}

func (u *UploadTask) stashKey() StashKey {
	return NewStashKey(u.plaintextHash, u.ConversationID, u.UserID)
}

func (u *UploadTask) Nonce() signencrypt.Nonce {
	var n [signencrypt.NonceSize]byte
	copy(n[:], u.plaintextHash)
	return &n
}

type Store struct {
	utils.DebugLabeler

	s3signer s3.Signer
	s3c      s3.Root
	stash    AttachmentStash

	// testing hooks
	testing    bool                        // true if we're in a test
	keyTester  func(encKey, sigKey []byte) // used for testing only to check key changes
	aborts     int                         // number of aborts
	blockLimit int                         // max number of blocks to upload
}

// NewStore creates a standard Store that uses a real
// S3 connection.
func NewStore(logger logger.Logger, runtimeDir string) *Store {
	return &Store{
		DebugLabeler: utils.NewDebugLabeler(logger, "Attachments.Store", false),
		s3c:          &s3.AWS{},
		stash:        NewFileStash(runtimeDir),
	}
}

// newStoreTesting creates an Store suitable for testing
// purposes.  It is not exposed outside this package.
// It uses an in-memory s3 interface, reports enc/sig keys, and allows limiting
// the number of blocks uploaded.
func newStoreTesting(logger logger.Logger, kt func(enc, sig []byte)) *Store {
	return &Store{
		DebugLabeler: utils.NewDebugLabeler(logger, "Attachments.Store", false),
		s3c:          &s3.Mem{},
		stash:        NewFileStash(os.TempDir()),
		keyTester:    kt,
		testing:      true,
	}
}

func (a *Store) UploadAsset(ctx context.Context, task *UploadTask) (chat1.Asset, error) {
	// compute plaintext hash
	if task.plaintextHash == nil {
		if err := task.computePlaintextHash(); err != nil {
			return chat1.Asset{}, err
		}
	} else {
		if !a.testing {
			return chat1.Asset{}, errors.New("task.plaintextHash not nil")
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

	asset, err := a.uploadAsset(ctx, task, enc, previous, resumable)

	// if the upload is aborted, reset the stream and start over to get new keys
	if err == ErrAbortOnPartMismatch && previous != nil {
		a.Debug(ctx, "UploadAsset: resume call aborted, resetting stream and starting from scratch")
		a.aborts++
		previous = nil
		task.Plaintext.Reset()
		// recompute plaintext hash:
		if err := task.computePlaintextHash(); err != nil {
			return chat1.Asset{}, err
		}
		return a.uploadAsset(ctx, task, enc, nil, resumable)
	}

	return asset, err
}

func (a *Store) uploadAsset(ctx context.Context, task *UploadTask, enc *SignEncrypter, previous *AttachmentInfo, resumable bool) (chat1.Asset, error) {
	var err error
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
	tee := io.TeeReader(encReader, hash)

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

	asset := chat1.Asset{
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

func (a *Store) GetAssetReader(ctx context.Context, params chat1.S3Params, asset chat1.Asset,
	signer s3.Signer) (io.ReadCloser, error) {
	region := a.regionFromAsset(asset)
	b := a.s3Conn(signer, region, params.AccessKey).Bucket(asset.Bucket)

	return b.GetReader(ctx, asset.Path)
}

func (a *Store) DecryptAsset(ctx context.Context, w io.Writer, body io.Reader, asset chat1.Asset,
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
func (a *Store) DownloadAsset(ctx context.Context, params chat1.S3Params, asset chat1.Asset, w io.Writer,
	signer s3.Signer, progress types.ProgressReporter) error {
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

func (a *Store) startUpload(ctx context.Context, task *UploadTask, encrypter *SignEncrypter) {
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

func (a *Store) finishUpload(ctx context.Context, task *UploadTask) {
	if err := a.stash.Finish(task.stashKey()); err != nil {
		a.Debug(ctx, "finishUpload: StashFinish error: %s", err)
	}
}

func (a *Store) previousUpload(ctx context.Context, task *UploadTask) *AttachmentInfo {
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

func (a *Store) regionFromParams(params chat1.S3Params) s3.Region {
	return s3.Region{
		Name:             params.RegionName,
		S3Endpoint:       params.RegionEndpoint,
		S3BucketEndpoint: params.RegionBucketEndpoint,
	}
}

func (a *Store) regionFromAsset(asset chat1.Asset) s3.Region {
	return s3.Region{
		Name:       asset.Region,
		S3Endpoint: asset.Endpoint,
	}
}

func (a *Store) s3Conn(signer s3.Signer, region s3.Region, accessKey string) s3.Connection {
	conn := a.s3c.New(signer, region)
	conn.SetAccessKey(accessKey)
	return conn
}

func (a *Store) DeleteAssets(ctx context.Context, params chat1.S3Params, signer s3.Signer, assets []chat1.Asset) error {

	epick := libkb.FirstErrorPicker{}
	for _, asset := range assets {
		if err := a.DeleteAsset(ctx, params, signer, asset); err != nil {
			a.Debug(ctx, "DeleteAssets: DeleteAsset error: %s", err)
			epick.Push(err)
		}
	}

	return epick.Error()
}

func (a *Store) DeleteAsset(ctx context.Context, params chat1.S3Params, signer s3.Signer, asset chat1.Asset) error {
	region := a.regionFromAsset(asset)
	b := a.s3Conn(signer, region, params.AccessKey).Bucket(asset.Bucket)
	return b.Del(ctx, asset.Path)
}
