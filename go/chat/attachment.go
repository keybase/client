package chat

import (
	"crypto/hmac"
	"crypto/sha256"
	"fmt"
	"io"
	"path/filepath"

	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

type UploadTask struct {
	S3Params       chat1.S3Params
	LocalSrc       chat1.LocalSource
	Plaintext      io.Reader
	PlaintextHash  []byte
	S3Signer       s3.Signer
	ConversationID chat1.ConversationID
	Progress       ProgressReporter
}

func UploadAsset(ctx context.Context, log logger.Logger, task *UploadTask) (chat1.Asset, error) {
	// encrypt the stream
	enc := NewSignEncrypter()
	len := enc.EncryptedLen(task.LocalSrc.Size)

	// check for previous interrupted upload attempt
	var previous *AttachmentInfo
	resumable := len > minMultiSize // can only resume multi uploads
	if resumable {
		previous = previousUpload(ctx, log, task)
	}

	var err error
	var encReader io.Reader
	if previous != nil {
		log.Debug("found previous upload for %s in conv %x", task.LocalSrc.Filename, task.ConversationID)
		encReader, err = enc.EncryptResume(task.Plaintext, previous.EncKey, previous.SignKey, previous.VerifyKey)
		if err != nil {
			return chat1.Asset{}, err
		}
	} else {
		encReader, err = enc.Encrypt(task.Plaintext)
		if err != nil {
			return chat1.Asset{}, err
		}
		if resumable {
			startUpload(ctx, log, task, enc)
		}
	}

	// compute ciphertext hash
	hash := sha256.New()
	tee := io.TeeReader(encReader, hash)

	// post to s3
	upRes, err := PutS3(ctx, log, tee, int64(len), task, previous)
	if err != nil {
		return chat1.Asset{}, err
	}
	log.Debug("chat attachment upload: %+v", upRes)

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
	}

	if resumable {
		finishUpload(ctx, log, task)
	}

	return asset, nil
}

// DownloadAsset gets an object from S3 as described in asset.
func DownloadAsset(ctx context.Context, log logger.Logger, params chat1.S3Params, asset chat1.Asset, w io.Writer, signer s3.Signer, progress ProgressReporter) error {
	if asset.Key == nil || asset.VerifyKey == nil || asset.EncHash == nil {
		return fmt.Errorf("unencrypted attachments not supported")
	}
	region := s3.Region{
		Name:       asset.Region,
		S3Endpoint: asset.Endpoint,
	}
	conn := s3.New(signer, region)
	conn.AccessKey = params.AccessKey

	b := conn.Bucket(asset.Bucket)

	log.Debug("downloading %s from s3", asset.Path)
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
	decBody := dec.Decrypt(tee, asset.Key, asset.VerifyKey)
	if err != nil {
		return err
	}

	n, err := io.Copy(w, decBody)
	if err != nil {
		return err
	}

	log.Debug("downloaded and decrypted to %d plaintext bytes", n)

	// validate the EncHash
	if !hmac.Equal(asset.EncHash, hash.Sum(nil)) {
		return fmt.Errorf("invalid attachment content hash")
	}
	log.Debug("attachment content hash is valid")

	return nil
}

func startUpload(ctx context.Context, log logger.Logger, task *UploadTask, encrypter *SignEncrypter) {
	info := AttachmentInfo{
		ObjectKey: task.S3Params.ObjectKey,
		EncKey:    encrypter.encKey,
		SignKey:   encrypter.signKey,
		VerifyKey: encrypter.verifyKey,
	}
	if err := StashStart(task.PlaintextHash, task.ConversationID, info); err != nil {
		log.Debug("StashStart error: %s", err)
	}
}

func finishUpload(ctx context.Context, log logger.Logger, task *UploadTask) {
	if err := StashFinish(task.PlaintextHash, task.ConversationID); err != nil {
		log.Debug("StashFinish error: %s", err)
	}
}

func previousUpload(ctx context.Context, log logger.Logger, task *UploadTask) *AttachmentInfo {
	info, found, err := StashLookup(task.PlaintextHash, task.ConversationID)
	if err != nil {
		log.Debug("StashLookup error: %s", err)
		return nil
	}
	if !found {
		return nil
	}
	return &info
}
