package libkb

import (
	"io"

	"golang.org/x/crypto/openpgp"
)

func PGPEncrypt(source io.Reader, sink io.WriteCloser, signer *PgpKeyBundle, recipients []*PgpKeyBundle) error {
	to := make([]*openpgp.Entity, len(recipients))
	for i, r := range recipients {
		to[i] = (*openpgp.Entity)(r)
	}
	w, err := openpgp.Encrypt(sink, to, (*openpgp.Entity)(signer), nil, nil)
	if err != nil {
		return err
	}
	n, err := io.Copy(w, source)
	if err != nil {
		return err
	}
	G.Log.Debug("PGPEncrypt: wrote %d bytes", n)
	if err := w.Close(); err != nil {
		return err
	}
	if err := sink.Close(); err != nil {
		return err
	}
	return nil
}
