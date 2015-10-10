package rpc

import (
	"github.com/ugorji/go/codec"
	"io"
)

type decoder interface {
	Decode(interface{}) error
}

type byteReadingDecoder interface {
	decoder
	io.ByteReader
}

type encoder interface {
	Encode(interface{}) error
}

type framedMsgpackEncoder struct {
	handle   codec.Handle
	writeCh  chan []byte
	resultCh chan error
}

func newFramedMsgpackEncoder(writeCh chan []byte, resultCh chan error) *framedMsgpackEncoder {
	mh := &codec.MsgpackHandle{WriteExt: true}
	return &framedMsgpackEncoder{
		handle:   mh,
		writeCh:  writeCh,
		resultCh: resultCh,
	}
}

func (e *framedMsgpackEncoder) encodeToBytes(i interface{}) (v []byte, err error) {
	enc := codec.NewEncoderBytes(&v, e.handle)
	if err = enc.Encode(i); err != nil {
		return
	}
	return
}

func (e *framedMsgpackEncoder) encodeFrame(i interface{}) (bytes []byte, err error) {
	var length, content []byte
	if content, err = e.encodeToBytes(i); err != nil {
		return
	}
	l := len(content)
	if length, err = e.encodeToBytes(l); err != nil {
		return
	}
	bytes = append(length, content...)
	return bytes, nil
}

func (e *framedMsgpackEncoder) Encode(i interface{}) error {
	bytes, err := e.encodeFrame(i)
	if err != nil {
		return err
	}
	e.writeCh <- bytes
	return <-e.resultCh
}

type byteResult struct {
	b   byte
	err error
}

type framedMsgpackDecoder struct {
	decoderCh        chan interface{}
	decoderResultCh  chan error
	readByteCh       chan struct{}
	readByteResultCh chan byteResult
}

func newFramedMsgpackDecoder(decoderCh chan interface{}, decoderResultCh chan error, readByteCh chan struct{}, readByteResultCh chan byteResult) *framedMsgpackDecoder {
	return &framedMsgpackDecoder{
		decoderCh:        decoderCh,
		decoderResultCh:  decoderResultCh,
		readByteCh:       readByteCh,
		readByteResultCh: readByteResultCh,
	}
}

func (t *framedMsgpackDecoder) ReadByte() (byte, error) {
	t.readByteCh <- struct{}{}
	byteRes := <-t.readByteResultCh
	return byteRes.b, byteRes.err
}

func (t *framedMsgpackDecoder) Decode(i interface{}) error {
	t.decoderCh <- i
	return <-t.decoderResultCh
}
