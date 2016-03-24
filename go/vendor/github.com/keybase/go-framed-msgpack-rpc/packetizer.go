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

type packetHandler struct {
	dec          decoder
	reader       io.Reader
	frameDecoder *decoderWrapper
	protocols    *protocolHandler
	calls        *callContainer
}

func newPacketHandler(reader io.Reader, protocols *protocolHandler, calls *callContainer) *packetHandler {
	return &packetHandler{
		reader:       reader,
		dec:          codec.NewDecoder(reader, newCodecMsgpackHandle()),
		frameDecoder: newDecoderWrapper(),
		protocols:    protocols,
		calls:        calls,
	}
}

func (p *packetHandler) NextFrame() (rpcMessage, error) {
	bytes, err := p.loadNextFrame()
	if err != nil {
		return nil, err
	}
	if len(bytes) < 1 {
		return nil, NewPacketizerError("invalid frame size: %d", len(bytes))
	}

	// Attempt to read the fixarray
	nb := int(bytes[0])

	// Interpret the byte as the length field of a fixarray of up
	// to 15 elements: see
	// https://github.com/msgpack/msgpack/blob/master/spec.md#formats-array
	// . Do this so we can decode directly into the expected
	// fields without copying.
	if nb < 0x91 || nb > 0x9f {
		return nil, NewPacketizerError("wrong message structure prefix (%d)", nb)
	}
	p.frameDecoder.ResetBytes(bytes[1:])

	return decodeRPC(nb-0x90, p.frameDecoder, p.protocols, p.calls)
}

func (p *packetHandler) loadNextFrame() ([]byte, error) {
	// Get the packet length
	var l int
	if err := p.dec.Decode(&l); err != nil {
		if _, ok := err.(*net.OpError); ok {
			// If the connection is reset or has been closed on this side,
			// return EOF
			return nil, io.EOF
		}
		return nil, err
	}

	bytes := make([]byte, l)
	lenRead, err := io.ReadFull(p.reader, bytes)
	if err != nil {
		return nil, err
	}
	if lenRead != l {
		return nil, fmt.Errorf("Unable to read desired length. Desired: %d, actual: %d", l, lenRead)
	}
	return bytes, nil
}
