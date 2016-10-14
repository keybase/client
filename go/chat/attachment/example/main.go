package main

import (
	"encoding/hex"
	"io"
	"log"
	"os"

	"github.com/agl/ed25519"
	docopt "github.com/docopt/docopt-go"
	"github.com/keybase/client/go/chat/attachment"
)

func decodeHexArg(arg string) []byte {
	decoded, err := hex.DecodeString(arg)
	if err != nil {
		log.Printf("'%s' is not valid hex: %s", arg, err)
		os.Exit(1)
	}
	return decoded
}

func zeroSecretboxKey() attachment.SecretboxKey {
	var key [attachment.SecretboxKeySize]byte // all zeroes
	return &key
}

func zeroAttachmentNonce() attachment.AttachmentNonce {
	var nonce [attachment.AttachmentNonceSize]byte // all zeroes
	return &nonce
}

func zeroVerifyKey() attachment.VerifyKey {
	var key [ed25519.PublicKeySize]byte
	// Generated from libsodium's crypto_sign_seed_keypair with a zero seed.
	copy(key[:], ";j'\xbc\xce\xb6\xa4-b\xa3\xa8\xd0*o\rse2\x15w\x1d\xe2C\xa6:\xc0H\xa1\x8bY\xda)")
	return &key
}

func zeroSignKey() attachment.SignKey {
	var key [ed25519.PrivateKeySize]byte
	// Generated from libsodium's crypto_sign_seed_keypair with a zero seed.
	copy(key[:], "\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00;j'\xbc\xce\xb6\xa4-b\xa3\xa8\xd0*o\rse2\x15w\x1d\xe2C\xa6:\xc0H\xa1\x8bY\xda)")
	return &key
}

func seal(enckey attachment.SecretboxKey, signkey attachment.SignKey, nonce attachment.AttachmentNonce) error {
	encoder := attachment.NewAttachmentEncoder(enckey, signkey, nonce)
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

func open(enckey attachment.SecretboxKey, verifykey attachment.VerifyKey, nonce attachment.AttachmentNonce) error {
	decoder := attachment.NewAttachmentDecoder(enckey, verifykey, nonce)
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
    example seal [--enckey=<enckey>] [--signkey=<signkey>] [--nonce=<nonce>]
    example open [--enckey=<enckey>] [--verifykey=<signkey>] [--nonce=<nonce>]

Options:
    --enckey=<enckey>        the 32-byte encryption key (in hex)
    --signkey=<signkey>      the 64-byte signing private key (in hex)
    --verifykey=<verifykey>  the 32-byte signing public  key (in hex)
    --nonce=<nonce>          the 16-byte nonce
`
	arguments, _ := docopt.Parse(usage, nil, true, "attachment crypto example", false)

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

	nonce := zeroAttachmentNonce()
	if arguments["--nonce"] != nil {
		copy(nonce[:], decodeHexArg(arguments["--nonce"].(string)))
	}

	var err error
	if arguments["seal"].(bool) {
		err = seal(enckey, signkey, nonce)
	} else {
		err = open(enckey, verifykey, nonce)
	}
	if err != nil {
		log.Println(err)
		os.Exit(1)
	}
}
