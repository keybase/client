// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/terminalescaper"
	isatty "github.com/mattn/go-isatty"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type Source interface {
	io.ReadCloser
	io.Seeker
	Open() error
	CloseWithError(error) error
}

type Sink interface {
	io.WriteCloser
	Open() error
	HitError(err error) error
}

type BufferSource struct {
	data string
	buf  *bytes.Buffer
}

func NewBufferSource(s string) *BufferSource {
	return &BufferSource{data: s}
}

func (b *BufferSource) Open() error {
	b.buf = bytes.NewBufferString(b.data)
	return nil
}

func (b *BufferSource) Read(p []byte) (n int, err error) {
	return b.buf.Read(p)
}

func (b *BufferSource) Close() error               { return nil }
func (b *BufferSource) CloseWithError(error) error { return nil }
func (b *BufferSource) Seek(offset int64, whence int) (int64, error) {
	return 0, errors.New("BufferSource does not support Seek")
}

type StdinSource struct {
	open bool
}

func (b *StdinSource) Open() error {
	b.open = true
	return nil
}

func drain(f *os.File) error {
	buf := make([]byte, 1024*64)
	var err error
	var n int
	eof := false
	for !eof && err == nil {
		if n, err = f.Read(buf); n == 0 && err != nil {
			eof = true
			if err == io.EOF {
				err = nil
			}
		}
	}
	return err
}

// Close a source, but consume all leftover input before so doing.
func (b *StdinSource) Close() error {
	var err error
	if b.open {
		err = drain(os.Stdin)
	}
	b.open = false
	return err
}

func (b *StdinSource) CloseWithError(e error) error {
	if e != nil {
		b.open = false
		return nil
	}
	return b.Close()
}

func (b *StdinSource) Read(p []byte) (n int, err error) {
	if b.open {
		n, err := os.Stdin.Read(p)
		if n == 0 {
			b.open = false
		}
		return n, err
	}
	return 0, io.EOF
}

func (b *StdinSource) Seek(offset int64, whence int) (int64, error) {
	return 0, errors.New("StdinSource does not support Seek")
}

// isValidFile verifies the file in question is not actually a directory.
func isValidFile(file *os.File) error {
	finfo, err := file.Stat()
	if err != nil {
		return err
	}
	if mode := finfo.Mode(); mode.IsDir() {
		return fmt.Errorf("A directory is not a valid file")
	}
	return nil
}

type FileSource struct {
	name string
	file *os.File
}

func NewFileSource(s string) *FileSource {
	return &FileSource{name: s}
}

func (s *FileSource) Open() error {
	f, err := os.OpenFile(s.name, os.O_RDONLY, 0)
	if err != nil {
		return err
	}
	if err = isValidFile(f); err != nil {
		return err
	}
	s.file = f
	return nil
}

func (s *FileSource) Close() error {
	if s.file == nil {
		return nil
	}
	err := s.file.Close()
	s.file = nil
	return err
}

func (s *FileSource) CloseWithError(e error) error {
	return s.Close()
}

func (s *FileSource) Read(p []byte) (n int, err error) {
	if s.file == nil {
		return 0, io.EOF
	}
	if n, err = s.file.Read(p); n == 0 || err != nil {
		// not sure why we Close() here instead of letting
		// caller Close() when they want...
		s.file.Close()
		s.file = nil
	}
	return n, err
}

// Seek implements io.Seeker.
//
// Some notes:
//
// s.file could be nil because FileSource.Read() closes s.file at
// the end of reading a file.  If s.file is nil, Seek will reopen
// the file.
//
// The alternative is to remove the Close() in Read(),
// but leave that untouched so as not to break
// anything that depends on that behavior.
//
func (s *FileSource) Seek(offset int64, whence int) (int64, error) {
	if s.file == nil {
		// the file could be nil because Read(...) closes
		// at the end of reading.  Reopen it here:
		if err := s.Open(); err != nil {
			return 0, err
		}
	}
	return s.file.Seek(offset, whence)
}

type StdoutSink struct {
	open bool
}

func (s *StdoutSink) Open() error {
	s.open = true
	return nil
}

func (s *StdoutSink) Close() error {
	s.open = false
	return nil
}

func (s *StdoutSink) Write(b []byte) (n int, err error) {
	return os.Stdout.Write(b)
}

func (s *StdoutSink) HitError(e error) error { return nil }

// EscapedSink can be used to write data to the underlying Sink, while transparently sanitizing it.
// If an error occurs writing to an EscapedSink, no more data will be
// accepted and all subsequent writes will return the error.
type EscapedSink struct {
	err error
	Sink
}

