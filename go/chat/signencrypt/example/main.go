package main

import (
	"encoding/hex"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/agl/ed25519"
	docopt "github.com/docopt/docopt-go"
	"github.com/keybase/client/go/chat/signencrypt"
	"github.com/keybase/client/go/libkb"
)

func fail(args ...interface{}) {
	log.Print(fmt.Sprintln(args...))
	os.Exit(1)
}

func decodeHexArg(arg string) []byte {
	decoded, err := hex.DecodeString(arg)
	if err != nil {
		fail("'%s' is not valid hex: %s", arg, err)
	}
	return decoded
}

func zeroSecretboxKey() signencrypt.SecretboxKey {
	var key [signencrypt.SecretboxKeySize]byte // all zeroes
	return &key
}

func zeroNonce() signencrypt.Nonce {
	var nonce [signencrypt.NonceSize]byte // all zeroes
	return &nonce
}

func zeroSecretboxNonce() signencrypt.SecretboxNonce {
	var nonce [signencrypt.SecretboxNonceSize]byte // all zeroes
	return &nonce
}

func zeroVerifyKey() signencrypt.VerifyKey {
	var key [ed25519.PublicKeySize]byte
	// Generated from libsodium's crypto_sign_seed_keypair with a zero seed.
	copy(key[:], ";j'\xbc\xce\xb6\xa4-b\xa3\xa8\xd0*o\rse2\x15w\x1d\xe2C\xa6:\xc0H\xa1\x8bY\xda)")
	return &key
}

func zeroSignKey() signencrypt.SignKey {
	var key [ed25519.PrivateKeySize]byte
	// Generated from libsodium's crypto_sign_seed_keypair with a zero seed.
	copy(key[:], "\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00;j'\xbc\xce\xb6\xa4-b\xa3\xa8\xd0*o\rse2\x15w\x1d\xe2C\xa6:\xc0H\xa1\x8bY\xda)")
	return &key
}

func sealStream(enckey signencrypt.SecretboxKey, signkey signencrypt.SignKey, signaturePrefix libkb.SignaturePrefix, nonce signencrypt.Nonce, chunklen int) error {
	encoder := signencrypt.NewEncoder(enckey, signkey, signaturePrefix, nonce)
	if chunklen != 0 {
		encoder.ChangePlaintextChunkLenForTesting(chunklen)
	}
	var buf [4096]byte
	for {
		num, err := os.Stdin.Read(buf[:])
		if err == io.EOF {
			break
		} else if err != nil {
			return err
		}
		encoded := encoder.Write(buf[0:num])
		_, err = os.Stdout.Write(encoded)
		if err != nil {
			return err
		}
	}
	encoded := encoder.Finish()
	_, err := os.Stdout.Write(encoded)
	if err != nil {
		return err
	}
	return nil
}

func sealSingle(enckey signencrypt.SecretboxKey, signkey signencrypt.SignKey, signaturePrefix libkb.SignaturePrefix, nonce signencrypt.SecretboxNonce, chunklen int) error {
	plaintext, err := ioutil.ReadAll(os.Stdin)
	if err != nil {
		return err
	}
	encoded := signencrypt.SealSingle(plaintext, enckey, signkey, signaturePrefix, nonce)
	_, err = os.Stdout.Write(encoded)
	if err != nil {
		return err
	}
	return nil
}

func openStream(enckey signencrypt.SecretboxKey, verifykey signencrypt.VerifyKey, signaturePrefix libkb.SignaturePrefix, nonce signencrypt.Nonce, chunklen int) error {
	decoder := signencrypt.NewDecoder(enckey, verifykey, signaturePrefix, nonce)
	if chunklen != 0 {
		decoder.ChangePlaintextChunkLenForTesting(chunklen)
	}
	var buf [4096]byte
	for {
		num, err := os.Stdin.Read(buf[:])
		if err == io.EOF {
			break
		} else if err != nil {
			return err
		}
		decoded, err := decoder.Write(buf[0:num])
		if err != nil {
			return err
		}
		_, err = os.Stdout.Write(decoded)
		if err != nil {
			return err
		}
	}
	decoded, err := decoder.Finish()
	if err != nil {
		return err
	}
	_, err = os.Stdout.Write(decoded)
	if err != nil {
		return err
	}
	return nil
}

