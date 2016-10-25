package chat

import (
	"bytes"
	"io/ioutil"
	"strings"
	"testing"
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
}
