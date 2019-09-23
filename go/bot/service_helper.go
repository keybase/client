package bot

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func ListTokens(mctx libkb.MetaContext) (res []keybase1.BotTokenInfo, err error) {
	type resType struct {
		libkb.AppStatusEmbed
		Tokens []keybase1.BotTokenInfo `json:"bot_tokens"`
	}
	var tmp resType
	err = mctx.G().API.GetDecode(mctx, libkb.APIArg{
		Endpoint:    "bot/token/list",
		SessionType: libkb.APISessionTypeREQUIRED,
	}, &tmp)
	if err != nil {
		return res, err
	}
	return tmp.Tokens, nil
}

func CreateToken(mctx libkb.MetaContext) (res keybase1.BotToken, err error) {
	type resType struct {
		libkb.AppStatusEmbed
		Token keybase1.BotToken `json:"bot_token"`
	}
	var tmp resType
	err = mctx.G().API.PostDecode(mctx, libkb.APIArg{
		Endpoint:    "bot/token/create",
		SessionType: libkb.APISessionTypeREQUIRED,
	}, &tmp)
	if err != nil {
		return res, err
	}

	return tmp.Token, nil
}

func DeleteToken(mctx libkb.MetaContext, tok keybase1.BotToken) (err error) {
	_, err = mctx.G().API.Post(mctx, libkb.APIArg{
		Endpoint:    "bot/token/delete",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"bot_token": libkb.S{Val: tok.String()},
		},
	})
	return err
}
