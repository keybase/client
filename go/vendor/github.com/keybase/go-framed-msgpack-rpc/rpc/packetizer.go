package rpc

import (
	"bufio"
	"fmt"
	"io"
	"net"

	"github.com/keybase/go-codec/codec"
)

// lastErrReader stores the last error returned by its child
// reader. It's used by NextFrame below.
type lastErrReader struct {
	reader *bufio.Reader
	err    error
}

func (r *lastErrReader) Read(buf []byte) (int, error) {
	n, err := r.reader.Read(buf)
	r.err = err
	return n, err
}

type packetizer struct {
	maxFrameLength      int32
	lengthDecoder       *codec.Decoder
	reader              *lastErrReader
	protocols           *protocolHandler
	calls               *callContainer
	compressorCacher    *compressorCacher
	instrumenterStorage NetworkInstrumenterStorage
	log                 LogInterface
}

func newPacketizer(maxFrameLength int32, reader io.Reader, protocols *protocolHandler, calls *callContainer,
	log LogInterface, instrumenterStorage NetworkInstrumenterStorage) *packetizer {
	wrappedReader := &lastErrReader{bufio.NewReader(reader), nil}
	return &packetizer{
		maxFrameLength:      maxFrameLength,
		lengthDecoder:       codec.NewDecoder(wrappedReader, newCodecMsgpackHandle()),
		reader:              wrappedReader,
		protocols:           protocols,
		calls:               calls,
		compressorCacher:    newCompressorCacher(),
		log:                 log,
		instrumenterStorage: instrumenterStorage,
	}
}

// frameReader is a wrapper around a *bufio.Reader that reads a single
// frame with known size.
type frameReader struct {
	r         *bufio.Reader
	remaining int32
	totalSize int32
	log       LogInterface
}

func newFrameReader(reader *bufio.Reader, totalSize int32, log LogInterface) *frameReader {
	return &frameReader{
		r:         reader,
		totalSize: totalSize,
		remaining: totalSize,
		log:       log,
	}
}

func (l *frameReader) ReadByte() (byte, error) {
	if l.remaining <= 0 {
		return 0, io.EOF
	}

	b, err := l.r.ReadByte()
	// ReadByte() returning a non-nil error is equivalent to
	// Read() returning (0, err).
	if err == nil {
		l.remaining--
		l.log.FrameRead([]byte{b})
	} else if err == io.EOF {
		err = io.ErrUnexpectedEOF
	}

	return b, err
}

func (l *frameReader) Read(p []byte) (int, error) {
	if l.remaining <= 0 {
		return 0, io.EOF
	}

	if len(p) > int(l.remaining) {
		p = p[:l.remaining]
	}

	n, err := l.r.Read(p)
	l.remaining -= int32(n)
	if n > 0 {
		l.log.FrameRead(p[:n])
	}
	if err == io.EOF {
		err = io.ErrUnexpectedEOF
	}
	return n, err
}

func (l *frameReader) drain() error {
	n, err := l.r.Discard(int(l.remaining))
	l.remaining -= int32(n)

	if l.remaining != 0 && err == io.EOF {
		return io.ErrUnexpectedEOF
	} else if err != nil {
		return err
	}

	// Shouldn't happen, but handle it anyway.
	if l.remaining != 0 {
		return fmt.Errorf("Unexpected remaining %d", l.remaining)
	}

	return nil
}

var _ io.Reader = (*frameReader)(nil)

// NextFrame returns the next message and an error. The error can be:
//
//   - nil, in which case the returned rpcMessage will be non-nil.
//   - a framing error, i.e. having to do with reading the packet
//     length or the packet bytes. This is a fatal error, and the
//     connection must be closed.
//   - an error while decoding the packet. In theory, we can then
//     discard the packet and move on to the next one, but the
//     semantics of doing so aren't clear. Currently we also treat this
//     as a fatal error.
//   - an error while decoding the message, in which case the returned
//     rpcMessage will be non-nil, and its Err() will match this
//     error. We can then process the error and continue with the next
//     packet.
func (p *packetizer) NextFrame() (msg rpcMessage, err error) {
	// Get the packet length.
	var l int32
	if err := p.lengthDecoder.Decode(&l); err != nil {
		// If the connection is reset or has been closed on
		// this side, return EOF. lengthDecoder wraps most
		// errors, so we have to check p.reader.err instead of
		// err.
		if _, ok := p.reader.err.(*net.OpError); ok {
			return nil, io.EOF
		}
		return nil, err
	}
	if l <= 0 {
		return nil, NewPacketizerError("invalid frame length: %d", l)
	}

	if l > p.maxFrameLength {
		return nil, NewPacketizerError("frame length too big: %d > %d", l, p.maxFrameLength)
	}

	r := newFrameReader(p.reader.reader, l, p.log)
	defer func() {
		drainErr := r.drain()
		if drainErr != nil && err == nil {
			msg = nil
			err = drainErr
		}
	}()

	nb, err := r.ReadByte()
	if err != nil {
		return nil, err
	}

	// Interpret the byte as the length field of a fixarray of up
	// to 15 elements: see
	// https://github.com/msgpack/msgpack/blob/master/spec.md#formats-array
	// for details. Do this so we can decode directly into the
	// expected fields without copying.
	if nb < 0x91 || nb > 0x9f {
		return nil, NewPacketizerError("wrong message structure prefix (0x%x)", nb)
	}

	return decodeRPC(int(nb-0x90), r, p.protocols, p.calls, p.compressorCacher, p.instrumenterStorage)
}
