package libkb

import (
	"io"

	"golang.org/x/crypto/openpgp"
)

func PGPDecrypt(source io.Reader, sink io.Writer, keys []*PgpKeyBundle) error {
	opkr := make(openpgp.EntityList, len(keys))
	for i, k := range keys {
		opkr[i] = (*openpgp.Entity)(k)
	}

	md, err := openpgp.ReadMessage(source, opkr, nil, nil)
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
