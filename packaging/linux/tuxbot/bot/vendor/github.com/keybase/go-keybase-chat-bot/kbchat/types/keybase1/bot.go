// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/bot.avdl

package keybase1

type BotToken string

func (o BotToken) DeepCopy() BotToken {
	return o
}

type BotTokenInfo struct {
	Token BotToken `codec:"token" json:"bot_token"`
	Ctime Time     `codec:"ctime" json:"ctime"`
}

func (o BotTokenInfo) DeepCopy() BotTokenInfo {
	return BotTokenInfo{
		Token: o.Token.DeepCopy(),
		Ctime: o.Ctime.DeepCopy(),
	}
}
