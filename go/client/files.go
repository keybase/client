package client

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"os"

	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

type Source interface {
	io.ReadCloser
	Open() error
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

func (b *BufferSource) Close() error { return nil }

type StdinSource struct {
	open bool
}

func (b *StdinSource) Open() error {
	b.open = true
	return nil
}

func (b *StdinSource) Close() error {
	b.open = false
	return nil
}

func (b *StdinSource) Read(p []byte) (n int, err error) {
	if b.open {
		return os.Stdin.Read(p)
	} else {
		return 0, io.EOF
	}
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
	s.file = f
	return nil
}

func (s *FileSource) Close() error {
	if s.file != nil {
		err := s.file.Close()
		s.file = nil
		return err
	} else {
		return io.EOF
	}
}

func (s *FileSource) Read(p []byte) (n int, err error) {
	if s.file == nil {
		return 0, io.EOF
	} else {
		return s.file.Read(p)
	}
}

type StdoutSink struct {
	open bool
}

func (s *StdoutSink) Open() error {
	s.open = true
	return nil
}

func (s *StdoutSink) Close() error {
	if !s.open {
		return io.EOF
	}
	s.open = false
	return nil
}

func (s *StdoutSink) Write(b []byte) (n int, err error) {
	return os.Stdout.Write(b)
}

func (s *StdoutSink) HitError(e error) error { return nil }

type FileSink struct {
	name   string
	file   *os.File
	bufw   *bufio.Writer
	opened bool
	closed bool
	failed bool
}

func NewFileSink(s string) *FileSink {
	return &FileSink{name: s}
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
		mode := libkb.UMASKABLE_PERM_FILE
		f, err := os.OpenFile(s.name, flags, mode)
		if err != nil {
			s.failed = true
			return fmt.Errorf("Failed to open %s for writing: %s",
				s.name, err.Error())
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
		G.Log.Debug("Deleting file %s after error %s", s.name, e.Error())
		err = os.Remove(s.name)
	}
	return err

}

type UnixFilter struct {
	sink   Sink
	source Source
}

func initSink(fn string) Sink {
	var ret Sink
	if len(fn) == 0 || fn == "-" {
		ret = &StdoutSink{}
	} else {
		ret = NewFileSink(fn)
	}
	return ret
}

func initSource(msg, infile string) (src Source, err error) {
	if len(msg) > 0 && len(infile) > 0 {
		err = fmt.Errorf("Can't handle both a passed message and an infile")
	} else if len(msg) > 0 {
		src = NewBufferSource(msg)
	} else if len(infile) == 0 || infile == "-" {
		src = &StdinSource{}
	} else {
		src = NewFileSource(infile)
	}
	return
}

func (u *UnixFilter) FilterInit(msg, infile, outfile string) (err error) {
	u.source, err = initSource(msg, infile)
	if err == nil {
		u.sink = initSink(outfile)
	}
	return err
}

func (u *UnixFilter) FilterOpen() error {
	err := u.sink.Open()
	if err == nil {
		err = u.source.Open()
	}
	return err
}

func (u *UnixFilter) Close(inerr error) error {
	e1 := u.source.Close()
	e2 := u.sink.Close()
	e3 := u.sink.HitError(inerr)
	return libkb.PickFirstError(e1, e2, e3)
}

func (u *UnixFilter) ClientFilterOpen() (snk, src keybase_1.Stream, err error) {
	if err = u.FilterOpen(); err != nil {
		return
	}
	snk = G.XStreams.ExportWriter(u.sink)
	src = G.XStreams.ExportReader(u.source)
	return
}
