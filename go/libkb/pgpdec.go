package libkb

import (
	"io"

	"golang.org/x/crypto/openpgp"
)

func PGPDecryptWithBundles(source io.Reader, sink io.Writer, keys []*PgpKeyBundle) error {
	opkr := make(openpgp.EntityList, len(keys))
	for i, k := range keys {
		opkr[i] = (*openpgp.Entity)(k)
	}
	return PGPDecrypt(source, sink, opkr)
}

func PGPDecrypt(source io.Reader, sink io.Writer, kr openpgp.KeyRing) error {
	md, err := openpgp.ReadMessage(source, kr, nil, nil)
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
