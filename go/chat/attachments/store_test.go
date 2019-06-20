package attachments

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/libkb"
	"io"
	"io/ioutil"
	"strings"
	"testing"

	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/signencrypt"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

const MB int64 = 1024 * 1024

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

func makeTestStore(t *testing.T, kt func(enc, sig []byte), g *libkb.GlobalContext) *S3Store {
	return NewStoreTesting(logger.NewTestLogger(t), kt, g)
}

func testStoreMultis(t *testing.T, s *S3Store) []*s3.MemMulti {
	m, ok := s.s3c.(*s3.Mem)
	if !ok {
		t.Fatalf("not s3.Mem: %T", s.s3c)
	}
	// get *MemConn directly
	c := m.NewMemConn()
	return c.AllMultis()
}

func assertNumMultis(t *testing.T, s *S3Store, n int) {
	numMultis := len(testStoreMultis(t, s))
	if numMultis != n {
		t.Errorf("number of s3 multis: %d, expected %d", numMultis, n)
	}
}

func getMulti(t *testing.T, s *S3Store, index int) *s3.MemMulti {
	all := testStoreMultis(t, s)
	return all[index]
}

func assertNumParts(t *testing.T, s *S3Store, index, n int) {
	m := getMulti(t, s, index)
	p, err := m.ListParts(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(p) != n {
		t.Errorf("num parts in multi: %d, expected %d", len(p), n)
	}
}

func assertNumPutParts(t *testing.T, s *S3Store, index, calls int) {
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

func makeUploadTask(t *testing.T, size int64) (plaintext []byte, task *UploadTask) {
	plaintext = randBytes(t, int(size))
	outboxID, _ := storage.NewOutboxID()
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
		OutboxID:       outboxID,
	}
	return plaintext, task
}

func TestUploadAssetSmall(t *testing.T) {
	etc := externalstest.SetupTest(t, "chat_store", 1)
	defer etc.Cleanup()

	s := makeTestStore(t, nil, etc.G)
	ctx := context.Background()
	plaintext, task := makeUploadTask(t, 1*MB)
	a, err := s.UploadAsset(ctx, task, ioutil.Discard)
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
	etc := externalstest.SetupTest(t, "chat_store", 1)
	defer etc.Cleanup()

	s := makeTestStore(t, nil, etc.G)
	ctx := context.Background()
	plaintext, task := makeUploadTask(t, 12*MB)
	a, err := s.UploadAsset(ctx, task, ioutil.Discard)
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

// dumbBuffer wraps a bytes.Buffer so io.Copy doesn't use WriteTo and we get a better test
type dumbBuffer struct {
	buf bytes.Buffer
}

func (d *dumbBuffer) Write(b []byte) (n int, err error) {
	return d.buf.Write(b)
}

func (d *dumbBuffer) Bytes() []byte {
	return d.buf.Bytes()
}

func newDumbBuffer() *dumbBuffer {
	return &dumbBuffer{}
}

func TestStreamAsset(t *testing.T) {
	etc := externalstest.SetupTest(t, "chat_store", 1)
	defer etc.Cleanup()

	s := makeTestStore(t, nil, etc.G)
	ctx := context.Background()

	testCase := func(mb, kb int64) {
		total := mb*MB + kb
		t.Logf("total: %d mb: %d kb: %d", total, mb, kb)
		plaintext, task := makeUploadTask(t, total)
		a, err := s.UploadAsset(ctx, task, ioutil.Discard)
		require.NoError(t, err)

		// basic
		var buf bytes.Buffer
		t.Logf("basic")
		s.streamCache = nil
		rs, err := s.StreamAsset(ctx, task.S3Params, a, task.S3Signer)
		require.NoError(t, err)
		_, err = io.Copy(&buf, rs)
		require.NoError(t, err)
		require.True(t, bytes.Equal(plaintext, buf.Bytes()))
		// use the cache
		buf.Reset()
		rs, err = s.StreamAsset(ctx, task.S3Params, a, task.S3Signer)
		require.NoError(t, err)
		_, err = io.Copy(&buf, rs)
		require.NoError(t, err)
		require.True(t, bytes.Equal(plaintext, buf.Bytes()))

		// seek to half and copy
		t.Logf("half")
		dbuf := newDumbBuffer()
		s.streamCache = nil
		rs, err = s.StreamAsset(ctx, task.S3Params, a, task.S3Signer)
		require.NoError(t, err)
		_, err = rs.Seek(total/2, io.SeekStart)
		require.NoError(t, err)
		_, err = io.Copy(dbuf, rs)
		require.NoError(t, err)
		require.True(t, bytes.Equal(plaintext[total/2:], dbuf.Bytes()))

		// use a fixed size buffer (like video playback)
		t.Logf("buffer")
		dbuf = newDumbBuffer()
		s.streamCache = nil
		scratch := make([]byte, 64*1024)
		rs, err = s.StreamAsset(ctx, task.S3Params, a, task.S3Signer)
		require.NoError(t, err)
		_, err = io.CopyBuffer(dbuf, rs, scratch)
		require.NoError(t, err)
		require.True(t, bytes.Equal(plaintext, dbuf.Bytes()))
	}

	testCase(2, 0)
	testCase(2, 400)
	testCase(12, 0)
	testCase(12, 543)
}

type uploader struct {
	t             *testing.T
	s             *S3Store
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

func newUploader(t *testing.T, size int64, g *libkb.GlobalContext) *uploader {
	u := &uploader{t: t}
	u.s = makeTestStore(t, u.keyTracker, g)
	u.plaintext, u.task = makeUploadTask(t, size)
	return u
}

func (u *uploader) keyTracker(e, s []byte) {
	u.encKey = e
	u.sigKey = s
}

func (u *uploader) UploadResume() chat1.Asset {
	u.s.blockLimit = 0
	a, err := u.s.UploadAsset(context.Background(), u.task, ioutil.Discard)
	if err != nil {
		u.t.Fatalf("expected second UploadAsset call to work, got: %s", err)
	}
	if a.Size != int64(signencrypt.GetSealedSize(int64(len(u.plaintext)))) {
		u.t.Errorf("uploaded asset size: %d, expected %d", a.Size,
			signencrypt.GetSealedSize(int64(len(u.plaintext))))
	}
	u.fullEncKey = u.encKey
	u.fullSigKey = u.sigKey

	// a resumed upload should reuse existing multi, so there should only be one:
	assertNumMultis(u.t, u.s, 1)

	// after resumed upload, all parts should have been uploaded
	numParts := (int64(len(u.plaintext)) / (5 * MB)) + 1
	assertNumParts(u.t, u.s, 0, int(numParts))

	return a
}

func (u *uploader) UploadPartial(blocks int) {
	u.s.blockLimit = blocks

	_, err := u.s.UploadAsset(context.Background(), u.task, ioutil.Discard)
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
	u.task.taskHash = nil
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
	etc := externalstest.SetupTest(t, "chat_store", 1)
	defer etc.Cleanup()

	u := newUploader(t, 12*MB, etc.G)

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

	// no resets happen here
	u.AssertNumResets(0)

	// there should have been no aborts
	u.AssertNumAborts(0)
}

// Test uploading part of an asset, then resuming at a later point in time.
// The asset changes between the attempts.
func TestUploadAssetResumeChange(t *testing.T) {
	etc := externalstest.SetupTest(t, "chat_store", 1)
	defer etc.Cleanup()

	size := 12 * MB
	u := newUploader(t, size, etc.G)

	// upload 2 parts of the asset
	u.UploadPartial(2)

	// try again, changing the file and the hash (but same destination on s3):
	// this simulates the file changing between upload attempt 1 and this attempt.
	u.plaintext = randBytes(t, int(size))
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

	// we get one abort since outboxID doesn't change with the file
	u.AssertNumAborts(1)
}

// Test uploading part of an asset, then resuming at a later point in time.
// The asset changes after the plaintext hash is calculated in the resume attempt.
func TestUploadAssetResumeRestart(t *testing.T) {
	etc := externalstest.SetupTest(t, "chat_store", 1)
	defer etc.Cleanup()

	u := newUploader(t, 12*MB, etc.G)

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

	// one reset on the abort
	u.AssertNumResets(1)

	// there should have been one abort
	u.AssertNumAborts(1)
}
