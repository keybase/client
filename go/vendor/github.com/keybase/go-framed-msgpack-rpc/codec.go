package rpc

import (
	"github.com/ugorji/go/codec"
	"io"
)

// It might seem like the encoder and decoder will race, because
// we use a shared channel to deliver results. However, since
// channels are FIFO and we only consume one element at a time,
// there is no race.

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

func newMsgPackHandle() *codec.MsgpackHandle {
	return &codec.MsgpackHandle{
		WriteExt:    true,
		RawToString: true,
	}
}

func newFramedMsgpackEncoder(writeCh chan []byte, resultCh chan error) *framedMsgpackEncoder {
	return &framedMsgpackEncoder{
		handle:   newMsgPackHandle(),
		writeCh:  writeCh,
		resultCh: resultCh,
	}
}

func (e *framedMsgpackEncoder) encodeToBytes(i interface{}) (v []byte, err error) {
	enc := codec.NewEncoderBytes(&v, e.handle)
	err = enc.Encode(i)
	return v, err
}

func (e *framedMsgpackEncoder) encodeFrame(i interface{}) ([]byte, error) {
	content, err := e.encodeToBytes(i)
	if err != nil {
		return nil, err
	}
	length, err := e.encodeToBytes(len(content))
	if err != nil {
		return nil, err
	}
	return append(length, content...), nil
}

func (e *framedMsgpackEncoder) Encode(i interface{}) error {
	bytes, err := e.encodeFrame(i)
	if err != nil {
		return err
	}
	e.writeCh <- bytes
	// See comment above regarding potential race
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
	// See comment above regarding potential race
	byteRes := <-t.readByteResultCh
	return byteRes.b, byteRes.err
}

func (t *framedMsgpackDecoder) Decode(i interface{}) error {
	t.decoderCh <- i
	// See comment above regarding potential race
	return <-t.decoderResultCh
}
