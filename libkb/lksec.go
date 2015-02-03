package libkb

type LKSec struct {
	serverHalf []byte
	clientHalf []byte
	secret     []byte
}

func NewLKSec() *LKSec {
	return &LKSec{}
}

func (s *LKSec) Load() error {
	if s.serverHalf != nil {
		return nil
	}

	// GET key/fetch_private

	// parse json

	// there's a devices section, get device matching this one

	// get lks_server_half from that

	// for clientHalf:  Load it from passphrase, or provide a fn to set it.

	s.secret = make([]byte, len(s.serverHalf))
	XORBytes(s.secret, s.serverHalf, s.clientHalf)

	return nil
}

func (s *LKSec) Encrypt() error {
	return nil
}

func (s *LKSec) Decrypt() error {
	return nil
}
