package msgpackzip

import (
	"encoding/binary"
	"errors"
	"io"
	"math"
)

var ErrMaxDepth = errors.New("input exceeded maximum allowed depth")
var ErrContainerTooBig = errors.New("container allocation is too big")
var ErrStringTooBig = errors.New("string allocation is too big")
var ErrBinaryTooBig = errors.New("binary allocation is too big")
var ErrLenTooBig = errors.New("Lenghts bigger than 0x8000000 are too big")
var ErrIntTooBig = errors.New("Cannot handle ints largers than int64 max")
var ErrExtTooBig = errors.New("extenal data type too big")

type intType int

const (
	intTypeFixedUint intType = 1  // <= 0x7f
	intTypeFixedInt  intType = 2  // >= 0xe0
	intTypeUint8     intType = 3  // 0xcc
	intTypeInt8      intType = 4  // 0xd0
	intTypeUint16    intType = 5  // 0xcd
	intTypeInt16     intType = 6  // 0xd1
	intTypeUint32    intType = 7  // 0xce
	intTypeInt32     intType = 8  // 0xd2
	intTypeUint64    intType = 9  // 0xcf
	intTypeInt64     intType = 10 // 0xd3
)

type msgpackInt struct {
	typ  intType
	val  int64
	uval uint64
}

const bigLen = 0x8000000
const bigString = bigLen
const bigBinary = bigLen
const bigArray = 0x100000
const bigStackDepth = 0x100
const bigExt = bigLen

func (i msgpackInt) toLen() (int, error) {
	if i.typ == intTypeUint64 {
		if i.uval >= uint64(bigLen) {
			return 0, ErrLenTooBig
		}
		return int(i.uval), nil
	}
	if i.val >= int64(bigLen) {
		return 0, ErrLenTooBig
	}
	return int(i.val), nil
}

func (i msgpackInt) toInt64() (int64, error) {
	if i.typ == intTypeUint64 {
		if i.uval >= uint64(math.MaxInt64) {
			return 0, ErrIntTooBig
		}
		return int64(i.uval), nil
	}
	return i.val, nil
}

func (i msgpackInt) toUint32() (uint32, error) {
	if i.typ == intTypeUint64 {
		if i.uval >= uint64(math.MaxUint32) {
			return 0, ErrIntTooBig
		}
		return uint32(i.uval), nil
	}
	if i.val >= int64(math.MaxUint32) {
		return 0, ErrIntTooBig
	}
	return uint32(i.val), nil
}

func msgpackIntFromUint(u uint) msgpackInt {
	var typ intType
	switch {
	case u <= 0x7f:
		typ = intTypeFixedUint
	case u <= 0xff:
		typ = intTypeUint8
	case u <= 0xffff:
		typ = intTypeUint16
	case u <= math.MaxUint32:
		typ = intTypeUint32
	default:
		return msgpackInt{typ: intTypeUint64, uval: uint64(u)}
	}
	return msgpackInt{typ: typ, val: int64(u)}
}

type msgpackDecoderHooks struct {
	mapKeyHook      func(d decodeStack) (decodeStack, error)
	mapValueHook    func(d decodeStack) (decodeStack, error)
	mapStartHook    func(d decodeStack, i msgpackInt) (decodeStack, error)
	arrayStartHook  func(d decodeStack, i msgpackInt) (decodeStack, error)
	arrayValueHook  func(d decodeStack) (decodeStack, error)
	stringHook      func(l msgpackInt, s string) error
	binaryHook      func(l msgpackInt, b []byte) error
	nilHook         func() error
	intHook         func(i msgpackInt) error
	float32Hook     func(b []byte) error
	float64Hook     func(b []byte) error
	boolHook        func(b bool) error
	extHook         func(b []byte) error
	fallthroughHook func(i interface{}, s string) error
}

func readByte(r io.Reader) (byte, error) {
	var buf [1]byte
	_, err := r.Read(buf[:])
	if err != nil {
		return byte(0), err
	}
	return buf[0], nil
}

