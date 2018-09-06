package rpc

import (
	"fmt"
	"io"
	"net"

	"github.com/keybase/go-codec/codec"
)

type packetizer interface {
	NextFrame() (rpcMessage, error)
}

// lastErrReader stores the last error returned by its child
// reader. It's used by loadNextFrame below.
type lastErrReader struct {
	reader io.Reader
	err    error
}

func (r *lastErrReader) Read(buf []byte) (int, error) {
	n, err := r.reader.Read(buf)
	r.err = err
	return n, err
}

type packetHandler struct {
	lengthDecoder *codec.Decoder
	reader        *lastErrReader
	fieldDecoder  *fieldDecoder
	protocols     *protocolHandler
	calls         *callContainer
	log           LogInterface
}

func newPacketHandler(reader io.Reader, protocols *protocolHandler, calls *callContainer, log LogInterface) *packetHandler {
	wrappedReader := &lastErrReader{reader, nil}
	return &packetHandler{
		lengthDecoder: codec.NewDecoder(wrappedReader, newCodecMsgpackHandle()),
		reader:        wrappedReader,
		fieldDecoder:  newFieldDecoder(),
		protocols:     protocols,
		calls:         calls,
		log:           log,
	}
}

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
func (p *packetHandler) NextFrame() (rpcMessage, error) {
	bytes, err := p.loadNextFrame()
	if err != nil {
		return nil, err
	}
	if len(bytes) < 1 {
		return nil, NewPacketizerError("invalid frame size: %d", len(bytes))
	}

	// Log the bytes as the last thing, just in case the logger
	// mutates those bytes (which it shouldn't).
	defer func() {
		p.log.FrameRead(bytes)
	}()

	// Attempt to read the fixarray
	nb := int(bytes[0])

	// Interpret the byte as the length field of a fixarray of up
	// to 15 elements: see
	// https://github.com/msgpack/msgpack/blob/master/spec.md#formats-array
	// for details. Do this so we can decode directly into the
	// expected fields without copying.
	if nb < 0x91 || nb > 0x9f {
		return nil, NewPacketizerError("wrong message structure prefix (%d)", nb)
	}
	p.fieldDecoder.ResetBytes(bytes[1:])

	return decodeRPC(nb-0x90, p.fieldDecoder, p.protocols, p.calls)
}

func (p *packetHandler) loadNextFrame() ([]byte, error) {
	// Get the packet length
	var l int
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
	if l < 0 {
		return nil, PacketizerError{fmt.Sprintf("invalid frame length: %d", l)}
	}

	bytes := make([]byte, l)
	// Note that ReadFull drops the error returned from p.reader
	// if enough bytes are read. This isn't a big deal, as if it's
	// a serious error we'll probably run it again on the next
	// frame read.
	lenRead, err := io.ReadFull(p.reader, bytes)
	if err != nil {
		return nil, err
	}
	if lenRead != l {
		return nil, fmt.Errorf("Unable to read desired length. Desired: %d, actual: %d", l, lenRead)
	}
	return bytes, nil
}
