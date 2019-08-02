package teambot

import (
	"github.com/keybase/client/go/libkb"
)

func NewTeambotKeyersAndInstall(mctx libkb.MetaContext) {
	botKeyer := NewBotKeyer(mctx)
	memberKeyer := NewMemberKeyer(mctx)
	mctx.G().AddLogoutHook(botKeyer, "TeambotBotKeyer")
	mctx.G().AddLogoutHook(memberKeyer, "TeambotMemberKeyer")
	mctx.G().AddDbNukeHook(botKeyer, "TeambotBotKeyer")
	mctx.G().AddDbNukeHook(memberKeyer, "TeambotMember")
	mctx.G().SetTeambotBotKeyer(botKeyer)
	mctx.G().SetTeambotMemberKeyer(memberKeyer)
}

func ServiceInit(mctx libkb.MetaContext) {
	NewTeambotKeyersAndInstall(mctx)
}