func readUint16(r io.Reader) (ret msgpackInt, err error) {
	var i uint16
	err = binary.Read(r, binary.BigEndian, &i)
	if err != nil {
		return ret, err
	}
	return msgpackInt{typ: intTypeUint16, val: int64(i)}, nil
}

func readInt16(r io.Reader) (ret msgpackInt, err error) {
	var i int16
	err = binary.Read(r, binary.BigEndian, &i)
	if err != nil {
		return ret, err
	}
	return msgpackInt{typ: intTypeInt16, val: int64(i)}, nil
}

func readUint32(r io.Reader) (ret msgpackInt, err error) {
	var i uint32
	err = binary.Read(r, binary.BigEndian, &i)
	if err != nil {
		return ret, err
	}
	return msgpackInt{typ: intTypeUint32, val: int64(i)}, nil
}

func readInt32(r io.Reader) (ret msgpackInt, err error) {
	var i int32
	err = binary.Read(r, binary.BigEndian, &i)
	if err != nil {
		return ret, err
	}
	return msgpackInt{typ: intTypeInt32, val: int64(i)}, nil
}

func readUint64(r io.Reader) (ret msgpackInt, err error) {
	var u uint64
	err = binary.Read(r, binary.BigEndian, &u)
	if err != nil {
		return ret, err
	}
	return msgpackInt{typ: intTypeUint64, uval: u}, nil
}

func readInt64(r io.Reader) (ret msgpackInt, err error) {
	var i int64
	err = binary.Read(r, binary.BigEndian, &i)
	if err != nil {
		return ret, err
	}
	return msgpackInt{typ: intTypeInt64, val: i}, nil
}

func readFloat64(r io.Reader) (b []byte, err error) {
	var buf [8]byte
	_, err = io.ReadFull(r, buf[:])
	if err != nil {
		return nil, err
	}
	return buf[:], err
}

func readFloat32(r io.Reader) (b []byte, err error) {
	var buf [4]byte
	_, err = io.ReadFull(r, buf[:])
	if err != nil {
		return nil, err
	}
	return buf[:], err
}

type decodeStack struct {
	depth int
	hooks msgpackDecoderHooks
}

func (d decodeStack) descend() decodeStack {
	d.depth++
	return d
}

type msgpackDecoder struct {
	r io.Reader
}

func newMsgpackDecoder(r io.Reader) *msgpackDecoder {
	return &msgpackDecoder{r: r}
}

func (m *msgpackDecoder) run(h msgpackDecoderHooks) error {
	d := decodeStack{hooks: h}
	return m.decode(d)
}

func (m *msgpackDecoder) produceInt(s decodeStack, i msgpackInt) (err error) {
	if s.hooks.intHook != nil {
		return s.hooks.intHook(i)
	}
	if s.hooks.fallthroughHook != nil {
		return s.hooks.fallthroughHook(i, "int")
	}
	return nil
}

func (m *msgpackDecoder) produceNil(s decodeStack) (err error) {
	if s.hooks.nilHook != nil {
		return s.hooks.nilHook()
	}
	if s.hooks.fallthroughHook != nil {
		return s.hooks.fallthroughHook(nil, "nil")
	}
	return nil
}

func (m *msgpackDecoder) produceBool(s decodeStack, b bool) (err error) {
	if s.hooks.boolHook != nil {
		return s.hooks.boolHook(b)
	}
	if s.hooks.fallthroughHook != nil {
		return s.hooks.fallthroughHook(false, "bool")
	}
	return nil
}

func (m *msgpackDecoder) produceFloat32(s decodeStack, b []byte) (err error) {
	if s.hooks.float32Hook != nil {
		return s.hooks.float32Hook(b)
	}
	if s.hooks.fallthroughHook != nil {
		return s.hooks.fallthroughHook(float32(0.0), "float32")
	}
	return nil
}

