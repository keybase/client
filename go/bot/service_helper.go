package bot

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func ListTokens(m libkb.MetaContext) (res []keybase1.BotTokenInfo, err error) {
	return nil, nil
}

func CreateToken(m libkb.MetaContext) (res keybase1.BotToken, err error) {
	return keybase1.BotToken(""), nil
}

func DeleteToken(m libkb.MetaContext, tok keybase1.BotToken) (err error) {
	return nil
}