// Write writes p to the underlying Sink, after sanitizing it.
// It returns n = len(p) on a successful write (regardless of how much data is written to the underlying Sink).
// This is because the escaping function might alter the actual dimension of the data, but the caller is interested
// in knowing how much of what they wanted to write was actually written. In case of errors it (conservatively) returns n=0
// and the error, and no other writes are possible.
func (s *EscapedSink) Write(p []byte) (int, error) {
	if s.err != nil {
		return 0, s.err
	}
	_, err := s.Sink.Write(terminalescaper.CleanBytes(p))
	if err == nil {
		return len(p), nil
	}
	s.err = err
	return 0, err
}

type FileSink struct {
	libkb.Contextified
	name   string
	file   *os.File
	bufw   *bufio.Writer
	opened bool
	closed bool
	failed bool
}

func NewFileSink(g *libkb.GlobalContext, s string) *FileSink {
	return &FileSink{Contextified: libkb.NewContextified(g), name: s}
}

func (s *FileSink) Open() error {
	// Lazy-open on first write
	return nil
}

func (s *FileSink) lazyOpen() error {
	var err error
	if s.closed {
		err = fmt.Errorf("file was already closed")
	} else if s.failed {
		err = fmt.Errorf("open previously failed")
	} else if !s.opened {
		flags := os.O_WRONLY | os.O_CREATE | os.O_TRUNC
		mode := libkb.UmaskablePermFile
		f, err := os.OpenFile(s.name, flags, mode)
		if err != nil {
			s.failed = true
			return fmt.Errorf("Failed to open %s for writing: %s",
				s.name, err)
		}
		if err := isValidFile(f); err != nil {
			s.failed = true
			return err
		}
		s.file = f
		s.bufw = bufio.NewWriter(f)
		s.opened = true
	}
	return err
}

func (s *FileSink) Write(b []byte) (n int, err error) {
	if err = s.lazyOpen(); err != nil {
		return
	}
	return s.bufw.Write(b)
}

func (s *FileSink) Close() error {
	var err error
	if s.opened && !s.closed {
		s.bufw.Flush()
		err = s.file.Close()
		s.file = nil
		s.bufw = nil
		s.closed = true
	}
	return err
}

func (s *FileSink) HitError(e error) error {
	var err error
	if e != nil && s.opened {
		s.G().Log.Debug("Deleting file %s after error %s", s.name, e)
		err = os.Remove(s.name)
	}
	return err

}

type UnixFilter struct {
	libkb.Contextified
	sink    Sink
	source  Source
	msg     string // input
	infile  string
	outfile string
}

func initSink(g *libkb.GlobalContext, fn string) Sink {
	if len(fn) == 0 || fn == "-" {
		if g.Env.GetDisplayRawUntrustedOutput() || !isatty.IsTerminal(os.Stdout.Fd()) {
			return &StdoutSink{}
		}
		return &EscapedSink{Sink: &StdoutSink{}}
	}
	return NewFileSink(g, fn)
}

var ErrDuplicateSource = errors.New("Can't handle both a passed message and an infile")

func initSource(msg, infile string) (Source, error) {
	if len(msg) > 0 && len(infile) > 0 {
		return nil, ErrDuplicateSource
	}
	if len(msg) > 0 {
		return NewBufferSource(msg), nil
	}
	if len(infile) == 0 || infile == "-" {
		return &StdinSource{}, nil
	}
	return NewFileSource(infile), nil
}

func (u *UnixFilter) FilterInit(g *libkb.GlobalContext, msg, infile, outfile string) (err error) {
	if len(msg) > 0 && len(infile) > 0 {
		return ErrDuplicateSource
	}
	u.msg = msg
	u.infile = infile
	u.outfile = outfile
	return nil
}

func (u *UnixFilter) FilterOpen(g *libkb.GlobalContext) (err error) {
	if u.source, err = initSource(u.msg, u.infile); err != nil {
		return err
	}
	u.sink = initSink(g, u.outfile)

	if err = u.sink.Open(); err != nil {
		return err
	}
	if err = u.source.Open(); err != nil {
		return err
	}
	return nil
}

func (u *UnixFilter) Close(inerr error) error {
	var e1, e2, e3 error
	if u.source != nil {
		e1 = u.source.CloseWithError(inerr)
	}
	if u.sink != nil {
		e2 = u.sink.Close()
		e3 = u.sink.HitError(inerr)
	}
	return libkb.PickFirstError(e1, e2, e3)
}

func (u *UnixFilter) ClientFilterOpen(g *libkb.GlobalContext) (snk, src keybase1.Stream, err error) {
	if err = u.FilterOpen(g); err != nil {
		return
	}
	snk = g.XStreams.ExportWriter(u.sink)
	src = g.XStreams.ExportReader(u.source)
	return
}