func (m *msgpackDecoder) produceFloat64(s decodeStack, b []byte) (err error) {
	if s.hooks.float64Hook != nil {
		return s.hooks.float64Hook(b)
	}
	if s.hooks.fallthroughHook != nil {
		return s.hooks.fallthroughHook(float32(0.0), "float64")
	}
	return nil
}

func (m *msgpackDecoder) decodeString(s decodeStack, i msgpackInt) (err error) {
	l, err := i.toLen()
	if err != nil {
		return err
	}
	if l > bigString {
		return ErrStringTooBig
	}
	buf := make([]byte, l)
	_, err = io.ReadFull(m.r, buf)
	if err != nil {
		return err
	}
	return m.produceString(s, i, string(buf))
}

func (m *msgpackDecoder) decodeBinary(s decodeStack, i msgpackInt) (err error) {
	l, err := i.toLen()
	if err != nil {
		return err
	}
	if l > bigBinary {
		return ErrBinaryTooBig
	}
	buf := make([]byte, l)
	_, err = io.ReadFull(m.r, buf)
	if err != nil {
		return err
	}
	return m.produceBinary(s, i, buf)
}

func (m *msgpackDecoder) produceString(s decodeStack, i msgpackInt, str string) (err error) {
	if s.hooks.stringHook != nil {
		return s.hooks.stringHook(i, str)
	}
	if s.hooks.fallthroughHook != nil {
		return s.hooks.fallthroughHook(str, "string")
	}
	return nil
}

func (m *msgpackDecoder) produceBinary(s decodeStack, i msgpackInt, b []byte) (err error) {
	if s.hooks.binaryHook != nil {
		return s.hooks.binaryHook(i, b)
	}
	if s.hooks.fallthroughHook != nil {
		return s.hooks.fallthroughHook(b, "binary")
	}
	return nil
}

func (m *msgpackDecoder) produceArrayStart(s decodeStack, n msgpackInt) (ret decodeStack, err error) {
	if s.hooks.arrayStartHook != nil {
		return s.hooks.arrayStartHook(s, n)
	}
	if s.hooks.fallthroughHook != nil {
		err = s.hooks.fallthroughHook([]int{}, "array")
		return s, err
	}
	return s, nil
}

func (m *msgpackDecoder) decodeArrayElement(s decodeStack) (err error) {
	if s.hooks.arrayValueHook != nil {
		s, err = s.hooks.arrayValueHook(s)
		if err != nil {
			return err
		}
	}
	return m.decode(s.descend())
}

func (m *msgpackDecoder) decodeArray(s decodeStack, n msgpackInt) (err error) {
	s, err = m.produceArrayStart(s, n)
	if err != nil {
		return err
	}
	numItems, err := n.toLen()
	if err != nil {
		return err
	}
	if numItems > bigArray {
		return ErrContainerTooBig
	}
	for i := 0; i < numItems; i++ {
		err = m.decodeArrayElement(s)
		if err != nil {
			return err
		}
	}
	return err
}

func (m *msgpackDecoder) produceMapStart(s decodeStack, n msgpackInt) (ret decodeStack, err error) {
	if s.hooks.mapStartHook != nil {
		return s.hooks.mapStartHook(s, n)
	}
	if s.hooks.fallthroughHook != nil {
		err = s.hooks.fallthroughHook(make(map[string]int), "map")
		return s, err
	}
	return s, nil
}

func (m *msgpackDecoder) decodeMapPair(s decodeStack) (err error) {
	err = m.decodeMapKey(s)
	if err != nil {
		return err
	}
	return m.decodeMapValue(s)
}

func (m *msgpackDecoder) decodeMapKey(s decodeStack) (err error) {
	if s.hooks.mapKeyHook != nil {
		s, err = s.hooks.mapKeyHook(s)
		if err != nil {
			return err
		}
	}
	return m.decode(s.descend())
}

