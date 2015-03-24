package libkb

import (
	"bytes"
	"io"
	"io/ioutil"

	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/armor"
)

func PGPDecryptWithBundles(source io.Reader, sink io.Writer, keys []*PgpKeyBundle) error {
	opkr := make(openpgp.EntityList, len(keys))
	for i, k := range keys {
		opkr[i] = (*openpgp.Entity)(k)
	}
	return PGPDecrypt(source, sink, opkr)
}

func PGPDecrypt(source io.Reader, sink io.Writer, kr openpgp.KeyRing) error {
	// since we only have a reader, and we want to peek at the first 5 bytes
	// before decrypting, need to read all the bytes, then give openpgp a
	// new reader with those after armor check.
	all, err := ioutil.ReadAll(source)
	if err != nil {
		return err
	}

	var r io.Reader
	r = bytes.NewReader(all)
	if IsArmored(all) {
		b, err := armor.Decode(r)
		if err != nil {
			return err
		}
		r = b.Body
	}

	md, err := openpgp.ReadMessage(r, kr, nil, nil)
	if err != nil {
		return err
	}

	n, err := io.Copy(sink, md.UnverifiedBody)
	if err != nil {
		return err
	}
	G.Log.Debug("PGPDecrypt: copied %d bytes to writer", n)
	return nil
}

func IsArmored(buf []byte) bool {
	return bytes.HasPrefix(buf, []byte("-----"))
}
