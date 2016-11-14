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
	s := NewAttachmentStore(logger.NewTestLogger(t))
	s.keyTester = kt

	// use in-memory implementation of s3 interface
	s.s3c = &s3.Mem{}

	return s
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
	data []byte
	r    io.Reader
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
		LocalSrc: chat1.LocalSource{
			Filename: randString(t, 8),
			Size:     size,
		},
		// Plaintext:      bytes.NewReader(plaintext),
		Plaintext:      newBytesReadResetter(plaintext),
		PlaintextHash:  randBytes(t, 16),
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

type pwcancel struct {
	cancel func()
	after  int
}

func (p *pwcancel) report(bytesCompleted, bytesTotal int) {
	if bytesCompleted > p.after {
		p.cancel()
	}
}

func TestUploadAssetResumeOK(t *testing.T) {
	var enc, sig []byte
	kt := func(e, s []byte) {
		enc = e
		sig = s
	}
	s := makeTestStore(t, kt)
	s.pipelineSize = 1
	ctx, cancel := context.WithCancel(context.Background())
	size := 12 * MB
	plaintext, task := makeUploadTask(t, size)
	pw := &pwcancel{
		cancel: cancel,
		after:  7 * MB,
	}
	task.Progress = pw.report
	_, err := s.UploadAsset(ctx, task)
	if err == nil {
		t.Fatal("expected upload to be canceled")
	}

	assertNumParts(t, s, 0, 2)

	// keep track of the keys used in attempt 1
	enc1 := hex.EncodeToString(enc)
	sig1 := hex.EncodeToString(sig)

	// try again:
	s.pipelineSize = 10
	task.Plaintext.Reset()
	ctx = context.Background()
	task.Progress = nil
	a, err := s.UploadAsset(ctx, task)
	if err != nil {
		t.Fatalf("expected second UploadAsset call to work, got: %s", err)
	}
	if a.Size != signencrypt.GetSealedSize(size) {
		t.Errorf("uploaded asset size: %d, expected %d", a.Size, signencrypt.GetSealedSize(size))
	}

	var buf bytes.Buffer
	if err = s.DownloadAsset(ctx, task.S3Params, a, &buf, task.S3Signer, nil); err != nil {
		t.Fatal(err)
	}
	plaintextDownload := buf.Bytes()
	if len(plaintextDownload) != len(plaintext) {
		t.Errorf("downloaded asset len: %d, expected %d", len(plaintextDownload), len(plaintext))
	}
	if !bytes.Equal(plaintext, plaintextDownload) {
		t.Errorf("downloaded asset did not match uploaded asset (%x v. %x)", plaintextDownload[:10], plaintext[:10])
	}

	// a resumed upload should reuse existing multi, so there should only be one:
	assertNumMultis(t, s, 1)

	// 12MB == 3 parts
	assertNumParts(t, s, 0, 3)

	// there should only be 3 calls to PutPart (2 in attempt 1, 1 in attempt 2).
	assertNumPutParts(t, s, 0, 3)

	// keep track of the keys used in attempt 2
	enc2 := hex.EncodeToString(enc)
	sig2 := hex.EncodeToString(sig)

	if enc1 != enc2 {
		t.Errorf("encrypt key changed between attempts 1 and 2")
	}
	if sig1 != sig2 {
		t.Errorf("verify key changed between attempts 1 and 2")
	}
}

