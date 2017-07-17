// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bufio"
	"io"
	"sync"

	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type ReadCloser struct {
	f keybase1.Stream
}

type ReadCloseSeeker interface {
	io.ReadCloser
	io.Seeker
}

type ExportedStream struct {
	// r io.ReadCloser
	r ReadCloseSeeker
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

func (s *ExportedStreams) ExportWriter(w io.WriteCloser) keybase1.Stream {
	es := s.alloc()
	es.w = w
	return es.Export()
}

func (s *ExportedStreams) ExportReader(r ReadCloseSeeker) keybase1.Stream {
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

func (s *ExportedStream) Export() keybase1.Stream {
	return keybase1.Stream{Fd: s.i}
}

func (s *ExportedStreams) GetWriter(st keybase1.Stream) (ret io.WriteCloser, err error) {
	s.Lock()
	defer s.Unlock()
	if obj, found := s.m[st.Fd]; !found {
		err = StreamNotFoundError{}
	} else if obj.w == nil {
		err = StreamWrongKindError{}
	} else {
		ret = obj.w
	}
	return
}

func (s *ExportedStreams) GetReader(st keybase1.Stream) (ret io.ReadCloser, err error) {
	s.Lock()
	defer s.Unlock()
	if obj, found := s.m[st.Fd]; !found {
		err = StreamNotFoundError{}
	} else if obj.r == nil {
		err = StreamWrongKindError{}
	} else {
		ret = obj.r
	}
	return
}

func (s *ExportedStreams) Close(_ context.Context, a keybase1.CloseArg) (err error) {
	s.Lock()
	defer s.Unlock()
	if obj, found := s.m[a.S.Fd]; !found {
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
		delete(s.m, a.S.Fd)
	}
	return err
}

func (s *ExportedStreams) Read(_ context.Context, a keybase1.ReadArg) (buf []byte, err error) {
	var r io.ReadCloser
	if r, err = s.GetReader(a.S); err != nil {
		return
	}
	var n int
	buf = make([]byte, a.Sz)
	n, err = r.Read(buf)
	buf = buf[0:n]
	return
}

func (s *ExportedStreams) Write(_ context.Context, a keybase1.WriteArg) (n int, err error) {
	var w io.WriteCloser
	if w, err = s.GetWriter(a.S); err != nil {
		return
	}
	n, err = w.Write(a.Buf)
	return
}

func (s *ExportedStreams) Reset(_ context.Context, a keybase1.ResetArg) error {
	s.Lock()
	defer s.Unlock()

	obj, found := s.m[a.S.Fd]
	if !found || obj.r == nil {
		return StreamNotFoundError{}
	}

	_, err := obj.r.Seek(0, io.SeekStart)
	return err
}

type RemoteStream struct {
	Stream    keybase1.Stream
	Cli       *keybase1.StreamUiClient
	SessionID int
}

func (ewc RemoteStream) Write(buf []byte) (n int, err error) {
	return ewc.Cli.Write(context.TODO(), keybase1.WriteArg{S: ewc.Stream, Buf: buf, SessionID: ewc.SessionID})
}

func (ewc RemoteStream) Close() (err error) {
	return ewc.Cli.Close(context.TODO(), keybase1.CloseArg{S: ewc.Stream, SessionID: ewc.SessionID})
}

func (ewc RemoteStream) Read(buf []byte) (n int, err error) {
	var tmp []byte
	if tmp, err = ewc.Cli.Read(context.TODO(), keybase1.ReadArg{S: ewc.Stream, Sz: len(buf), SessionID: ewc.SessionID}); err == nil {
		n = len(tmp)
		copy(buf, tmp)
	}
	return
}

func (ewc RemoteStream) Reset() (err error) {
	return ewc.Cli.Reset(context.TODO(), keybase1.ResetArg{S: ewc.Stream, SessionID: ewc.SessionID})
}

type RemoteStreamBuffered struct {
	rs *RemoteStream
	r  *bufio.Reader
	w  *bufio.Writer
}

func NewRemoteStreamBuffered(s keybase1.Stream, c *keybase1.StreamUiClient, sessionID int) *RemoteStreamBuffered {
	x := &RemoteStreamBuffered{
		rs: &RemoteStream{Stream: s, Cli: c, SessionID: sessionID},
	}
	x.createBufs()
	return x
}

func (x *RemoteStreamBuffered) Write(p []byte) (int, error) {
	return x.w.Write(p)
}

func (x *RemoteStreamBuffered) Read(p []byte) (int, error) {
	return x.r.Read(p)
}

func (x *RemoteStreamBuffered) Close() error {
	x.w.Flush()
	return x.rs.Close()
}

func (x *RemoteStreamBuffered) Reset() (err error) {
	x.w.Flush()
	if err := x.rs.Reset(); err != nil {
		return err
	}
	x.createBufs()
	return nil
}

func (x *RemoteStreamBuffered) createBufs() {
	x.r = bufio.NewReader(x.rs)
	x.w = bufio.NewWriter(x.rs)
}
