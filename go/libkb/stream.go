package libkb

import (
	keybase_1 "github.com/keybase/client/protocol/go"
	"io"
	"sync"
)

type ReadCloser struct {
	f keybase_1.Stream
}

type ExportedStream struct {
	r io.ReadCloser
	w io.WriteCloser
	i int
}

type ExportedStreams struct {
	m map[int]*ExportedStream
	i int
	sync.Mutex
}

func NewExportedStreams() *ExportedStreams {
	return &ExportedStreams{
		m: make(map[int]*ExportedStream),
		i: 0,
	}
}

func (s *ExportedStreams) ExportWriter(w io.WriteCloser) keybase_1.Stream {
	es := s.alloc()
	es.w = w
	return es.Export()
}

func (s *ExportedStreams) ExportReader(r io.ReadCloser) keybase_1.Stream {
	es := s.alloc()
	es.r = r
	return es.Export()
}

func (s *ExportedStreams) alloc() (ret *ExportedStream) {
	s.Lock()
	defer s.Unlock()
	s.i++
	i := s.i
	ret = &ExportedStream{i: i}
	s.m[i] = ret
	return ret
}

func (e *ExportedStream) Export() keybase_1.Stream {
	return keybase_1.Stream{Fd: e.i}
}

func (e *ExportedStreams) GetWriter(s keybase_1.Stream) (ret io.WriteCloser, err error) {
	e.Lock()
	defer e.Unlock()
	if obj, found := e.m[s.Fd]; !found {
		err = StreamNotFoundError{}
	} else if obj.w == nil {
		err = StreamWrongKindError{}
	} else {
		ret = obj.w
	}
	return
}

func (e *ExportedStreams) GetReader(s keybase_1.Stream) (ret io.ReadCloser, err error) {
	e.Lock()
	defer e.Unlock()
	if obj, found := e.m[s.Fd]; !found {
		err = StreamNotFoundError{}
	} else if obj.r == nil {
		err = StreamWrongKindError{}
	} else {
		ret = obj.r
	}
	return
}

func (e *ExportedStreams) Close(s keybase_1.Stream) (err error) {
	e.Lock()
	defer e.Unlock()
	if obj, found := e.m[s.Fd]; !found {
		err = StreamNotFoundError{}
	} else {
		if obj.w != nil {
			err = obj.w.Close()
		}
		if obj.r != nil {
			tmp := obj.r.Close()
			if tmp != nil && err == nil {
				err = tmp
			}
		}
		delete(e.m, s.Fd)
	}
	return err
}

func (e *ExportedStreams) Read(a keybase_1.ReadArg) (buf []byte, err error) {
	var r io.ReadCloser
	if r, err = e.GetReader(a.S); err != nil {
		return
	}
	var n int
	buf = make([]byte, a.Sz)
	n, err = r.Read(buf)
	buf = buf[0:n]
	return
}

func (e *ExportedStreams) Write(a keybase_1.WriteArg) (n int, err error) {
	var w io.WriteCloser
	if w, err = e.GetWriter(a.S); err != nil {
		return
	}
	n, err = w.Write(a.Buf)
	return
}

type RemoteStream struct {
	Stream keybase_1.Stream
	Cli    *keybase_1.StreamUiClient
}

func (ewc RemoteStream) Write(buf []byte) (n int, err error) {
	return ewc.Cli.Write(keybase_1.WriteArg{S: ewc.Stream, Buf: buf})
}

func (ewc RemoteStream) Close() (err error) {
	return ewc.Cli.Close(ewc.Stream)
}

func (ewc RemoteStream) Read(buf []byte) (n int, err error) {
	var tmp []byte
	if tmp, err = ewc.Cli.Read(keybase_1.ReadArg{S: ewc.Stream, Sz: len(buf)}); err == nil {
		n = len(tmp)
		copy(buf, tmp)
	}
	return
}
