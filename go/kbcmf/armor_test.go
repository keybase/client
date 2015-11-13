// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcmf

import (
	"bytes"
	"io"
	"io/ioutil"
	"testing"
)

func msg(sz int) []byte {
	res := make([]byte, sz)
	for i := 0; i < sz; i++ {
		res[i] = byte(i % 256)
	}
	return res
}

const hdr = "BEGIN KBr ENCRYPTED MESSAGE"
const ftr = "END KBr ENCRYPTED MESSAGE"

func testArmor(t *testing.T, sz int) {
	m := msg(sz)
	a, e := Armor62Seal(m, hdr, ftr)
	if e != nil {
		t.Fatal(e)
	}
	m2, hdr2, ftr2, err := Armor62Open(a)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(m, m2) {
		t.Errorf("Buffers disagreed: %v != %v (%d v %d)\n", m, m2, len(m), len(m2))
	}
	if hdr != hdr2 {
		t.Errorf("headers disagreed: %s != %s", hdr, hdr2)
	}
	if ftr != ftr2 {
		t.Errorf("headers disagreed: %s != %s", ftr, ftr2)
	}
}

func TestArmor128(t *testing.T) {
	testArmor(t, 128)
}

func TestArmor512(t *testing.T) {
	testArmor(t, 512)
}

func TestArmor1024(t *testing.T) {
	testArmor(t, 1024)
}

func TestArmor8192(t *testing.T) {
	testArmor(t, 8192)
}
func TestArmor65536(t *testing.T) {
	testArmor(t, 65536)
}

func TestSlowWriter(t *testing.T) {
	m := msg(1024 * 16)
	var out bytes.Buffer
	enc, err := NewArmor62EncoderStream(&out, hdr, ftr)
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range m {
		if _, err = enc.Write([]byte{c}); err != nil {
			t.Fatal(err)
		}
	}
	if err = enc.Close(); err != nil {
		t.Fatal(err)
	}
	m2, hdr2, ftr2, err := Armor62Open(out.String())
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(m, m2) {
		t.Fatal("Buffer mismatch")
	}
	if ftr != ftr2 {
		t.Fatal("footer mismatch")
	}
	if hdr != hdr2 {
		t.Fatal("header mismatch")
	}
}

type slowReader struct {
	buf []byte
}

func (sr *slowReader) Read(b []byte) (int, error) {
	if len(sr.buf) == 0 {
		return 0, io.EOF
	}
	b[0] = sr.buf[0]
	sr.buf = sr.buf[1:]
	return 1, nil
}

func TestSlowReader(t *testing.T) {
	var sr slowReader
	m := msg(1024 * 32)
	a, err := Armor62Seal(m, hdr, ftr)
	if err != nil {
		t.Fatal(err)
	}
	sr.buf = []byte(a)
	dec, frame, err := NewArmor62DecoderStream(&sr)
	if err != nil {
		t.Fatal(err)
	}
	m2, err := ioutil.ReadAll(dec)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(m, m2) {
		t.Fatalf("buffer mismatch")
	}
	hdr2, err := frame.GetHeader()
	if err != nil {
		t.Fatal(err)
	}
	if hdr != hdr2 {
		t.Fatalf("header mismatch: %s != %s", hdr, hdr2)
	}
	ftr2, err := frame.GetFooter()
	if err != nil {
		t.Fatal(err)
	}
	if ftr != ftr2 {
		t.Fatalf("header mismatch: %s != %s", ftr, ftr2)
	}
}
