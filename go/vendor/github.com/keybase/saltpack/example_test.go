package saltpack_test

import (
	"bytes"
	"fmt"
	"io"
	"os"

	"github.com/keybase/saltpack"
	"github.com/keybase/saltpack/basic"
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
	ciphertext, err = saltpack.EncryptArmor62Seal(saltpack.CurrentVersion(), msg, sender, allReceivers, "")
	if err != nil {
		return
	}

	// The decrypted message should match the input mesasge.
	var msg2 []byte
	_, msg2, _, err = saltpack.Dearmor62DecryptOpen(saltpack.CheckKnownMajorVersion, ciphertext, keyring)
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
	input, err = saltpack.NewEncryptArmor62Stream(saltpack.CurrentVersion(), &output, sender, allReceivers, "")
	if err != nil {
		return
	}
	// Write plaintext into the returned WriteCloser stream
	input.Write([]byte(plaintext))
	// And close when we're done
	input.Close()

	// The decrypted message
	var plaintextOutput io.Reader
	_, plaintextOutput, _, err = saltpack.NewDearmor62DecryptStream(saltpack.CheckKnownMajorVersion, &output, keyring)
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

func ExampleSignArmor62() {

	var err error

	// Make a new Keyring, initialized to be empty
	keyring := basic.NewKeyring()

	// The test message
	msg := []byte("The Magic Words are Squeamish Ossifrage")

	// Make a secret key for the sender
	var signer saltpack.SigningSecretKey
	signer, err = keyring.GenerateSigningKey()
	if err != nil {
		return
	}

	var signed string
	signed, err = saltpack.SignArmor62(saltpack.CurrentVersion(), msg, signer, "")
	if err != nil {
		return
	}

	// The verified message should match the input mesasge.
	var verifiedMsg []byte
	var signingPublicKey saltpack.SigningPublicKey
	signingPublicKey, verifiedMsg, _, err = saltpack.Dearmor62Verify(saltpack.CheckKnownMajorVersion, signed, keyring)
	if err != nil {
		return
	}

	if saltpack.PublicKeyEqual(signingPublicKey, signer.GetPublicKey()) {
		fmt.Println("The right key")
	}

	fmt.Println(string(verifiedMsg))

	// Output:
	// The right key
	// The Magic Words are Squeamish Ossifrage
}

func ExampleNewSignArmor62Stream() {

	var err error

	// Make a new Keyring, initialized to be empty
	keyring := basic.NewKeyring()

	// The test message
	msg := []byte("The Magic Words are Squeamish Ossifrage")

	// Make a secret key for the sender
	var signer saltpack.SigningSecretKey
	signer, err = keyring.GenerateSigningKey()
	if err != nil {
		return
	}

	// Make a new signature stream. We write the input data into
	// the input stream, and we read output out of the output stream.
	// In this case, the output stream is just a buffer.
	var input io.WriteCloser
	var output bytes.Buffer
	input, err = saltpack.NewSignArmor62Stream(saltpack.CurrentVersion(), &output, signer, "")
	if err != nil {
		return
	}

	// Write the message into the input stream, and then close
	input.Write(msg)
	input.Close()

	// The verified message. We pass the signed stream as the first argument
	// as a stream (here a bytes.Buffer which is output from above), and read the
	// verified data out of verified stream.
	var verifiedStream io.Reader
	var signingPublicKey saltpack.SigningPublicKey
	signingPublicKey, verifiedStream, _, err = saltpack.NewDearmor62VerifyStream(saltpack.CheckKnownMajorVersion, &output, keyring)
	if err != nil {
		return
	}

	// Assert we got the right key back.
	if saltpack.PublicKeyEqual(signingPublicKey, signer.GetPublicKey()) {
		fmt.Println("The right key")
	}

	// Copy all of the data out of the verified stream, and into standard
	// output, here for testing / comparison purposes.
	io.Copy(os.Stdout, verifiedStream)
	os.Stdout.Write([]byte{'\n'})

	// Output:
	// The right key
	// The Magic Words are Squeamish Ossifrage
}
