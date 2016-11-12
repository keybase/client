package chat

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"io/ioutil"
	"strings"
	"testing"

	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

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

func makeTestStore(t *testing.T) *AttachmentStore {
	s := NewAttachmentStore(logger.NewTestLogger(t))

	// use in-memory implementation of s3 interface
	s.s3c = &s3.Mem{}

	return s
}

func randBytes(t *testing.T, n int) []byte {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	return buf
}

type ptsigner struct{}

func (p *ptsigner) Sign(payload []byte) ([]byte, error) {
	s := sha256.Sum256(payload)
	return s[:], nil
}

func TestUploadAssetSmall(t *testing.T) {
	s := makeTestStore(t)
	ctx := context.Background()
	plaintext := randBytes(t, 1024)
	task := &UploadTask{
		S3Params:       chat1.S3Params{},
		LocalSrc:       chat1.LocalSource{},
		Plaintext:      bytes.NewReader(plaintext),
		PlaintextHash:  randBytes(t, 16),
		S3Signer:       &ptsigner{},
		ConversationID: randBytes(t, 16),
	}
	a, err := s.UploadAsset(ctx, task)
	if err != nil {
		t.Fatal(err)
	}
	_ = a
}
