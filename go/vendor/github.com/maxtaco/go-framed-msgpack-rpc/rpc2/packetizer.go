package rpc2

type Packetizer struct {
	dispatch  Dispatcher
	transport Transporter
}

func NewPacketizer(d Dispatcher, t Transporter) *Packetizer {
	return &Packetizer{
		dispatch:  d,
		transport: t,
	}
}

func (p *Packetizer) getFrame() (int, error) {
	var l int

	p.transport.ReadLock()
	err := p.transport.Decode(&l)
	p.transport.ReadUnlock()

	return l, err
}

func (p *Packetizer) Clear() {
	p.dispatch = nil
	p.transport = nil
}

func (p *Packetizer) getMessage(l int) (err error) {
	var b byte

	if b, err = p.transport.ReadByte(); err != nil {
		return err
	}
	nb := int(b)

	if nb >= 0x91 && nb <= 0x9f {
		err = p.dispatch.Dispatch(&Message{p.transport, (nb - 0x90), 0})
	} else {
		err = NewPacketizerError("wrong message structure prefix (%d)", nb)
	}

	return err
}

func (p *Packetizer) packetizeOne() (err error) {
	var n int
	if n, err = p.getFrame(); err == nil {
		err = p.getMessage(n)
	}
	return
}

func (p *Packetizer) Packetize() (err error) {
	for err == nil {
		err = p.packetizeOne()
	}
	return
}
