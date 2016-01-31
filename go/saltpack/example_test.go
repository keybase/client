package saltpack_test

import (
	"bytes"
	"fmt"
	"github.com/keybase/client/go/saltpack"
	"github.com/keybase/client/go/saltpack/basic"
	"io"
	"os"
)

func ExampleEncryptArmor62Seal() {

	var err error

	// Make a new Keyring, initialized to be empty
	keyring := basic.NewKeyring()

	// The test message
	msg := []byte("The Magic Words are Squeamish Ossifrage")

	// Make a secret key for the sender
	var sender saltpack.BoxSecretKey
	sender, err = keyring.GenerateBoxKey()
	if err != nil {
		return
	}

	// And one for the receiver
	var receiver saltpack.BoxSecretKey
	receiver, err = keyring.GenerateBoxKey()
	if err != nil {
		return
	}

	// AllReceivers can contain more receivers (like the sender)
	// but for now, just the one.
	var ciphertext string
	allReceivers := []saltpack.BoxPublicKey{receiver.GetPublicKey()}
	ciphertext, err = saltpack.EncryptArmor62Seal(msg, sender, allReceivers, "")
	if err != nil {
		return
	}

	// The decrypted message should match the input mesasge.
	var msg2 []byte
	_, msg2, _, err = saltpack.Dearmor62DecryptOpen(ciphertext, keyring)
	if err != nil {
		return
	}

	fmt.Println(string(msg2))

	// Output:
	// The Magic Words are Squeamish Ossifrage
}

func ExampleNewEncryptArmor62Stream() {

	var err error

	// Make a new Keyring, initialized to be empty
	keyring := basic.NewKeyring()

	// The test message
	plaintext := "The Magic Words are Squeamish Ossifrage"

	// Make a secret key for the sender
	var sender saltpack.BoxSecretKey
	sender, err = keyring.GenerateBoxKey()
	if err != nil {
		return
	}

	// And one for the receiver
	var receiver saltpack.BoxSecretKey
	receiver, err = keyring.GenerateBoxKey()
	if err != nil {
		return
	}

	// AllReceivers can contain more receivers (like the sender)
	// but for now, just the one.
	var output bytes.Buffer
	allReceivers := []saltpack.BoxPublicKey{receiver.GetPublicKey()}
	var input io.WriteCloser
	input, err = saltpack.NewEncryptArmor62Stream(&output, sender, allReceivers, "")
	if err != nil {
		return
	}
	// Write plaintext into the returned WriteCloser stream
	input.Write([]byte(plaintext))
	// And close when we're done
	input.Close()

	// The decrypted message
	var plaintextOutput io.Reader
	_, plaintextOutput, _, err = saltpack.NewDearmor62DecryptStream(&output, keyring)
	if err != nil {
		return
	}

	// Copy all of the data out of the output decrypted stream, and into standard
	// output, here for testing / comparison purposes.
	io.Copy(os.Stdout, plaintextOutput)
	os.Stdout.Write([]byte{'\n'})

	// Output:
	// The Magic Words are Squeamish Ossifrage
}
