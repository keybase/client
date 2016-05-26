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
	return s.xp.registerProtocol(p)
}

// Run starts processing incoming RPC messages asynchronously, if it
// hasn't been started already. Returns a channel that's closed when
// incoming frames have finished processing, either due to an error or
// the underlying connection being closed. Successive calls to Run()
// return the same value.
//
// If you want to know when said processing is done, and any
// associated error, use Transport.Done() and Transport.Err().
func (s *Server) Run() <-chan struct{} {
	return s.xp.receiveFrames()
}

// Err returns a non-nil error value after the channel returned by Run
// is closed.  After that channel is closed, successive calls to Err
// return the same value.
func (s *Server) Err() error {
	return s.xp.err()
}
