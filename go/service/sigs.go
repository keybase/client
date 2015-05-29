package service

import (
	"github.com/keybase/client/go/engine"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// SigsHandler is the RPC handler for the sigs interface.
type SigsHandler struct {
	*BaseHandler
}

// NewSigsHandler creates a SigsHandler for the xp transport.
func NewSigsHandler(xp *rpc2.Transport) *SigsHandler {
	return &SigsHandler{BaseHandler: NewBaseHandler(xp)}
}

func (h *SigsHandler) SigList(arg keybase1.SigListArg) ([]keybase1.Sig, error) {
	eng, err := h.run(arg.Arg)
	if err != nil {
		return nil, err
	}
	return eng.Sigs(), nil
}

func (h *SigsHandler) SigListJSON(arg keybase1.SigListJSONArg) (string, error) {
	eng, err := h.run(arg.Arg)
	if err != nil {
		return "", err
	}
	return eng.JSON()
}

func (h *SigsHandler) run(args keybase1.SigListArgs) (*engine.SigsList, error) {
	ctx := &engine.Context{}

	ea := engine.SigsListArgs{
		Username: args.Username,
		AllKeys:  args.AllKeys,
		Filterx:  args.Filterx,
		Verbose:  args.Verbose,
		Revoked:  args.Revoked,
		Types:    nil,
	}
	if args.Types != nil {
		t := make(map[string]bool)
		f := func(v bool, name string) {
			if v {
				t[name] = true
			}
		}
		f(args.Types.Track, "track")
		f(args.Types.Proof, "proof")
		f(args.Types.Cryptocurrency, "cryptocurrency")
		f(args.Types.Self, "self")
		ea.Types = t
	}
	eng := engine.NewSigsList(ea, G)
	if err := engine.RunEngine(eng, ctx); err != nil {
		return nil, err
	}
	return eng, nil
}
