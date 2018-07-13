package attachments

import (
	"bufio"
	"bytes"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type AssetSource interface {
	FileSize() int
	Basename() string
	Open(sessionID int, cli *keybase1.StreamUiClient) (ReadResetter, error)
	Close() error
}

type HTTPSource struct {
	*BufferSource
}

func NewHTTPSource(url string) (*HTTPSource, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return &HTTPSource{
		BufferSource: newBufferSource(bytes.NewBuffer(body), "http"),
	}, nil
}

type StreamSource struct {
	chat1.LocalSource
	buf *libkb.RemoteStreamBuffered
}

func NewStreamSource(s chat1.LocalSource) *StreamSource {
	return &StreamSource{LocalSource: s}
}

func (s *StreamSource) FileSize() int {
	return s.Size
}

func (s *StreamSource) Basename() string {
	return filepath.Base(s.Filename)
}

func (s *StreamSource) Open(sessionID int, cli *keybase1.StreamUiClient) (ReadResetter, error) {
	s.buf = libkb.NewRemoteStreamBuffered(s.Source, cli, sessionID)
	return s.buf, nil
}

func (s *StreamSource) Close() error {
	return s.buf.Close()
}

type FileSource struct {
	chat1.LocalFileSource
	info os.FileInfo
	buf  *fileReadResetter
}

func NewFileSource(s chat1.LocalFileSource) (*FileSource, error) {
	i, err := os.Stat(s.Filename)
	if err != nil {
		return nil, err
	}
	return &FileSource{
		LocalFileSource: s,
		info:            i,
	}, nil
}

func (f *FileSource) FileSize() int {
	return int(f.info.Size())
}

func (f *FileSource) Basename() string {
	return f.info.Name()
}

func (f *FileSource) Open(sessionID int, cli *keybase1.StreamUiClient) (ReadResetter, error) {
	buf, err := newFileReadResetter(f.Filename)
	if err != nil {
		return nil, err
	}
	f.buf = buf
	return f.buf, nil
}

func (f *FileSource) Close() error {
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
