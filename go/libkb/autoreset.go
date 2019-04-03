package libkb

import (
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func AutoresetReadyPrompt(m MetaContext) error {
	return nil
}

func AutoresetNotifyPrompt(m MetaContext, delaySecs int) error {
	rui, err := m.G().UIRouter.GetResetUI()
	if err != nil {
		m.G().Log.Error("GET RESET UI ERROR %s", err)
		return nil
	}
	m.G().Log.Error("RUI RES %+v", rui)
	res, err := rui.ResetPrompt(m.Ctx(), keybase1.ResetPromptArg{})
	m.G().Log.Error("PROMPT RES %v %v", res, err)
	return nil
}
