package kbcmf

import (
	"bytes"
	"github.com/ugorji/go/codec"
	"io"
)

func encodeNewPacket(w io.Writer, p interface{}) error {
	buf, err := encodeToBytes(p)
	if err != nil {
		return err
	}
	l, err := encodeToBytes(len(buf))
	if err != nil {
		return err
	}
	_, err = w.Write(append(l, buf...))
	return err
}

func encodeToBytes(i interface{}) ([]byte, error) {
	var encoded []byte
	err := codec.NewEncoderBytes(&encoded, codecHandle()).Encode(i)
	return encoded, err
}

func decodeFromBytes(p interface{}, b []byte) error {
	return codec.NewDecoderBytes(b, codecHandle()).Decode(p)
}

type peek1Buffer struct {
	bytes.Buffer
	ch *byte
}

func (p *peek1Buffer) Peek() (byte, error) {
	if p.ch != nil {
		return *p.ch, nil
	}
	ch, err := p.ReadByte()
	if err != nil {
		return 0, err
	}
	p.ch = &ch
	return ch, nil
}

func (p *peek1Buffer) Len() int {
	ret := p.Buffer.Len()
	if p.ch != nil {
		ret++
	}
	return ret
}

func (p *peek1Buffer) Next(n int) []byte {
	var ret []byte
	if n == 0 {
		return nil
	}

	if p.ch != nil {
		n--
		ret = []byte{*p.ch}
		p.ch = nil
	}
	return append(ret, p.Buffer.Next(n)...)
}

type framedMsgpackStream struct {
	buf           peek1Buffer
	eof           bool
	packetLenNext int
	err           error
	seqno         PacketSeqno
}

var _ io.WriteCloser = (*framedMsgpackStream)(nil)

func (f *framedMsgpackStream) Write(b []byte) (n int, err error) {
	return f.buf.Write(b)
}

func (f *framedMsgpackStream) Close() error {
	if f.err != nil {
		return f.err
	}
	f.eof = true
	return nil
}

func (f *framedMsgpackStream) Decode(i interface{}) (ret PacketSeqno, err error) {
	if f.err != nil {
		return 0, f.err
	}
	for f.packetLenNext == 0 {
		err := f.decodeFrame()
		if err == errAgain {
			return 0, err
		}
		if err != nil {
			f.err = err
			return 0, err
		}
	}
	err = f.decodePacket(i)

	// Unexpected EOF here
	if err == errAgain && f.eof {
		err = ErrUnexpectedEOF
		f.err = err
	} else if err != nil && err != errAgain {
		f.err = err
	} else if err == nil {
		ret = f.seqno
		f.seqno++
	}
	return ret, err
}

func (f *framedMsgpackStream) decodePacket(i interface{}) error {
	if f.buf.Len() < f.packetLenNext {
		return errAgain
	}
	buf := f.buf.Next(f.packetLenNext)
	if len(buf) != f.packetLenNext {
		return ErrBadFrame
	}
	err := decodeFromBytes(i, buf)
	f.packetLenNext = 0
	return err
}

// This is a hack of sorts, in which we've taken the important
// parts of the Msgpack spec for reading an int from the string.
func msgpackFrameLen(b byte) int {
	if b < 0x80 {
		return 1
	}
	if b == 0xcc {
		return 2
	}
	if b == 0xcd {
		return 3
	}
	if b == 0xce {
		return 5
	}
	return 0
}

func (f *framedMsgpackStream) decodeFrame() error {
	if f.buf.Len() == 0 {
		if f.eof {
			return io.EOF
		}
		return errAgain
	}

	var f0 byte
	var err error

	// First get the frame's framing byte! This will tell us
	// how many more bytes we need to grab.  This is a bit of
	// an abstraction violation, but one worth it for implementation
	// simplicity and efficiency.
	if f0, err = f.buf.Peek(); err != nil {
		return err
	}

	frameLen := msgpackFrameLen(f0)
	if frameLen == 0 {
		return ErrBadFrame
	}

	if f.buf.Len() < frameLen {
		if f.eof {
			return ErrUnexpectedEOF
		}
		return errAgain
	}

	buf := f.buf.Next(frameLen)
	if len(buf) != frameLen {
		return ErrBadFrame
	}
	err = decodeFromBytes(&f.packetLenNext, buf)
	return err
}
