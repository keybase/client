package rpc

type packetizer interface {
	Packetize() error
}

type packetHandler struct {
	receiver receiver
	dec      byteReadingDecoder
}

func newPacketHandler(r receiver, dec byteReadingDecoder) *packetHandler {
	return &packetHandler{
		receiver: r,
		dec:      dec,
	}
}

func (p *packetHandler) getFrame() (int, error) {
	var l int

	err := p.dec.Decode(&l)

	return l, err
}

func (p *packetHandler) getMessage(l int) (err error) {
	// TODO currently tossing out `l` above. We should either validate it or
	// not pass it in at all.
	var b byte

	if b, err = p.dec.ReadByte(); err != nil {
		return err
	}
	nb := int(b)

	// Interpret the byte as the length field of a fixarray of up
	// to 15 elements: see
	// https://github.com/msgpack/msgpack/blob/master/spec.md#formats-array.
	// The target type information isn't known until we decode the first few
	// fields, so this abstraction violation is needed to be able to decode
	// them without copying.
	if nb >= 0x91 && nb <= 0x9f {
		err = p.receiver.Receive(nb - 0x90)
	} else {
		err = NewPacketizerError("wrong message structure prefix (0x%x)", nb)
	}

	return err
}

func (p *packetHandler) packetizeOne() (err error) {
	var n int
	if n, err = p.getFrame(); err == nil {
		err = p.getMessage(n)
	}
	return
}

func (p *packetHandler) Packetize() (err error) {
	for err == nil {
		err = p.packetizeOne()
	}
	return
}
