package main

import (
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"os"
	"strconv"

	docopt "github.com/docopt/docopt-go"
	"github.com/keybase/client/go/chat/signencrypt"
	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/go-crypto/ed25519"
)

func failf(format string, args ...interface{}) {
	log.Print(fmt.Sprintf(format, args...))
	os.Exit(1)
}

func decodeHexArg(arg string) []byte {
	decoded, err := hex.DecodeString(arg)
	if err != nil {
		failf("'%s' is not valid hex: %s", arg, err)
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

func seal(enckey signencrypt.SecretboxKey, signkey signencrypt.SignKey, signaturePrefix kbcrypto.SignaturePrefix, nonce signencrypt.Nonce, chunklen int64) error {
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

func open(enckey signencrypt.SecretboxKey, verifykey signencrypt.VerifyKey, signaturePrefix kbcrypto.SignaturePrefix, nonce signencrypt.Nonce, chunklen int64) error {
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

func main() {
	usage := `Usage:
    example seal [--enckey=<enckey>] [--signkey=<signkey>]
                 [--sigprefix=<sigprefix>] [--nonce=<nonce>] [--chunklen=<chunklen>]
    example open [--enckey=<enckey>] [--verifykey=<signkey>]
                 [--sigprefix=<sigprefix>] [--nonce=<nonce>] [--chunklen=<chunklen>]

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

	signaturePrefix := kbcrypto.SignaturePrefixTesting
	if arguments["--sigprefix"] != nil {
		signaturePrefixStr := arguments["--sigprefix"].(string)
		signaturePrefix = kbcrypto.SignaturePrefix(signaturePrefixStr)
	}

	nonce := zeroNonce()
	if arguments["--nonce"] != nil {
		copy(nonce[:], decodeHexArg(arguments["--nonce"].(string)))
	}

	var chunklen int64
	if arguments["--chunklen"] != nil {
		parsed, err := strconv.Atoi(arguments["--chunklen"].(string))
		if err != nil {
			failf("error converting: %s", err)
		}
		chunklen = int64(parsed)
	}

	var err error
	if arguments["seal"].(bool) {
		err = seal(enckey, signkey, signaturePrefix, nonce, chunklen)
	} else {
		err = open(enckey, verifykey, signaturePrefix, nonce, chunklen)
	}
	if err != nil {
		failf("crypto error: %s", err)
	}
}
