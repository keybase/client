package msgpackzip

import (
	"bytes"
	"encoding/binary"
	"errors"
)

type outputter struct {
	buf bytes.Buffer
}

func (o *outputter) Bytes() []byte {
	return o.buf.Bytes()
}

func (o *outputter) outputRawUint(i uint) error {
	return o.outputInt(msgpackIntFromUint(i))
}

func (o *outputter) outputMapPrefix(i msgpackInt) (err error) {
	return o.outputContainerPrefix(i, 0x80, 0x0f, 0x00, 0xde, 0xdf)
}

func (o *outputter) outputArrayPrefix(i msgpackInt) (err error) {
	return o.outputContainerPrefix(i, 0x90, 0x0f, 0x00, 0xdc, 0xdd)
}

func (o *outputter) outputByte(b byte) error {
	buf := []byte{b}
	_, err := o.buf.Write(buf[:])
	return err
}

func (o *outputter) outputBinaryInt(i interface{}) error {
	return binary.Write(&o.buf, binary.BigEndian, i)
}

func (o *outputter) outputPrefixAndBinaryInt(b byte, i interface{}) error {
	err := o.outputByte(b)
	if err != nil {
		return err
	}
	return binary.Write(&o.buf, binary.BigEndian, i)
}

func (o *outputter) outputContainerPrefix(i msgpackInt, fixed byte, numFixed byte, u8 byte, u16 byte, u32 byte) (err error) {

	switch i.typ {
	case intTypeFixedUint:
		if fixed != 0x0 && byte(i.val) <= numFixed {
			return o.outputByte(fixed | byte(i.val))
		}
		fallthrough
	case intTypeUint8:
		if u8 != 0x0 {
			var b [2]byte
			b[0] = u8
			b[1] = byte(i.val)
			_, err = o.buf.Write(b[:])
			return err
		}
		fallthrough
	case intTypeUint16:
		err = o.outputByte(u16)
		if err != nil {
			return err
		}
		err = o.outputBinaryInt(uint16(i.val))
		return err
	case intTypeUint32:
		err = o.outputByte(u32)
		if err != nil {
			return err
		}
		err = o.outputBinaryInt(uint32(i.val))
		return err
	default:
		return errors.New("bad container length")
	}
}

func (o *outputter) outputString(i msgpackInt, s string) (err error) {
	err = o.outputContainerPrefix(i, 0xa0, 0x1f, 0xd9, 0xda, 0xdb)
	if err != nil {
		return err
	}
	_, err = o.buf.Write([]byte(s))
	return err
}

func (o *outputter) outputBinary(i msgpackInt, b []byte) (err error) {
	err = o.outputContainerPrefix(i, 0x00, 0x00, 0xc4, 0xc5, 0xc6)
	if err != nil {
		return err
	}
	_, err = o.buf.Write(b)
	return err
}

func (o *outputter) outputNil() error {
	return o.outputByte(0xc0)
}

func (o *outputter) outputBool(b bool) error {
	var val byte
	if b {
		val = 0xc3
	} else {
		val = 0xc2
	}
	return o.outputByte(val)
}

func (o *outputter) outputInt(i msgpackInt) error {
	switch i.typ {
	case intTypeFixedUint:
		return o.outputByte(byte(i.val))
	case intTypeFixedInt:
		return o.outputByte(byte(0x100 + i.val))
	case intTypeUint8:
		return o.outputPrefixAndBinaryInt(0xcc, uint8(i.val))
	case intTypeUint16:
		return o.outputPrefixAndBinaryInt(0xcd, uint16(i.val))
	case intTypeUint32:
		return o.outputPrefixAndBinaryInt(0xce, uint32(i.val))
	case intTypeUint64:
		return o.outputPrefixAndBinaryInt(0xcf, i.uval)
	case intTypeInt8:
		return o.outputPrefixAndBinaryInt(0xd0, int8(i.val))
	case intTypeInt16:
		return o.outputPrefixAndBinaryInt(0xd1, int16(i.val))
	case intTypeInt32:
		return o.outputPrefixAndBinaryInt(0xd2, int32(i.val))
	case intTypeInt64:
		return o.outputPrefixAndBinaryInt(0xd3, i.val)
	default:
		return errors.New("unhandled int output case")
	}
}

func (o *outputter) outputFloat32(b []byte) error {
	err := o.outputByte(0xca)
	if err != nil {
		return err
	}
	_, err = o.buf.Write(b)
	return err
}

func (o *outputter) outputFloat64(b []byte) error {
	err := o.outputByte(0xcb)
	if err != nil {
		return err
	}
	_, err = o.buf.Write(b)
	return err
}

func (o *outputter) decoderHooks() msgpackDecoderHooks {
	return msgpackDecoderHooks{
		mapStartHook: func(d decodeStack, i msgpackInt) (decodeStack, error) {
			err := o.outputMapPrefix(i)
			return d, err
		},
		arrayStartHook: func(d decodeStack, i msgpackInt) (decodeStack, error) {
			err := o.outputArrayPrefix(i)
			return d, err
		},
		stringHook: func(l msgpackInt, s string) error {
			return o.outputString(l, s)
		},
		binaryHook: func(l msgpackInt, b []byte) error {
			return o.outputBinary(l, b)
		},
		nilHook: func() error {
			return o.outputNil()
		},
		boolHook: func(b bool) error {
			return o.outputBool(b)
		},
		intHook: func(i msgpackInt) error {
			return o.outputInt(i)
		},
		float32Hook: func(b []byte) error {
			return o.outputFloat32(b)
		},
		float64Hook: func(b []byte) error {
			return o.outputFloat64(b)
		},
	}
}

func (o *outputter) outputStringOrUintOrBinary(i interface{}) error {
	switch t := i.(type) {
	case BinaryMapKey:
		return o.outputBinary(msgpackIntFromUint(uint(len(t))), []byte(t))
	case string:
		return o.outputString(msgpackIntFromUint(uint(len(t))), t)
	case int64:
		return o.outputInt(msgpackIntFromUint(uint(t)))
	default:
		return errors.New("Unhandled map key interface type in output path")
	}
}

// we we substitue in a binary or string for something in our dictionary,
// we output it as a bigendian integer, prefixed by the "external" byte.
func (o *outputter) outputExtUint(u uint) error {
	var i interface{}
	var b byte
	switch {
	case u <= 0xff:
		b = 0xd4
		i = uint8(u)
	case u <= 0xffff:
		b = 0xd5
		i = uint16(u)
	case u <= 0xffffffff:
		b = 0xd6
		i = uint32(u)
	default:
		b = 0xd7
		i = uint64(u)
	}
	return o.outputPrefixAndBinaryInt(b, i)
}
