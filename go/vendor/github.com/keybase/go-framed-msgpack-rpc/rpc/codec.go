package rpc

import (
	"fmt"
	"io"

	"github.com/keybase/go-codec/codec"
	"golang.org/x/net/context"
)

func newCodecMsgpackHandle() codec.Handle {
	return &codec.MsgpackHandle{
		WriteExt:    true,
		RawToString: true,
	}
}

type writeBundle struct {
	bytes []byte
	ch    chan error
	sn    func()
}

type framedMsgpackEncoder struct {
	maxFrameLength   int32
	handle           codec.Handle
	writer           io.Writer
	writeCh          chan writeBundle
	doneCh           chan struct{}
	closedCh         chan struct{}
	compressorCacher *compressorCacher
}

func newFramedMsgpackEncoder(maxFrameLength int32, writer io.Writer) *framedMsgpackEncoder {
	e := &framedMsgpackEncoder{
		maxFrameLength:   maxFrameLength,
		handle:           newCodecMsgpackHandle(),
		writer:           writer,
		writeCh:          make(chan writeBundle),
		doneCh:           make(chan struct{}),
		closedCh:         make(chan struct{}),
		compressorCacher: newCompressorCacher(),
	}
	go e.writerLoop()
	return e
}

func encodeToBytes(enc *codec.Encoder, i interface{}) (v []byte, err error) {
	enc.ResetBytes(&v)
	err = enc.Encode(i)
	return v, err
}

func (e *framedMsgpackEncoder) compressData(ctype CompressionType, i interface{}) (interface{}, error) {
	c := e.compressorCacher.getCompressor(ctype)
	if c == nil {
		return i, nil
	}
	enc := codec.NewEncoderBytes(nil, e.handle)
	content, err := encodeToBytes(enc, i)
	if err != nil {
		return nil, err
	}
	compressedContent, err := c.Compress(content)
	if err != nil {
		return nil, err
	}
	compressedI := interface{}(compressedContent)
	return compressedI, nil
}

func (e *framedMsgpackEncoder) encodeFrame(i interface{}) ([]byte, error) {
	enc := codec.NewEncoderBytes(nil, e.handle)
	content, err := encodeToBytes(enc, i)
	if err != nil {
		return nil, err
	}
	if len(content) > int(e.maxFrameLength) {
		return nil, fmt.Errorf("frame length too big: %d > %d", len(content), e.maxFrameLength)
	}
	length, err := encodeToBytes(enc, len(content))
	if err != nil {
		return nil, err
	}
	return append(length, content...), nil
}

// encodeAndWriteInternal is called directly by tests that need to
// write invalid frames.
func (e *framedMsgpackEncoder) encodeAndWriteInternal(ctx context.Context, frame interface{}, sendNotifier func()) (int64, <-chan error) {
	bytes, err := e.encodeFrame(frame)
	ch := make(chan error, 1)
	if err != nil {
		ch <- err
		return 0, ch
	}
	select {
	case <-e.doneCh:
		ch <- io.EOF
	case <-ctx.Done():
		ch <- ctx.Err()
	case e.writeCh <- writeBundle{bytes, ch, sendNotifier}:
	}
	return int64(len(bytes)), ch
}

func (e *framedMsgpackEncoder) EncodeAndWrite(ctx context.Context, frame []interface{}, sendNotifier func()) (int64, <-chan error) {
	return e.encodeAndWriteInternal(ctx, frame, sendNotifier)
}

func (e *framedMsgpackEncoder) EncodeAndWriteAsync(frame []interface{}) (int64, <-chan error) {
	bytes, err := e.encodeFrame(frame)
	ch := make(chan error, 1)
	if err != nil {
		ch <- err
		return 0, ch
	}
	select {
	case <-e.doneCh:
		ch <- io.EOF
	case e.writeCh <- writeBundle{bytes, ch, nil}:
	default:
		go func() {
			select {
			case <-e.doneCh:
				ch <- io.EOF
			case e.writeCh <- writeBundle{bytes, ch, nil}:
			}
		}()
	}
	return int64(len(bytes)), ch
}

func (e *framedMsgpackEncoder) writerLoop() {
	for {
		select {
		case <-e.doneCh:
			close(e.closedCh)
			return
		case write := <-e.writeCh:
			if write.sn != nil {
				write.sn()
			}
			_, err := e.writer.Write(write.bytes)
			write.ch <- err
		}
	}
}

func (e *framedMsgpackEncoder) Close() <-chan struct{} {
	close(e.doneCh)
	return e.closedCh
}
