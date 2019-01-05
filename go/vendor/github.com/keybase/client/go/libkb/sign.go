// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"crypto/sha256"
	"hash"
	"io"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-crypto/openpgp"
	"github.com/keybase/go-crypto/openpgp/armor"
	"github.com/keybase/go-crypto/openpgp/packet"
)

// SimpleSign signs the given data stream, outputs an armored string which is
// the attached signature of the input data
func SimpleSign(payload []byte, key PGPKeyBundle) (out string, id keybase1.SigID, err error) {
	var outb bytes.Buffer
	var in io.WriteCloser
	var h HashSummer
	if !key.HasSecretKey() {
		err = NoSecretKeyError{}
		return
	}
	if in, h, err = ArmoredAttachedSign(NopWriteCloser{&outb}, *key.Entity, nil, nil); err != nil {
		return
	}
	if _, err = in.Write(payload); err != nil {
		return
	}
	if err = in.Close(); err != nil {
		return
	}
	out = outb.String()
	if id, err = keybase1.SigIDFromSlice(h()); err != nil {
		return
	}
	return
}

type HashingWriteCloser struct {
	targ   io.WriteCloser
	hasher hash.Hash
}

func (h HashingWriteCloser) Write(buf []byte) (int, error) {
	n, err := h.targ.Write(buf)
	if err == nil {
		_, err = h.hasher.Write(buf)
	}
	return n, err
}

func (h HashingWriteCloser) Close() error {
	err := h.targ.Close()
	return err
}

type HashSummer func() []byte

func ArmoredAttachedSign(out io.WriteCloser, signed openpgp.Entity, hints *openpgp.FileHints, config *packet.Config) (in io.WriteCloser, h HashSummer, err error) {

	var aout io.WriteCloser

	aout, err = armor.Encode(out, "PGP MESSAGE", PGPArmorHeaders)
	if err != nil {
		return
	}

	hwc := HashingWriteCloser{aout, sha256.New()}
	in, err = openpgp.AttachedSign(hwc, signed, hints, config)
	h = func() []byte { return hwc.hasher.Sum(nil) }

	return
}

func AttachedSignWrapper(out io.WriteCloser, key PGPKeyBundle, armored bool) (
	in io.WriteCloser, err error) {

	if armored {
		in, _, err = ArmoredAttachedSign(out, *key.Entity, nil, nil)
	} else {
		in, err = openpgp.AttachedSign(out, *key.Entity, nil, nil)
	}
	return
}

// NopWriteCloser is like an ioutil.NopCloser, but for an io.Writer.
// TODO: we have two of these in OpenPGP packages alone. This probably needs
// to be promoted somewhere more common.
//
// From here:
//     https://code.google.com/p/go/source/browse/openpgp/write.go?repo=crypto&r=1e7a3e301825bf9cb32e0535f3761d62d2d369d1#364
//
type NopWriteCloser struct {
	W io.Writer
}

func (c NopWriteCloser) Write(data []byte) (n int, err error) {
	return c.W.Write(data)
}

func (c NopWriteCloser) Close() error {
	return nil
}
