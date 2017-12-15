// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"encoding/hex"
	"io"
	"io/ioutil"
	"os"
	"runtime"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func msg(sz int) []byte {
	res := make([]byte, sz)
	for i := 0; i < sz; i++ {
		res[i] = byte(i % 256)
	}
	return res
}

const ourBrand = "ACME"

func brandCheck(t *testing.T, received string) {
	if received != ourBrand {
		t.Fatalf("brand mismatch; wanted %q but got %q", ourBrand, received)
	}
}

const hdr = "BEGIN ACME SALTPACK ENCRYPTED MESSAGE"
const ftr = "END ACME SALTPACK ENCRYPTED MESSAGE"

func testArmor(t *testing.T, sz int) {
	m := msg(sz)
	a, e := Armor62Seal(m, MessageTypeEncryption, ourBrand)
	if e != nil {
		t.Fatal(e)
	}
	m2, hdr2, ftr2, err := Armor62Open(a)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(m, m2) {
		t.Errorf("Buffers disagreed: %v != %v (%d v %d)", m, m2, len(m), len(m2))
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
	enc, err := NewArmor62EncoderStream(&out, MessageTypeEncryption, ourBrand)
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
	a, err := Armor62Seal(m, MessageTypeEncryption, ourBrand)
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
		t.Fatalf("footer mismatch: %s != %s", ftr, ftr2)
	}
}

func TestBinaryInput(t *testing.T) {
	in, err := hex.DecodeString("96a873616c747061636b92010002c420c4afc00d50af5072094609199b54a5f8cf7b03bcea3d4945b2bbd50ac1cd42ecc41014bf77454c0b028cb009d06019981a75c4401a451af65fa3b40ae2be73b5c17dc2657992337c98ad75d4fe21de37fba2329b4970defbea176c98d306d0d285ffaa515b630224836b2c55ba1b6ba026a62102")
	if err != nil {
		t.Fatal(err)
	}

	done := make(chan bool)
	var m []byte
	var hdr, ftr string
	go func() {
		m, hdr, ftr, err = Armor62Open(string(in))
		done <- true
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		buf := make([]byte, 1<<16)
		runtime.Stack(buf, true)
		os.Stderr.Write(buf)
		t.Fatal("timed out waiting for Armor62Open to finish")
	}

	// Armor62Open should try to find the punctuation for the
	// header and hit EOF.
	require.Equal(t, io.ErrUnexpectedEOF, err, "Armor62Open didn't return io.ErrUnexpectedEOF: m == %v, hdr == %q, ftr == %q, err == %v", m, hdr, ftr, err)
}
