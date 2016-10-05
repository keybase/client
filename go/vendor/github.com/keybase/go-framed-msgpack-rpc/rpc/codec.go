package rpc

import (
	"io"

	"github.com/keybase/go-codec/codec"
	"golang.org/x/net/context"
)

type decoder interface {
	Decode(interface{}) error
}

type encoder interface {
	EncodeAndWrite(context.Context, interface{}) <-chan error
	EncodeAndWriteAsync(interface{}) <-chan error
}

type decoderWrapper struct {
	*codec.Decoder
	fieldNumber int
}

func newDecoderWrapper() *decoderWrapper {
	return &decoderWrapper{
		Decoder:     codec.NewDecoderBytes([]byte{}, newCodecMsgpackHandle()),
		fieldNumber: 0,
	}
}

func (dw *decoderWrapper) Decode(i interface{}) error {
	defer func() {
		dw.fieldNumber++
	}()

	err := dw.Decoder.Decode(i)
	if err != nil {
		return newRPCMessageFieldDecodeError(dw.fieldNumber, err)
	}
	return nil
}

func (dw *decoderWrapper) ResetBytes(b []byte) {
	dw.fieldNumber = 0
	dw.Decoder.ResetBytes(b)
}

func newCodecMsgpackHandle() codec.Handle {
	return &codec.MsgpackHandle{
		WriteExt:    true,
		RawToString: true,
	}
}

type writeBundle struct {
	bytes []byte
	ch    chan error
}

type framedMsgpackEncoder struct {
	handle   codec.Handle
	writer   io.Writer
	writeCh  chan writeBundle
	doneCh   chan struct{}
	closedCh chan struct{}
}

func newFramedMsgpackEncoder(writer io.Writer) *framedMsgpackEncoder {
	e := &framedMsgpackEncoder{
		handle:   newCodecMsgpackHandle(),
		writer:   writer,
		writeCh:  make(chan writeBundle),
		doneCh:   make(chan struct{}),
		closedCh: make(chan struct{}),
	}
	go e.writerLoop()
	return e
}

func (e *framedMsgpackEncoder) encodeToBytes(enc *codec.Encoder, i interface{}) (v []byte, err error) {
	enc.ResetBytes(&v)
	err = enc.Encode(i)
	return v, err
}

func (e *framedMsgpackEncoder) encodeFrame(i interface{}) ([]byte, error) {
	enc := codec.NewEncoderBytes(&[]byte{}, e.handle)
	content, err := e.encodeToBytes(enc, i)
	if err != nil {
		return nil, err
	}
	length, err := e.encodeToBytes(enc, len(content))
	if err != nil {
		return nil, err
	}
	return append(length, content...), nil
}

func (e *framedMsgpackEncoder) EncodeAndWrite(ctx context.Context, i interface{}) <-chan error {
	bytes, err := e.encodeFrame(i)
	ch := make(chan error, 1)
	if err != nil {
		ch <- err
		return ch
	}
	select {
	case <-e.doneCh:
		ch <- io.EOF
	case <-ctx.Done():
		ch <- ctx.Err()
	case e.writeCh <- writeBundle{bytes, ch}:
	}
	return ch
}

func (e *framedMsgpackEncoder) EncodeAndWriteAsync(i interface{}) <-chan error {
	bytes, err := e.encodeFrame(i)
	ch := make(chan error, 1)
	if err != nil {
		ch <- err
		return ch
	}
	select {
	case <-e.doneCh:
		ch <- io.EOF
	case e.writeCh <- writeBundle{bytes, ch}:
	default:
		go func() {
			select {
			case <-e.doneCh:
				ch <- io.EOF
			case e.writeCh <- writeBundle{bytes, ch}:
			}
		}()
	}
	return ch
}

func (e *framedMsgpackEncoder) writerLoop() {
	for {
		select {
		case <-e.doneCh:
			close(e.closedCh)
			return
		case write := <-e.writeCh:
			_, err := e.writer.Write(write.bytes)
			write.ch <- err
		}
	}
}

func (e *framedMsgpackEncoder) Close() <-chan struct{} {
	close(e.doneCh)
	return e.closedCh
}
