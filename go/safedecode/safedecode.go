package safedecode

import (
	"bytes"
	"encoding/binary"
	"errors"
	"io"
)

var MaxDepthError = errors.New("input exceeded maximum allowed depth")
var ExtUnsupported = errors.New("ext types not supported")

func MsgpackEnsureMaxDepth(r io.Reader, maxDepth int) (b []byte, err error) {
	var buf bytes.Buffer
	tee := io.TeeReader(r, &buf)
	err = msgpackDecode(tee, maxDepth)
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func readByte(r io.Reader) (byte, error) {
	var buf [1]byte
	_, err := r.Read(buf[:])
	if err != nil {
		return byte(0), err
	}
	return buf[0], nil
}

func readIgnore(r io.Reader, n int) error {
	buf := make([]byte, n)
	_, err := io.ReadFull(r, buf)
	return err
}

func msgpackDecodeArray(r io.Reader, maxDepth int, n int) (err error) {
	maxDepth -= 1
	for i := 0; i < n && err == nil; i++ {
		err = msgpackDecode(r, maxDepth)
	}
	return err
}

func msgpackDecodeMap(r io.Reader, maxDepth int, n int) (err error) {
	maxDepth -= 1
	for i := 0; i < n && err == nil; i++ {
		err = msgpackDecode(r, maxDepth)
		if err == nil {
			err = msgpackDecode(r, maxDepth)
		}
	}
	return err
}

func readUint16(r io.Reader) (uint16, error) {
	var ret uint16
	err := binary.Read(r, binary.BigEndian, &ret)
	return ret, err
}

func readUint32(r io.Reader) (uint32, error) {
	var ret uint32
	err := binary.Read(r, binary.BigEndian, &ret)
	return ret, err
}

func msgpackDecode(r io.Reader, maxDepth int) (err error) {

	if maxDepth < 0 {
		return MaxDepthError
	}

	b, err := readByte(r)
	if err != nil {
		return err
	}

	switch {

	// positive or negative fix bytes
	case b <= 0x7f || b >= 0xe0:
		return nil

	// fix length string
	case b >= 0xa0 && b <= 0xbf:
		return readIgnore(r, int(b&byte(0x1f)))

	// fix length array
	case b >= 0x90 && b <= 0x9f:
		return msgpackDecodeArray(r, maxDepth, int(b&byte(0x0f)))

	// fix length map
	case b >= 0x80 && b <= 0x8f:
		return msgpackDecodeMap(r, maxDepth, int(b&byte(0x0f)))

	// nil, false and true
	case b >= 0xc0 && b <= 0xc3:
		return nil

	// bin8 and str8 types
	case b == 0xc4 || b == 0xd9:
		s, err := readByte(r)
		if err != nil {
			return err
		}
		return readIgnore(r, int(s))

	// bin16 and str16 types
	case b == 0xc5 || b == 0xda:
		s, err := readUint16(r)
		if err != nil {
			return err
		}
		return readIgnore(r, int(s))

	// bin32 and str32 types
	case b == 0xc6 || b == 0xdb:
		s, err := readUint32(r)
		if err != nil {
			return err
		}
		return readIgnore(r, int(s))

	// ext types
	case (b >= 0xc7 && b <= 0xc9) || (b >= 0xd4 && b <= 0xd8):
		return ExtUnsupported

	case b == 0xcc || b == 0xd0:
		return readIgnore(r, 1)

	case b == 0xcd || b == 0xd1:
		return readIgnore(r, 2)

	// int32 or float
	case b == 0xce || b == 0xd2 || b == 0xca:
		return readIgnore(r, 4)

	// int64 or float
	case b == 0xcf || b == 0xd3 || b == 0xcb:
		return readIgnore(r, 8)

	// array16
	case b == 0xdc:
		s, err := readUint16(r)
		if err != nil {
			return err
		}
		return msgpackDecodeArray(r, maxDepth, int(s))

	// array32
	case b == 0xdd:
		s, err := readUint32(r)
		if err != nil {
			return err
		}
		return msgpackDecodeArray(r, maxDepth, int(s))

	// map16
	case b == 0xde:
		s, err := readUint16(r)
		if err != nil {
			return err
		}
		return msgpackDecodeMap(r, maxDepth, int(s))

	// map32
	case b == 0xdf:
		s, err := readUint32(r)
		if err != nil {
			return err
		}
		return msgpackDecodeMap(r, maxDepth, int(s))

	}
	return nil
}