func openSingle(enckey signencrypt.SecretboxKey, verifykey signencrypt.VerifyKey, signaturePrefix libkb.SignaturePrefix, nonce signencrypt.SecretboxNonce, chunklen int) error {
	sealed, err := ioutil.ReadAll(os.Stdin)
	if err != nil {
		return err
	}
	decoded, err := signencrypt.OpenSingle(sealed, enckey, verifykey, signaturePrefix, nonce)
	_, err = os.Stdout.Write(decoded)
	if err != nil {
		return err
	}
	return nil
}

func stringInSlice(a string, list []string) bool {
	for _, b := range list {
		if b == a {
			return true
		}
	}
	return false
}

func main() {
	usage := `Usage:
    example seal [--enckey=<enckey>] [--signkey=<signkey>] [--sigprefix=<sigprefix>]
                 [--nonce=<nonce>] [--chunklen=<chunklen>] [--stream=false]
    example open [--enckey=<enckey>] [--verifykey=<signkey>] [--sigprefix=<sigprefix>]
                 [--nonce=<nonce>] [--chunklen=<chunklen>] [--stream=false]

Options:
    --enckey=<enckey>        the 32-byte encryption key (in hex)
    --signkey=<signkey>      the 64-byte signing private key (in hex)
    --verifykey=<verifykey>  the 32-byte signing public  key (in hex)
    --sigprefix=<sigprefix>  the signature prefix (string)
    --nonce=<nonce>          the 16-byte nonce
    --chunklen=<chunklen>    the size of plaintext chunks, for testing, default 2^20 bytes
`
	arguments, _ := docopt.Parse(usage, nil, true, "signencrypt crypto example", false)

	enckey := zeroSecretboxKey()
	if arguments["--enckey"] != nil {
		copy(enckey[:], decodeHexArg(arguments["--enckey"].(string)))
	}

	signkey := zeroSignKey()
	if arguments["--signkey"] != nil {
		copy(signkey[:], decodeHexArg(arguments["--signkey"].(string)))
	}

	verifykey := zeroVerifyKey()
	if arguments["--verifykey"] != nil {
		copy(verifykey[:], decodeHexArg(arguments["--verifykey"].(string)))
	}

	signaturePrefix := libkb.SignaturePrefixTesting
	if arguments["--sigprefix"] != nil {
		signaturePrefixStr := arguments["--sigprefix"].(string)
		signaturePrefix = libkb.SignaturePrefix(signaturePrefixStr)
	}

	nonceForStream := zeroNonce()
	nonceForSingle := zeroSecretboxNonce()
	if arguments["--nonce"] != nil {
		copy(nonceForSingle[:], decodeHexArg(arguments["--nonce"].(string)))
		copy(nonceForStream[:], decodeHexArg(arguments["--nonce"].(string)))
	}

	chunklen := 0
	if arguments["--chunklen"] != nil {
		parsed, err := strconv.Atoi(arguments["--chunklen"].(string))
		if err != nil {
			fail(err)
		}
		chunklen = parsed
	}

	stream := true
	if arguments["--stream"] != nil {
		parsed := arguments["--stream"].(string)
		stream = stringInSlice(strings.ToLower(parsed), []string{"", "yes", "true", "t", "y"})
	}

	var err error
	if arguments["seal"].(bool) {
		if stream {
			err = sealStream(enckey, signkey, signaturePrefix, nonceForStream, chunklen)
		} else {
			err = sealSingle(enckey, signkey, signaturePrefix, nonceForSingle, chunklen)
		}
	} else {
		if stream {
			err = openStream(enckey, verifykey, signaturePrefix, nonceForStream, chunklen)
		} else {
			err = openSingle(enckey, verifykey, signaturePrefix, nonceForSingle, chunklen)
		}
	}
	if err != nil {
		fail(err)
	}
}
