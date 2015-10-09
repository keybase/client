package rpc

type packetizer struct {
	dispatch dispatcher
	dec      byteReadingDecoder
}

func newPacketizer(d dispatcher, dec byteReadingDecoder) *packetizer {
	return &packetizer{
		dispatch: d,
		dec:      dec,
	}
}

func (p *packetizer) getFrame() (int, error) {
	var l int

	err := p.dec.Decode(&l)

	return l, err
}

func (p *packetizer) getMessage(l int) (err error) {
	var b byte

	if b, err = p.dec.ReadByte(); err != nil {
		return err
	}
	nb := int(b)

	if nb >= 0x91 && nb <= 0x9f {
		err = p.dispatch.Dispatch(nb - 0x90)
	} else {
		err = NewPacketizerError("wrong message structure prefix (%d)", nb)
	}

	return err
}

func (p *packetizer) packetizeOne() (err error) {
	var n int
	if n, err = p.getFrame(); err == nil {
		err = p.getMessage(n)
	}
	return
}

func (p *packetizer) Packetize() (err error) {
	for err == nil {
		err = p.packetizeOne()
	}
	return
}
