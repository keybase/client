// Package xdr contains the generated code for parsing the xdr structures used
// for stellar.
package xdr

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"strings"
)

// Keyer represents a type that can be converted into a LedgerKey
type Keyer interface {
	LedgerKey() LedgerKey
}

var _ = LedgerEntry{}
var _ = LedgerKey{}

// SafeUnmarshalBase64 first decodes the provided reader from base64 before
// decoding the xdr into the provided destination.  Also ensures that the reader
// is fully consumed.
func SafeUnmarshalBase64(data string, dest interface{}) error {
	count := &countWriter{}
	l := len(data)

	b64 := io.TeeReader(strings.NewReader(data), count)
	raw := base64.NewDecoder(base64.StdEncoding, b64)
	_, err := Unmarshal(raw, dest)

	if err != nil {
		return err
	}

	if count.Count != l {
		return fmt.Errorf("input not fully consumed. expected to read: %d, actual: %d", l, count.Count)
	}

	return nil
}

// SafeUnmarshal decodes the provided reader into the destination and verifies
// that provided bytes are all consumed by the unmarshalling process.
func SafeUnmarshal(data []byte, dest interface{}) error {
	r := bytes.NewReader(data)
	n, err := Unmarshal(r, dest)

	if err != nil {
		return err
	}

	if n != len(data) {
		return fmt.Errorf("input not fully consumed. expected to read: %d, actual: %d", len(data), n)
	}

	return nil
}

func MarshalBase64(v interface{}) (string, error) {
	var raw bytes.Buffer

	_, err := Marshal(&raw, v)

	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(raw.Bytes()), nil
}

type countWriter struct {
	Count int
}

func (w *countWriter) Write(d []byte) (int, error) {
	l := len(d)
	w.Count += l
	return l, nil
}
