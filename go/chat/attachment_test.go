package chat

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"io/ioutil"
	"strings"
	"testing"

	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/signencrypt"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

const MB = 1024 * 1024

func TestSignEncrypter(t *testing.T) {
	e := NewSignEncrypter()
	el := e.EncryptedLen(100)
	if el != 180 {
		t.Errorf("enc len: %d, expected 180", el)
	}

	el = e.EncryptedLen(50 * 1024 * 1024)
	if el != 52432880 {
		t.Errorf("enc len: %d, expected 52432880", el)
	}

	pt := "plain text"
	er, err := e.Encrypt(strings.NewReader(pt))
	if err != nil {
		t.Fatal(err)
	}
	ct, err := ioutil.ReadAll(er)
	if err != nil {
		t.Fatal(err)
	}

	if string(ct) == pt {
		t.Fatal("Encrypt did not change plaintext")
	}

	d := NewSignDecrypter()
	dr := d.Decrypt(bytes.NewReader(ct), e.EncryptKey(), e.VerifyKey())
	ptOut, err := ioutil.ReadAll(dr)
	if err != nil {
		t.Fatal(err)
	}
	if string(ptOut) != pt {
		t.Errorf("decrypted ciphertext doesn't match plaintext: %q, expected %q", ptOut, pt)
	}

	// reuse e to do another Encrypt, make sure keys change:
	firstEncKey := e.EncryptKey()
	firstVerifyKey := e.VerifyKey()

	er2, err := e.Encrypt(strings.NewReader(pt))
	if err != nil {
		t.Fatal(err)
	}
	ct2, err := ioutil.ReadAll(er2)
	if err != nil {
		t.Fatal(err)
	}

	if string(ct2) == pt {
		t.Fatal("Encrypt did not change plaintext")
	}
	if bytes.Equal(ct, ct2) {
		t.Fatal("second Encrypt result same as first")
	}
	if bytes.Equal(firstEncKey, e.EncryptKey()) {
		t.Fatal("first enc key reused")
	}
	if bytes.Equal(firstVerifyKey, e.VerifyKey()) {
		t.Fatal("first verify key reused")
	}

	dr2 := d.Decrypt(bytes.NewReader(ct2), e.EncryptKey(), e.VerifyKey())
	ptOut2, err := ioutil.ReadAll(dr2)
	if err != nil {
		t.Fatal(err)
	}
	if string(ptOut2) != pt {
		t.Errorf("decrypted ciphertext doesn't match plaintext: %q, expected %q", ptOut2, pt)
	}
}

func makeTestStore(t *testing.T, kt func(enc, sig []byte)) *AttachmentStore {
	return newAttachmentStoreTesting(logger.NewTestLogger(t), kt)
}

func testStoreMultis(t *testing.T, s *AttachmentStore) []*s3.MemMulti {
	m, ok := s.s3c.(*s3.Mem)
	if !ok {
		t.Fatalf("not s3.Mem: %T", s.s3c)
	}
	// get *MemConn directly
	c := m.NewMemConn()
	return c.AllMultis()
}

func assertNumMultis(t *testing.T, s *AttachmentStore, n int) {
	numMultis := len(testStoreMultis(t, s))
	if numMultis != n {
		t.Errorf("number of s3 multis: %d, expected %d", numMultis, n)
	}
}

func getMulti(t *testing.T, s *AttachmentStore, index int) *s3.MemMulti {
	all := testStoreMultis(t, s)
	return all[index]
}

