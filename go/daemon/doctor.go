package main

import (
	"github.com/keybase/client/go/engine"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// DoctorHandler implements the keybase_1.Doctor protocol
type DoctorHandler struct {
	BaseHandler
}

func NewDoctorHandler(xp *rpc2.Transport) *DoctorHandler {
	return &DoctorHandler{BaseHandler{xp: xp}}
}

func (h *DoctorHandler) Doctor(sessionID int) error {
	ctx := &engine.Context{
		DoctorUI: h.ui(sessionID),
		LogUI:    h.getLogUI(sessionID),
		SecretUI: h.getSecretUI(sessionID),
	}
	eng := engine.NewDoctor()
	return engine.RunEngine(eng, ctx)
}

func (h *DoctorHandler) ui(sessionID int) *RemoteDoctorUI {
	c := h.getRpcClient()
	return &RemoteDoctorUI{
		sessionID: sessionID,
		uicli:     keybase_1.DoctorUiClient{Cli: c},
	}
}

type RemoteDoctorUI struct {
	sessionID int
	uicli     keybase_1.DoctorUiClient
}

func (r *RemoteDoctorUI) LoginSelect(currentUser string, otherUsers []string) (string, error) {
	return r.uicli.LoginSelect(keybase_1.LoginSelectArg{
		SessionID:   r.sessionID,
		CurrentUser: currentUser,
		OtherUsers:  otherUsers,
	})
}

func (r *RemoteDoctorUI) DisplayStatus() error {
	return r.uicli.DisplayStatus(r.sessionID)
}

func (r *RemoteDoctorUI) DisplayResult() error {
	return r.uicli.DisplayResult(r.sessionID)
}
