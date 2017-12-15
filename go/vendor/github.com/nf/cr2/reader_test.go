// Copyright 2013 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package cr2

import (
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type sample struct {
	File           string // Local filename relative to testdata/.
	OriginalURL    string // Canonical URL for test image.
	MirrorURL      string // Preferred URL for image.
	RawW, RawH     int    // CR2 image width & height.
	ThumbW, ThumbH int    // Embedded thumbnail width & height.
	Checksum       string // SHA-1 for file in hex.
	Filesize       int64  // Filesize in bytes.
}

func (s sample) testPath() string {
	return filepath.Join("testdata", s.File)
}

func TestDecode(t *testing.T) {
	for _, s := range samples {
		f, err := openSampleFile(t, s)
		if err != nil {
			t.Fatal(err)
		}
		defer f.Close()
		m, kind, err := image.Decode(f)
		if err != nil {
			t.Fatal(err)
		}
		if kind != "cr2" {
			t.Fatal("unexpected kind:", kind)
		}
		r := m.Bounds()
		if r.Dx() != s.ThumbW {
			t.Error("width = %v, want %v", r.Dx(), s.ThumbW)
		}
		if r.Dy() != s.ThumbH {
			t.Error("height = %v, want %v", r.Dy(), s.ThumbH)
		}
	}
}

func verify(fn string, s sample) error {
	st, err := os.Stat(fn)
	if err != nil {
		return err
	}
	if st.Size() != s.Filesize {
		return fmt.Errorf("Size mismatch, expected %d got %d", s.Filesize,
			st.Size())
	}
	h := sha1.New()
	r, err := os.Open(fn)
	if err != nil {
		return err
	}
	defer r.Close()
	_, err = io.Copy(h, r)
	if err != nil {
		return err
	}
	checksum := hex.EncodeToString(h.Sum(nil))
	if checksum != s.Checksum {
		return fmt.Errorf("Checksum mismatch, expected %s got %s",
			s.Checksum, checksum)
	}
	return nil
}

func dl(url string, s sample) error {
	// We use fmt.Print* in this function to show progress while downloading.
	// The tests can potentially take very long to setup while downloading
	// testdata/, so we provide some indication things are working.
	fmt.Println(url)
	r, err := http.Get(url)
	if err != nil {
		return err
	}
	defer r.Body.Close()
	fn := s.testPath()
	f, err := os.Create(fn)
	if err != nil {
		return err
	}

	const (
		chunkSize = 10 << 10
		width     = 50
	)
	total, bLast := int64(0), int64(0)
	tLast := time.Now()
	for {
		var n int64
		n, err = io.CopyN(f, r.Body, chunkSize)
		total += n
		bLast += n
		if time.Since(tLast) > (300 * time.Millisecond) {
			kbps := float64(bLast) / time.Since(tLast).Seconds() / 1024
			frac := int(total * width / s.Filesize)
			fmt.Printf("\rDownloaded: %s>%s| %.2f Kb/s", strings.Repeat("=", frac),
				strings.Repeat(" ", width-frac), kbps)
			tLast = time.Now()
			bLast = 0
		}

		if err != nil {
			break
		}
	}
	fmt.Println()
	if err != io.EOF {
		f.Close()
		os.Remove(fn)
		return err
	}

	return verify(fn, s)
}

func openSampleFile(t *testing.T, s sample) (io.ReadCloser, error) {
	fn := s.testPath()
	err := verify(fn, s)
	// Already downloaded.
	if err == nil {
		return os.Open(fn)
	}

	if !os.IsNotExist(err) {
		t.Log(fn, "corrupt, redownloading:", err)
	}

	t.Log("Fetching sample file", s.File)
	fi, err := os.Stat("testdata")
	if err == nil && !fi.IsDir() {
		return nil, errors.New("testdata is not a directory")
	}
	if os.IsNotExist(err) {
		err = os.Mkdir("testdata", 0777)
	}
	if err != nil {
		return nil, err
	}

	err = dl(s.MirrorURL, s)
	if err != nil {
		// Mirror download can fail, we'll fallback to canonical location.
		t.Log(err)
		err = dl(s.OriginalURL, s)
		if err != nil {
			return nil, err
		}
	}

	return os.Open(fn)
}