func assertNumParts(t *testing.T, s *AttachmentStore, index, n int) {
	m := getMulti(t, s, index)
	p, err := m.ListParts(nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(p) != n {
		t.Errorf("num parts in multi: %d, expected %d", len(p), n)
	}
}

func assertNumPutParts(t *testing.T, s *AttachmentStore, index, calls int) {
	m := getMulti(t, s, index)
	if m.NumPutParts() != calls {
		t.Errorf("num PutPart calls: %d, expected %d", m.NumPutParts(), calls)
	}
}

func randBytes(t *testing.T, n int) []byte {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	return buf
}

func randString(t *testing.T, nbytes int) string {
	return hex.EncodeToString(randBytes(t, nbytes))
}

type ptsigner struct{}

func (p *ptsigner) Sign(payload []byte) ([]byte, error) {
	s := sha256.Sum256(payload)
	return s[:], nil
}

type bytesReadResetter struct {
	data   []byte
	r      io.Reader
	resets int
}

func newBytesReadResetter(d []byte) *bytesReadResetter {
	return &bytesReadResetter{
		data: d,
		r:    bytes.NewReader(d),
	}
}

func (b *bytesReadResetter) Read(p []byte) (n int, err error) {
	return b.r.Read(p)
}

func (b *bytesReadResetter) Reset() error {
	b.resets++
	b.r = bytes.NewReader(b.data)
	return nil
}

func makeUploadTask(t *testing.T, size int) (plaintext []byte, task *UploadTask) {
	plaintext = randBytes(t, size)
	task = &UploadTask{
		S3Params: chat1.S3Params{
			Bucket:    "upload-test",
			ObjectKey: randString(t, 8),
		},
		Filename:       randString(t, 8),
		FileSize:       size,
		Plaintext:      newBytesReadResetter(plaintext),
		S3Signer:       &ptsigner{},
		ConversationID: randBytes(t, 16),
	}
	return plaintext, task
}

func TestUploadAssetSmall(t *testing.T) {
	s := makeTestStore(t, nil)
	ctx := context.Background()
	plaintext, task := makeUploadTask(t, 1*MB)
	a, err := s.UploadAsset(ctx, task)
	if err != nil {
		t.Fatal(err)
	}

	var buf bytes.Buffer
	if err = s.DownloadAsset(ctx, task.S3Params, a, &buf, task.S3Signer, nil); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(plaintext, buf.Bytes()) {
		t.Errorf("downloaded asset did not match uploaded asset")
	}

	// small uploads should not (cannot) use multi interface to s3:
	assertNumMultis(t, s, 0)
}

func TestUploadAssetLarge(t *testing.T) {
	s := makeTestStore(t, nil)
	ctx := context.Background()
	plaintext, task := makeUploadTask(t, 12*MB)
	a, err := s.UploadAsset(ctx, task)
	if err != nil {
		t.Fatal(err)
	}

	var buf bytes.Buffer
	if err = s.DownloadAsset(ctx, task.S3Params, a, &buf, task.S3Signer, nil); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(plaintext, buf.Bytes()) {
		t.Errorf("downloaded asset did not match uploaded asset")
	}

	// large uploads should use multi interface to s3:
	assertNumMultis(t, s, 1)
}

type uploader struct {
	t             *testing.T
	s             *AttachmentStore
	encKey        []byte
	sigKey        []byte
	plaintext     []byte
	task          *UploadTask
	breader       *bytesReadResetter
	partialEncKey []byte // keys from UploadPartial
	partialSigKey []byte
	fullEncKey    []byte // keys from UploadResume
	fullSigKey    []byte
}

func newUploader(t *testing.T, size int) *uploader {
	u := &uploader{t: t}
	u.s = makeTestStore(t, u.keyTracker)
	u.plaintext, u.task = makeUploadTask(t, size)
	return u
}

func (u *uploader) keyTracker(e, s []byte) {
	u.encKey = e
	u.sigKey = s
}

func (u *uploader) UploadResume() chat1.Asset {
	u.s.blockLimit = 0
	a, err := u.s.UploadAsset(context.Background(), u.task)
	if err != nil {
		u.t.Fatalf("expected second UploadAsset call to work, got: %s", err)
	}
	if a.Size != int64(signencrypt.GetSealedSize(len(u.plaintext))) {
		u.t.Errorf("uploaded asset size: %d, expected %d", a.Size, signencrypt.GetSealedSize(len(u.plaintext)))
	}
	u.fullEncKey = u.encKey
	u.fullSigKey = u.sigKey

	// a resumed upload should reuse existing multi, so there should only be one:
	assertNumMultis(u.t, u.s, 1)

	// after resumed upload, all parts should have been uploaded
	numParts := (len(u.plaintext) / (5 * MB)) + 1
	assertNumParts(u.t, u.s, 0, numParts)

	return a
}

func (u *uploader) UploadPartial(blocks int) {
	u.s.blockLimit = blocks

	_, err := u.s.UploadAsset(context.Background(), u.task)
	if err == nil {
		u.t.Fatal("expected incomplete upload to have error")
	}

	assertNumParts(u.t, u.s, 0, blocks)
	assertNumPutParts(u.t, u.s, 0, blocks)

	u.partialEncKey = u.encKey
	u.partialSigKey = u.sigKey
}

func (u *uploader) ResetReader() {
	u.s.blockLimit = 0
	u.breader = newBytesReadResetter(u.plaintext)
	u.task.Plaintext = u.breader
}

func (u *uploader) ResetHash() {
	u.task.plaintextHash = nil
}

func (u *uploader) DownloadAndMatch(a chat1.Asset) {
	var buf bytes.Buffer
	if err := u.s.DownloadAsset(context.Background(), u.task.S3Params, a, &buf, u.task.S3Signer, nil); err != nil {
		u.t.Fatal(err)
	}
	plaintextDownload := buf.Bytes()
	if len(plaintextDownload) != len(u.plaintext) {
		u.t.Errorf("downloaded asset len: %d, expected %d", len(plaintextDownload), len(u.plaintext))
	}
	if !bytes.Equal(u.plaintext, plaintextDownload) {
		u.t.Errorf("downloaded asset did not match uploaded asset (%x v. %x)", plaintextDownload[:10], u.plaintext[:10])
	}
}

func (u *uploader) AssertKeysChanged() {
	if bytes.Equal(u.partialEncKey, u.fullEncKey) {
		u.t.Errorf("partial enc key and full enc key match: enc key reused")
	}
	if bytes.Equal(u.partialSigKey, u.fullSigKey) {
		u.t.Errorf("partial sig key and full sig key match: sig key reused")
	}
}

func (u *uploader) AssertKeysReused() {
	if !bytes.Equal(u.partialEncKey, u.fullEncKey) {
		u.t.Errorf("partial enc key and full enc key different: enc key not reused")
	}
	if !bytes.Equal(u.partialSigKey, u.fullSigKey) {
		u.t.Errorf("partial sig key and full sig key different: sig key not reused")
	}
}

func (u *uploader) AssertNumPutParts(n int) {
	assertNumPutParts(u.t, u.s, 0, n)
}

func (u *uploader) AssertNumResets(n int) {
	if u.breader.resets != n {
		u.t.Errorf("stream resets: %d, expected %d", u.breader.resets, n)
	}
}

func (u *uploader) AssertNumAborts(n int) {
	if u.s.aborts != n {
		u.t.Errorf("aborts: %d, expected %d", u.s.aborts, n)
	}
}

// Test uploading part of an asset, then resuming at a later point in time.
// The asset does not change between the attempts.
func TestUploadAssetResumeOK(t *testing.T) {
	u := newUploader(t, 12*MB)

	// upload 2 parts of the asset
	u.UploadPartial(2)

	// resume the upload
	u.ResetReader()
	u.ResetHash()
	a := u.UploadResume()

	// download the asset
	u.DownloadAndMatch(a)

	// there should only be 3 calls to PutPart (2 in attempt 1, 1 in attempt 2).
	u.AssertNumPutParts(3)

	// keys should be reused
	u.AssertKeysReused()

	// 1 reset for plaintext hash calc in UploadResume
	u.AssertNumResets(1)

	// there should have been no aborts
	u.AssertNumAborts(0)
}

// Test uploading part of an asset, then resuming at a later point in time.
// The asset changes between the attempts.
func TestUploadAssetResumeChange(t *testing.T) {
	size := 12 * MB
	u := newUploader(t, size)

	// upload 2 parts of the asset
	u.UploadPartial(2)

	// try again, changing the file and the hash (but same destination on s3):
	// this simulates the file changing between upload attempt 1 and this attempt.
	u.plaintext = randBytes(t, size)
	u.ResetReader()
	u.ResetHash()
	a := u.UploadResume()
	u.DownloadAndMatch(a)

	// there should be 5 total calls to PutPart (2 in attempt 1, 3 in attempt 2).
	u.AssertNumPutParts(5)

	// keys should not be reused
	u.AssertKeysChanged()

	// only reset of second attempt should be after plaintext hash
	u.AssertNumResets(1)

	// there should have been no aborts
	u.AssertNumAborts(0)
}

// Test uploading part of an asset, then resuming at a later point in time.
// The asset changes after the plaintext hash is calculated in the resume attempt.
func TestUploadAssetResumeRestart(t *testing.T) {
	u := newUploader(t, 12*MB)

	// upload 2 parts of the asset
	u.UploadPartial(2)

	// try again, changing only one byte of the file (and not touching the plaintext hash).
	// this should result in full restart of upload with new keys
	u.plaintext[0] ^= 0x10
	u.ResetReader()
	// not calling u.ResetHash() here to simulate a change after the plaintext hash is
	// calculated
	a := u.UploadResume()
	u.DownloadAndMatch(a)

	// there should be 5 total calls to PutPart (2 in attempt 1, 3 in attempt 2).
	u.AssertNumPutParts(5)

	// keys should not be reused
	u.AssertKeysChanged()

	// make sure the stream is reset due to abort (once for plaintext hash, once to get to beginning):
	u.AssertNumResets(2)

	// there should have been one abort
	u.AssertNumAborts(1)
}