func (m *msgpackDecoder) decodeMapValue(s decodeStack) (err error) {
	if s.hooks.mapValueHook != nil {
		s, err = s.hooks.mapValueHook(s)
		if err != nil {
			return err
		}
	}
	return m.decode(s.descend())
}

func (m *msgpackDecoder) decodeMap(s decodeStack, n msgpackInt) (err error) {
	s, err = m.produceMapStart(s, n)
	if err != nil {
		return err
	}
	numItems, err := n.toLen()
	if err != nil {
		return err
	}
	if numItems > bigArray {
		return ErrContainerTooBig
	}
	for i := 0; i < numItems; i++ {
		err = m.decodeMapPair(s)
		if err != nil {
			return err
		}
	}
	return nil
}

func (m *msgpackDecoder) produceExt(s decodeStack, b []byte) (err error) {
	if s.hooks.extHook != nil {
		return s.hooks.extHook(b)
	}
	if s.hooks.fallthroughHook != nil {
		return s.hooks.fallthroughHook([]byte{}, "ext")
	}
	return nil
}

func (m *msgpackDecoder) decodeExt(s decodeStack, n uint32) (err error) {
	if n > bigExt {
		return ErrExtTooBig
	}
	buf := make([]byte, n)
	_, err = io.ReadFull(m.r, buf[:])
	if err != nil {
		return err
	}
	return m.produceExt(s, buf)
}

func (m *msgpackDecoder) readByte() (byte, error)         { return readByte(m.r) }
func (m *msgpackDecoder) readUint16() (msgpackInt, error) { return readUint16(m.r) }
func (m *msgpackDecoder) readUint32() (msgpackInt, error) { return readUint32(m.r) }
func (m *msgpackDecoder) readUint64() (msgpackInt, error) { return readUint64(m.r) }
func (m *msgpackDecoder) readInt16() (msgpackInt, error)  { return readInt16(m.r) }
func (m *msgpackDecoder) readInt32() (msgpackInt, error)  { return readInt32(m.r) }
func (m *msgpackDecoder) readInt64() (msgpackInt, error)  { return readInt64(m.r) }
func (m *msgpackDecoder) readFloat32() ([]byte, error)    { return readFloat32(m.r) }
func (m *msgpackDecoder) readFloat64() ([]byte, error)    { return readFloat64(m.r) }

