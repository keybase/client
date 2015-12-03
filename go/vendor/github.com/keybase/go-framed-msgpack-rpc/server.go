package rpc

type Server struct {
	xp        Transporter
	wrapError WrapErrorFunc
}

func NewServer(xp Transporter, f WrapErrorFunc) *Server {
	return &Server{xp, f}
}

func (s *Server) Register(p Protocol) error {
	p.WrapError = s.wrapError
	receiver, err := s.xp.getReceiver()
	if err != nil {
		return err
	}
	return receiver.RegisterProtocol(p)
}

// AddCloseListener supplies a channel listener to which
// the server will send an error when a connection closes
func (s *Server) AddCloseListener(ch chan error) error {
	rec, err := s.xp.getReceiver()
	if err != nil {
		return err
	}
	rec.AddCloseListener(ch)
	return nil
}

// TODO: Split into Run and RunAsync, and update callers. See
// https://github.com/keybase/go-framed-msgpack-rpc/issues/39 .
func (s *Server) Run(bg bool) error {
	if bg {
		return s.xp.RunAsync()
	}
	return s.xp.Run()
}
