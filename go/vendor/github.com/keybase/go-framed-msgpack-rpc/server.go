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
	dispatcher, err := s.xp.getDispatcher()
	if err != nil {
		return err
	}
	return dispatcher.RegisterProtocol(p)
}

func (s *Server) Run(bg bool) error {
	if bg {
		go s.xp.Run()
		return nil
	}
	return s.xp.Run()
}
