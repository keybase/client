package chat

import (
	"bufio"
	"io"
	"os"
	"path/filepath"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type assetSource interface {
	FileSize() int
	Basename() string
	Open(sessionID int, cli *keybase1.StreamUiClient) (ReadResetter, error)
	Close() error
}

type streamSource struct {
	chat1.LocalSource
	buf *libkb.RemoteStreamBuffered
}

func newStreamSource(s chat1.LocalSource) *streamSource {
	return &streamSource{LocalSource: s}
}

func (s *streamSource) FileSize() int {
	return s.Size
}

func (s *streamSource) Basename() string {
	return filepath.Base(s.Filename)
}

func (s *streamSource) Open(sessionID int, cli *keybase1.StreamUiClient) (ReadResetter, error) {
	s.buf = libkb.NewRemoteStreamBuffered(s.Source, cli, sessionID)
	return s.buf, nil
}

func (s *streamSource) Close() error {
	return s.buf.Close()
}

type fileSource struct {
	chat1.LocalFileSource
	info os.FileInfo
	buf  *fileReadResetter
}

func newFileSource(s chat1.LocalFileSource) (*fileSource, error) {
	i, err := os.Stat(s.Filename)
	if err != nil {
		return nil, err
	}
	return &fileSource{
		LocalFileSource: s,
		info:            i,
	}, nil
}

func (f *fileSource) FileSize() int {
	return int(f.info.Size())
}

func (f *fileSource) Basename() string {
	return f.info.Name()
}

func (f *fileSource) Open(sessionID int, cli *keybase1.StreamUiClient) (ReadResetter, error) {
	buf, err := newFileReadResetter(f.Filename)
	if err != nil {
		return nil, err
	}
	f.buf = buf
	return f.buf, nil
}

func (f *fileSource) Close() error {
	if f.buf != nil {
		return f.buf.Close()
	}
	return nil
}

type fileReadResetter struct {
	filename string
	file     *os.File
	buf      *bufio.Reader
}

func newFileReadResetter(name string) (*fileReadResetter, error) {
	f := &fileReadResetter{filename: name}
	if err := f.open(); err != nil {
		return nil, err
	}
	return f, nil
}

func (f *fileReadResetter) open() error {
	ff, err := os.Open(f.filename)
	if err != nil {
		return err
	}
	f.file = ff
	f.buf = bufio.NewReader(f.file)
	return nil
}

func (f *fileReadResetter) Read(p []byte) (int, error) {
	return f.buf.Read(p)
}

func (f *fileReadResetter) Reset() error {
	_, err := f.file.Seek(0, io.SeekStart)
	if err != nil {
		return err
	}
	f.buf.Reset(f.file)
	return nil
}

func (f *fileReadResetter) Close() error {
	f.buf = nil
	if f.file != nil {
		return f.file.Close()
	}
	return nil
}
