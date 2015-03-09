package libkb

import (
	keybase_1 "github.com/keybase/client/protocol/go"
	"io"
	"sync"
)

type ReadCloser struct {
	f keybase_1.AvdlFile
}

type ExportedStream struct {
	r io.ReadCloser
	w io.WriteCloser
	i int
}

type ExportedStreams struct {
	m map[int]*ExportedStream
	sync.Mutex
}

func (s *ExportedStreams) ExportWriter(i int, w io.WriteCloser) (ret *keybase_1.Stream, err error) {
	s.Lock()
	defer s.Unlock()
	var es *ExportedStream
	if es, err = s.alloc(i); err != nil {
		return
	}
	es.w = w
	ret = es.Export()
	return
}

func (s *ExportedStreams) ExportReader(i int, r io.ReadCloser) (ret *keybase_1.Stream, err error) {
	s.Lock()
	defer s.Unlock()
	var es *ExportedStream
	if es, err = s.alloc(i); err != nil {
		return
	}
	es.r = r
	ret = es.Export()
	return
}

func (s *ExportedStreams) alloc(i int) (ret *ExportedStream, err error) {
	if _, found := s.m[i]; found {
		err = StreamExistsError{}
		return
	}
	ret = &ExportedStream{i: i}
	s.m[i] = ret
	return
}

func (e *ExportedStream) Export() *keybase_1.Stream {
	return &keybase_1.Stream{Fd: e.i}
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
	err = fixErr(err)
	return err
}

func fixErr(e error) error {
	if e == io.EOF {
		e = StreamEOF{}
	}
	return e
}

func (e *ExportedStreams) Read(a keybase_1.ReadArg) (buf []byte, err error) {
	var r io.ReadCloser
	if r, err = e.GetReader(a.S); err != nil {
		return
	}
	var n int
	buf = make([]byte, a.Sz)
	n, err = r.Read(buf)
	err = fixErr(err)
	buf = buf[0:n]
	return
}

func (e *ExportedStreams) Write(a keybase_1.WriteArg) (n int, err error) {
	var w io.WriteCloser
	if w, err = e.GetWriter(a.S); err != nil {
		return
	}
	n, err = w.Write(a.Buf)
	err = fixErr(err)
	return
}

type RemoteStream struct {
	stream keybase_1.Stream
	cli    keybase_1.StreamUiClient
}

func (ewc RemoteStream) Write(buf []byte) (n int, err error) {
	return ewc.cli.Write(keybase_1.WriteArg{S: ewc.stream, Buf: buf})
}

func (ewc RemoteStream) Close() (err error) {
	return ewc.cli.Close(ewc.stream)
}

func (ewc RemoteStream) Read(buf []byte) (n int, err error) {
	var tmp []byte
	if tmp, err = ewc.cli.Read(keybase_1.ReadArg{S: ewc.stream, Sz: len(buf)}); err == nil {
		copy(buf, tmp)
	}
	return
}
