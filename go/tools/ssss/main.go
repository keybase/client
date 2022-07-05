package main

import (
	"bytes"
	"encoding/hex"
	"fmt"
	"io"
	"os"

	"github.com/keybase/client/go/libkb"
	triplesec "github.com/keybase/go-triplesec"
	saltpack "github.com/keybase/saltpack"
	basic "github.com/keybase/saltpack/basic"
)

// ssss = "simple standalone saltpack signer"
//
// Provide these environment variables:
//
//    PASSPHRASE: a saltpack passphrase
//    SECRET_KEY: a hex-encoded triplesec'ed encryption of the secret signing key, using the passphrase above
//    PUBLIC_KEY: the corresponding EdDSA public signing key
//
// Provide a file to sign via the first argument. It will output to stdout the signature.
//
func main() {
	err := mainInner()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %s\n", err.Error())
		os.Exit(2)
	}
}

func getEnv(k string) (val string, err error) {
	val = os.Getenv(k)
	if len(val) == 0 {
		return "", fmt.Errorf("needed environment variable not set: %s", k)
	}
	return val, nil
}

func unTriplesec(key []byte, ciphertext []byte) (ret []byte, err error) {

	if len(ciphertext) < 28 {
		return nil, fmt.Errorf("encrypted data must be at least 28 bytes long")
	}
	header := ciphertext[0:8]
	if !bytes.Equal(header, []byte{0x1c, 0x94, 0xd7, 0xde, 0x00, 0x00, 0x00, 0x03}) {
		return nil, fmt.Errorf("Got back triplsec header: %x", header)
	}

	salt := ciphertext[8:24]

	tsec, err := triplesec.NewCipher(key, salt, libkb.ClientTriplesecVersion)
	if err != nil {
		return nil, fmt.Errorf("could not make a triplesec decoder: %s", err.Error())
	}

	ret, err = tsec.Decrypt(ciphertext)
	if err != nil {
		return nil, fmt.Errorf("could not decrypt secret key: %s", err.Error())
	}
	return ret, nil
}

func loadKey() (key saltpack.SigningSecretKey, err error) {
	pp, err := getEnv("PASSPHRASE")
	if err != nil {
		return nil, err
	}
	encryptedKeyHex, err := getEnv("SECRET_KEY")
	if err != nil {
		return nil, err
	}
	encryptedKey, err := hex.DecodeString(encryptedKeyHex)
	if err != nil {
		return nil, fmt.Errorf("Could not hex-decode encrypted secret key: %s", err.Error())
	}
	publicKeyHex, err := getEnv("PUBLIC_KEY")
	if err != nil {
		return nil, err
	}
	publicKeyBytes, err := hex.DecodeString(publicKeyHex)
	if err != nil {
		return nil, fmt.Errorf("could not hex-decode public key: %s", err.Error())
	}
	if len(publicKeyBytes) != 32 {
		return nil, fmt.Errorf("wrong number of bytes for public key; wanted 32 but got %d", len(publicKeyBytes))
	}
	var pub [32]byte
	copy(pub[:], publicKeyBytes)

	secretKey, err := unTriplesec([]byte(pp), encryptedKey)
	if err != nil {
		return nil, err
	}

	if len(secretKey) != 64 {
		return nil, fmt.Errorf("expected a secret key of 64 bytes; got one %d long", len(secretKey))
	}
	var sec [64]byte
	copy(sec[:], secretKey)

	key = basic.NewSigningSecretKey(&pub, &sec)

	return key, nil
}

func openFile() (file io.ReadCloser, err error) {
	if len(os.Args) != 2 {
		return nil, fmt.Errorf("Usage: %s <file-to-sign>", os.Args[0])
	}
	return os.Open(os.Args[1])
}

func sign(key saltpack.SigningSecretKey, file io.ReadCloser) error {
	iow, err := saltpack.NewSignDetachedArmor62Stream(saltpack.Version1(), os.Stdout, key, "KEYBASE")
	if err != nil {
		return err
	}
	_, err = io.Copy(iow, file)
	if err != nil {
		return err
	}
	iow.Close()
	file.Close()
	return nil
}

func mainInner() error {
	key, err := loadKey()
	if err != nil {
		return err
	}
	file, err := openFile()
	if err != nil {
		return err
	}
	return sign(key, file)
}
