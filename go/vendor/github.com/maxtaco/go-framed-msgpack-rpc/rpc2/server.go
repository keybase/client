package rpc2

type Server struct {
	xp        *Transport
	wrapError WrapErrorFunc
}

func NewServer(xp *Transport, f WrapErrorFunc) *Server {
	return &Server{xp, f}
}

func (s *Server) Register(p Protocol) (err error) {
	p.WrapError = s.wrapError
	return s.xp.dispatcher.RegisterProtocol(p)
}

func (s *Server) Run(bg bool) error {
	return s.xp.run(bg)
}
