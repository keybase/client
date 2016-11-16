package chat

import (
	"crypto/hmac"
	"crypto/sha256"
	"fmt"
	"io"
	"path/filepath"

	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/signencrypt"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

type ReadResetter interface {
	io.Reader
	Reset() error
}

type UploadTask struct {
	S3Params       chat1.S3Params
	LocalSrc       chat1.LocalSource
	Plaintext      ReadResetter
	plaintextHash  []byte
	S3Signer       s3.Signer
	ConversationID chat1.ConversationID
	Progress       ProgressReporter
}

func (u *UploadTask) computePlaintextHash() error {
	plaintextHasher := sha256.New()
	io.Copy(plaintextHasher, u.Plaintext)
	u.plaintextHash = plaintextHasher.Sum(nil)

	// reset the stream to the beginning of the file
	return u.Plaintext.Reset()

}

func (u *UploadTask) Nonce() signencrypt.Nonce {
	var n [signencrypt.NonceSize]byte
	copy(n[:], u.plaintextHash)
	return &n
}

type AttachmentStore struct {
	log      logger.Logger
	s3signer s3.Signer
	s3c      s3.Root

	// testing hooks
	keyTester    func(encKey, sigKey []byte) // used for testing only to check key changes
	pipelineSize int
	aborts       int
	blockLimit   int // max number of blocks to upload
}

func NewAttachmentStore(log logger.Logger) *AttachmentStore {
	return &AttachmentStore{
		log:          log,
		s3c:          &s3.AWS{},
		pipelineSize: 10,
	}
}

func (a *AttachmentStore) UploadAsset(ctx context.Context, task *UploadTask) (chat1.Asset, error) {
	// compute plaintext hash
	if task.plaintextHash == nil {
		if err := task.computePlaintextHash(); err != nil {
			return chat1.Asset{}, err
		}
	} else {
		a.log.Warning("skipping plaintextHash calculation due to existing plaintextHash (testing only feature)")
	}

	// encrypt the stream
	enc := NewSignEncrypter()
	len := enc.EncryptedLen(task.LocalSrc.Size)

	// check for previous interrupted upload attempt
	var previous *AttachmentInfo
	resumable := len > minMultiSize // can only resume multi uploads
	if resumable {
		previous = a.previousUpload(ctx, task)
	}

	asset, err := a.uploadAsset(ctx, task, enc, previous, resumable)

	// if the upload is aborted, reset the stream and start over to get new keys
	if err == ErrAbortOnPartMismatch && previous != nil {
		a.log.Debug("uploadAsset resume call aborted, resetting stream and starting from scratch")
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

func (a *AttachmentStore) uploadAsset(ctx context.Context, task *UploadTask, enc *SignEncrypter, previous *AttachmentInfo, resumable bool) (chat1.Asset, error) {
	var err error
	var encReader io.Reader
	if previous != nil {
		a.log.Debug("found previous upload for %s in conv %x", task.LocalSrc.Filename, task.ConversationID)
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

	// XXX make this only work in devel mode or panic in production
	if a.keyTester != nil {
		a.log.Warning("AttachmentStore.keyTester exists, reporting keys")
		a.keyTester(enc.EncryptKey(), enc.VerifyKey())
	}

	// compute ciphertext hash
	hash := sha256.New()
	tee := io.TeeReader(encReader, hash)

	// post to s3
	length := int64(enc.EncryptedLen(task.LocalSrc.Size))
	upRes, err := a.PutS3(ctx, tee, length, task, previous)
	if err != nil {
		if err == ErrAbortOnPartMismatch && previous != nil {
			// erase information about previous upload attempt
			a.finishUpload(ctx, task)
		}
		return chat1.Asset{}, err
	}
	a.log.Debug("chat attachment upload: %+v", upRes)

	asset := chat1.Asset{
		Filename:  filepath.Base(task.LocalSrc.Filename),
		Region:    upRes.Region,
		Endpoint:  upRes.Endpoint,
		Bucket:    upRes.Bucket,
		Path:      upRes.Path,
		Size:      int(upRes.Size),
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

// DownloadAsset gets an object from S3 as described in asset.
func (a *AttachmentStore) DownloadAsset(ctx context.Context, params chat1.S3Params, asset chat1.Asset, w io.Writer, signer s3.Signer, progress ProgressReporter) error {
	if asset.Key == nil || asset.VerifyKey == nil || asset.EncHash == nil {
		return fmt.Errorf("unencrypted attachments not supported")
	}
	region := a.regionFromAsset(asset)
	b := a.s3Conn(signer, region, params.AccessKey).Bucket(asset.Bucket)

	a.log.Debug("downloading %s from s3", asset.Path)
	body, err := b.GetReader(ctx, asset.Path)
	defer func() {
		if body != nil {
			body.Close()
		}
	}()
	if err != nil {
		return err
	}

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

	a.log.Debug("downloaded and decrypted to %d plaintext bytes", n)

	// validate the EncHash
	if !hmac.Equal(asset.EncHash, hash.Sum(nil)) {
		return fmt.Errorf("invalid attachment content hash")
	}
	a.log.Debug("attachment content hash is valid")

	return nil
}

func (a *AttachmentStore) startUpload(ctx context.Context, task *UploadTask, encrypter *SignEncrypter) {
	info := AttachmentInfo{
		ObjectKey: task.S3Params.ObjectKey,
		EncKey:    encrypter.encKey,
		SignKey:   encrypter.signKey,
		VerifyKey: encrypter.verifyKey,
	}
	if err := StashStart(task.plaintextHash, task.ConversationID, info); err != nil {
		a.log.Debug("StashStart error: %s", err)
	}
}

func (a *AttachmentStore) finishUpload(ctx context.Context, task *UploadTask) {
	if err := StashFinish(task.plaintextHash, task.ConversationID); err != nil {
		a.log.Debug("StashFinish error: %s", err)
	}
}

func (a *AttachmentStore) previousUpload(ctx context.Context, task *UploadTask) *AttachmentInfo {
	info, found, err := StashLookup(task.plaintextHash, task.ConversationID)
	if err != nil {
		a.log.Debug("StashLookup error: %s", err)
		return nil
	}
	if !found {
		return nil
	}
	return &info
}

func (a *AttachmentStore) regionFromParams(params chat1.S3Params) s3.Region {
	return s3.Region{
		Name:             params.RegionName,
		S3Endpoint:       params.RegionEndpoint,
		S3BucketEndpoint: params.RegionBucketEndpoint,
	}
}

func (a *AttachmentStore) regionFromAsset(asset chat1.Asset) s3.Region {
	return s3.Region{
		Name:       asset.Region,
		S3Endpoint: asset.Endpoint,
	}
}

func (a *AttachmentStore) s3Conn(signer s3.Signer, region s3.Region, accessKey string) s3.Connection {
	conn := a.s3c.New(signer, region)
	conn.SetAccessKey(accessKey)
	return conn
}