func (m *msgpackDecoder) decode(s decodeStack) (err error) {
	if s.depth > bigStackDepth {
		return ErrMaxDepth
	}

	mask := func(b byte, m int) int64 {
		return int64(b & byte(m))
	}
	makeFixedUint := func(b byte, m int) msgpackInt {
		return msgpackInt{typ: intTypeFixedUint, val: mask(b, m)}
	}

	b, err := m.readByte()
	if err != nil {
		return err
	}

	switch {

	// positive or negative fix bytes
	case b <= 0x7f:
		return m.produceInt(s, makeFixedUint(b, 0xff))
	case b >= 0xe0:
		return m.produceInt(s, msgpackInt{typ: intTypeFixedInt, val: int64(b) - 0x100})

	// fix length string
	case b >= 0xa0 && b <= 0xbf:
		return m.decodeString(s, makeFixedUint(b, 0x1f))

	// fix length array
	case b >= 0x90 && b <= 0x9f:
		return m.decodeArray(s, makeFixedUint(b, 0x0f))

	// fix length map
	case b >= 0x80 && b <= 0x8f:
		return m.decodeMap(s, makeFixedUint(b, 0x0f))

	// nil
	case b == 0xc0:
		return m.produceNil(s)

	// false
	case b == 0xc2:
		return m.produceBool(s, false)

	// true
	case b == 0xc3:
		return m.produceBool(s, true)

	// str8 type
	case b == 0xd9:
		n, err := m.readByte()
		if err != nil {
			return err
		}
		return m.decodeString(s, makeFixedUint(n, 0x0ff))

	// str16 type
	case b == 0xda:
		n, err := m.readUint16()
		if err != nil {
			return err
		}
		return m.decodeString(s, n)

	// str32 type
	case b == 0xdb:
		n, err := m.readUint32()
		if err != nil {
			return err
		}
		return m.decodeString(s, n)

	// bin8 type
	case b == 0xc4:
		n, err := m.readByte()
		if err != nil {
			return err
		}
		return m.decodeBinary(s, makeFixedUint(n, 0x0ff))

	// bin16 type
	case b == 0xc5:
		n, err := m.readUint16()
		if err != nil {
			return err
		}
		return m.decodeBinary(s, n)

	// bin32 type
	case b == 0xc6:
		n, err := m.readUint32()
		if err != nil {
			return err
		}
		return m.decodeBinary(s, n)

	case b == 0xd4:
		return m.decodeExt(s, 1)
	case b == 0xd5:
		return m.decodeExt(s, 2)
	case b == 0xd6:
		return m.decodeExt(s, 4)
	case b == 0xd7:
		return m.decodeExt(s, 8)
	case b == 0xd8:
		return m.decodeExt(s, 16)

	case b == 0xc7:
		n, err := m.readByte()
		if err != nil {
			return err
		}
		return m.decodeExt(s, uint32(n))
	case b == 0xc8:
		n, err := m.readUint16()
		if err != nil {
			return err
		}
		i, err := n.toUint32()
		if err != nil {
			return err
		}
		return m.decodeExt(s, i)
	case b == 0xc9:
		n, err := m.readUint32()
		if err != nil {
			return err
		}
		i, err := n.toUint32()
		if err != nil {
			return err
		}
		return m.decodeExt(s, i)

	// uint8
	case b == 0xcc:
		u, err := m.readByte()
		if err != nil {
			return err
		}
		return m.produceInt(s, msgpackInt{typ: intTypeUint8, val: int64(u)})

	// uint16
	case b == 0xcd:
		u, err := m.readUint16()
		if err != nil {
			return err
		}
		return m.produceInt(s, u)

	// uint32
	case b == 0xce:
		u, err := m.readUint32()
		if err != nil {
			return err
		}
		return m.produceInt(s, u)

	// uint64
	case b == 0xcf:
		u, err := m.readUint64()
		if err != nil {
			return err
		}
		return m.produceInt(s, u)

	// int8
	case b == 0xd0:
		i, err := m.readByte()
		if err != nil {
			return err
		}
		return m.produceInt(s, msgpackInt{typ: intTypeInt8, val: int64(i)})

	// int16
	case b == 0xd1:
		i, err := m.readInt16()
		if err != nil {
			return err
		}
		return m.produceInt(s, i)

	// int32
	case b == 0xd2:
		i, err := m.readInt32()
		if err != nil {
			return err
		}
		return m.produceInt(s, i)

	// int64
	case b == 0xd3:
		i, err := m.readInt64()
		if err != nil {
			return err
		}
		return m.produceInt(s, i)

	// float32
	case b == 0xca:
		f, err := m.readFloat32()
		if err != nil {
			return err
		}
		return m.produceFloat32(s, f)

	// float64
	case b == 0xcb:
		f, err := m.readFloat64()
		if err != nil {
			return err
		}
		return m.produceFloat64(s, f)

	// array16
	case b == 0xdc:
		u, err := m.readUint16()
		if err != nil {
			return err
		}
		return m.decodeArray(s, u)

	// array32
	case b == 0xdd:
		u, err := m.readUint32()
		if err != nil {
			return err
		}
		return m.decodeArray(s, u)

	// map16
	case b == 0xde:
		u, err := m.readUint16()
		if err != nil {
			return err
		}
		return m.decodeMap(s, u)

	// map32
	case b == 0xdf:
		u, err := m.readUint32()
		if err != nil {
			return err
		}
		return m.decodeMap(s, u)
	}

	return nil
}