func TestUploadAssetResumeChange(t *testing.T) {
	var enc, sig []byte
	kt := func(e, s []byte) {
		enc = e
		sig = s
	}
	s := makeTestStore(t, kt)
	s.pipelineSize = 1
	ctx, cancel := context.WithCancel(context.Background())
	size := 12 * MB
	plaintext, task := makeUploadTask(t, size)
	pw := &pwcancel{
		cancel: cancel,
		after:  7 * MB,
	}
	task.Progress = pw.report
	_, err := s.UploadAsset(ctx, task)
	if err == nil {
		t.Fatal("expected upload to be canceled")
	}

	assertNumParts(t, s, 0, 2)

	// there should be 2 calls to PutPart.
	assertNumPutParts(t, s, 0, 2)

	// keep track of the keys used in attempt 1
	enc1 := hex.EncodeToString(enc)
	sig1 := hex.EncodeToString(sig)

	// try again, changing the file and the hash (but same destination on s3):
	// this simulates the file changing between upload attempt 1 and this attempt.
	s.pipelineSize = 10
	plaintext = randBytes(t, size)
	task.Plaintext = newBytesReadResetter(plaintext)
	task.PlaintextHash = randBytes(t, 16)
	task.Progress = nil

	ctx = context.Background()
	a, err := s.UploadAsset(ctx, task)
	if err != nil {
		t.Fatalf("expected second UploadAsset call to work, got: %s", err)
	}
	if a.Size != signencrypt.GetSealedSize(size) {
		t.Errorf("uploaded asset size: %d, expected %d", a.Size, signencrypt.GetSealedSize(size))
	}

	var buf bytes.Buffer
	if err = s.DownloadAsset(ctx, task.S3Params, a, &buf, task.S3Signer, nil); err != nil {
		t.Fatal(err)
	}
	plaintextDownload := buf.Bytes()
	if len(plaintextDownload) != len(plaintext) {
		t.Errorf("downloaded asset len: %d, expected %d", len(plaintextDownload), len(plaintext))
	}
	if !bytes.Equal(plaintext, plaintextDownload) {
		t.Errorf("downloaded asset did not match uploaded asset (%x v. %x)", plaintextDownload[:10], plaintext[:10])
	}

	// a resumed upload should reuse existing multi (even if contents change), so there should only be one:
	assertNumMultis(t, s, 1)

	// 2 parts made it to s3 in attempt 1.  Make sure there are now 3 parts, but that the 2 original parts
	// were replaced.
	assertNumParts(t, s, 0, 3)

	// there should be 5 total calls to PutPart (2 in attempt 1, 3 in attempt 2).
	assertNumPutParts(t, s, 0, 5)

	// keep track of the keys used in attempt 2
	enc2 := hex.EncodeToString(enc)
	sig2 := hex.EncodeToString(sig)

	if enc1 == enc2 {
		t.Errorf("encrypt key did not change between attempts 1 and 2")
	}
	if sig1 == sig2 {
		t.Errorf("verify key did not change between attempts 1 and 2")
	}
}

func TestUploadAssetResumeRestart(t *testing.T) {
	var enc, sig []byte
	kt := func(e, s []byte) {
		t.Logf("key tracker function called: %x, %x", e, s)
		enc = e
		sig = s
	}
	s := makeTestStore(t, kt)
	s.pipelineSize = 1
	ctx, cancel := context.WithCancel(context.Background())
	size := 12 * MB
	plaintext, task := makeUploadTask(t, size)
	pw := &pwcancel{
		cancel: cancel,
		after:  7 * MB,
	}
	task.Progress = pw.report
	_, err := s.UploadAsset(ctx, task)
	if err == nil {
		t.Fatal("expected upload to be canceled")
	}

	assertNumParts(t, s, 0, 2)

	// there should be 2 calls to PutPart.
	assertNumPutParts(t, s, 0, 2)

	// keep track of the keys used in attempt 1
	enc1 := hex.EncodeToString(enc)
	sig1 := hex.EncodeToString(sig)

	// try again, changing only one byte of the file.
	// this should result in full restart of upload with new keys
	s.pipelineSize = 10
	plaintext[0] ^= 0x10
	task.Plaintext = newBytesReadResetter(plaintext)
	task.Progress = nil

	ctx = context.Background()
	a, err := s.UploadAsset(ctx, task)
	if err != nil {
		t.Fatal(err)
	}

	if a.Size != signencrypt.GetSealedSize(size) {
		t.Errorf("uploaded asset size: %d, expected %d", a.Size, signencrypt.GetSealedSize(size))
	}

	var buf bytes.Buffer
	if err = s.DownloadAsset(ctx, task.S3Params, a, &buf, task.S3Signer, nil); err != nil {
		t.Fatal(err)
	}
	plaintextDownload := buf.Bytes()
	if len(plaintextDownload) != len(plaintext) {
		t.Errorf("downloaded asset len: %d, expected %d", len(plaintextDownload), len(plaintext))
	}
	if !bytes.Equal(plaintext, plaintextDownload) {
		t.Errorf("downloaded asset did not match uploaded asset (%x v. %x)", plaintextDownload[:10], plaintext[:10])
	}

	// a resumed upload should reuse existing multi (even if contents change), so there should only be one:
	assertNumMultis(t, s, 1)

	// 2 parts made it to s3 in attempt 1.  Make sure there are now 3 parts, but that the 2 original parts
	// were replaced.
	assertNumParts(t, s, 0, 3)

	// there should be 5 total calls to PutPart (2 in attempt 1, 3 in attempt 2).
	assertNumPutParts(t, s, 0, 5)

	// keep track of the keys used in attempt 2
	enc2 := hex.EncodeToString(enc)
	sig2 := hex.EncodeToString(sig)

	if enc1 == enc2 {
		t.Errorf("encrypt key did not change between attempts 1 and 2")
	}
	if sig1 == sig2 {
		t.Errorf("verify key did not change between attempts 1 and 2")
	}
}
