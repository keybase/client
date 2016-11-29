package service

import (
	"bufio"
	"io"
	"os"
	"path/filepath"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type assetSource interface {
	FileSize() int
	Basename() string
	Open(sessionID int, cli *keybase1.StreamUiClient) (chat.ReadResetter, error)
}

type streamSource struct {
	chat1.LocalSource
}

func (s streamSource) FileSize() int {
	return s.Size
}

func (s streamSource) Basename() string {
	return filepath.Base(s.Filename)
}

func (s streamSource) Open(sessionID int, cli *keybase1.StreamUiClient) (chat.ReadResetter, error) {
	return libkb.NewRemoteStreamBuffered(s.Source, cli, sessionID), nil
}

type fileSource struct {
	chat1.LocalFileSource
	info os.FileInfo
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

func (f fileSource) FileSize() int {
	return int(f.info.Size())
}

func (f fileSource) Basename() string {
	return f.info.Name()
}

func (f fileSource) Open(sessionID int, cli *keybase1.StreamUiClient) (chat.ReadResetter, error) {
	return newFileReadResetter(f.Filename)
}

type fileReadResetter struct {
	filename string
	file     *os.File
	buf      *bufio.Reader
}

func newFileReadResetter(name string) (chat.ReadResetter, error) {
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
	f.buf = bufio.NewReader(f.file)
	return nil
}
