package libkb

import (
	"reflect"
	"testing"
)

func TestCrypto(t *testing.T) {
	key, err := GenerateKey()
	if err != nil {
		t.Fatal(err)
	}

	c := Crypto{key}

	dataIn := []byte("This is my secret message")
	if err != nil {
		t.Fatal(err)
	}

	encrypted, err := c.Encrypt(dataIn)
	if err != nil {
		t.Fatal(err)
	}

	dataOut, err := c.Decrypt(encrypted)
	if err != nil {
		t.Fatal(err)
	}

	t.Logf("Message in: %s\n", dataIn)
	t.Logf("Message out: %s\n", dataOut)

	if !reflect.DeepEqual(dataIn, dataOut) {
		t.Error("Decrypt fail")
	}
}
