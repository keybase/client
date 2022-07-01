// Auto-generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/chat1/emoji.avdl

package chat1

import (
	"errors"
	"fmt"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type EmojiLoadSourceTyp int

const (
	EmojiLoadSourceTyp_HTTPSRV EmojiLoadSourceTyp = 0
	EmojiLoadSourceTyp_STR     EmojiLoadSourceTyp = 1
)

func (o EmojiLoadSourceTyp) DeepCopy() EmojiLoadSourceTyp { return o }

var EmojiLoadSourceTypMap = map[string]EmojiLoadSourceTyp{
	"HTTPSRV": 0,
	"STR":     1,
}

var EmojiLoadSourceTypRevMap = map[EmojiLoadSourceTyp]string{
	0: "HTTPSRV",
	1: "STR",
}

func (e EmojiLoadSourceTyp) String() string {
	if v, ok := EmojiLoadSourceTypRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type EmojiLoadSource struct {
	Typ__     EmojiLoadSourceTyp `codec:"typ" json:"typ"`
	Httpsrv__ *string            `codec:"httpsrv,omitempty" json:"httpsrv,omitempty"`
	Str__     *string            `codec:"str,omitempty" json:"str,omitempty"`
}

func (o *EmojiLoadSource) Typ() (ret EmojiLoadSourceTyp, err error) {
	switch o.Typ__ {
	case EmojiLoadSourceTyp_HTTPSRV:
		if o.Httpsrv__ == nil {
			err = errors.New("unexpected nil value for Httpsrv__")
			return ret, err
		}
	case EmojiLoadSourceTyp_STR:
		if o.Str__ == nil {
			err = errors.New("unexpected nil value for Str__")
			return ret, err
		}
	}
	return o.Typ__, nil
}

func (o EmojiLoadSource) Httpsrv() (res string) {
	if o.Typ__ != EmojiLoadSourceTyp_HTTPSRV {
		panic("wrong case accessed")
	}
	if o.Httpsrv__ == nil {
		return
	}
	return *o.Httpsrv__
}

func (o EmojiLoadSource) Str() (res string) {
	if o.Typ__ != EmojiLoadSourceTyp_STR {
		panic("wrong case accessed")
	}
	if o.Str__ == nil {
		return
	}
	return *o.Str__
}

func NewEmojiLoadSourceWithHttpsrv(v string) EmojiLoadSource {
	return EmojiLoadSource{
		Typ__:     EmojiLoadSourceTyp_HTTPSRV,
		Httpsrv__: &v,
	}
}

func NewEmojiLoadSourceWithStr(v string) EmojiLoadSource {
	return EmojiLoadSource{
		Typ__: EmojiLoadSourceTyp_STR,
		Str__: &v,
	}
}

func (o EmojiLoadSource) DeepCopy() EmojiLoadSource {
	return EmojiLoadSource{
		Typ__: o.Typ__.DeepCopy(),
		Httpsrv__: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Httpsrv__),
		Str__: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Str__),
	}
}

type EmojiRemoteSourceTyp int

const (
	EmojiRemoteSourceTyp_MESSAGE    EmojiRemoteSourceTyp = 0
	EmojiRemoteSourceTyp_STOCKALIAS EmojiRemoteSourceTyp = 1
)

func (o EmojiRemoteSourceTyp) DeepCopy() EmojiRemoteSourceTyp { return o }

var EmojiRemoteSourceTypMap = map[string]EmojiRemoteSourceTyp{
	"MESSAGE":    0,
	"STOCKALIAS": 1,
}

var EmojiRemoteSourceTypRevMap = map[EmojiRemoteSourceTyp]string{
	0: "MESSAGE",
	1: "STOCKALIAS",
}

func (e EmojiRemoteSourceTyp) String() string {
	if v, ok := EmojiRemoteSourceTypRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type EmojiMessage struct {
	ConvID  ConversationID `codec:"convID" json:"convID"`
	MsgID   MessageID      `codec:"msgID" json:"msgID"`
	IsAlias bool           `codec:"isAlias" json:"isAlias"`
}

func (o EmojiMessage) DeepCopy() EmojiMessage {
	return EmojiMessage{
		ConvID:  o.ConvID.DeepCopy(),
		MsgID:   o.MsgID.DeepCopy(),
		IsAlias: o.IsAlias,
	}
}

type EmojiStockAlias struct {
	Text     string       `codec:"text" json:"text"`
	Username string       `codec:"username" json:"username"`
	Time     gregor1.Time `codec:"time" json:"time"`
}

func (o EmojiStockAlias) DeepCopy() EmojiStockAlias {
	return EmojiStockAlias{
		Text:     o.Text,
		Username: o.Username,
		Time:     o.Time.DeepCopy(),
	}
}

type EmojiRemoteSource struct {
	Typ__        EmojiRemoteSourceTyp `codec:"typ" json:"typ"`
	Message__    *EmojiMessage        `codec:"message,omitempty" json:"message,omitempty"`
	Stockalias__ *EmojiStockAlias     `codec:"stockalias,omitempty" json:"stockalias,omitempty"`
}

func (o *EmojiRemoteSource) Typ() (ret EmojiRemoteSourceTyp, err error) {
	switch o.Typ__ {
	case EmojiRemoteSourceTyp_MESSAGE:
		if o.Message__ == nil {
			err = errors.New("unexpected nil value for Message__")
			return ret, err
		}
	case EmojiRemoteSourceTyp_STOCKALIAS:
		if o.Stockalias__ == nil {
			err = errors.New("unexpected nil value for Stockalias__")
			return ret, err
		}
	}
	return o.Typ__, nil
}

func (o EmojiRemoteSource) Message() (res EmojiMessage) {
	if o.Typ__ != EmojiRemoteSourceTyp_MESSAGE {
		panic("wrong case accessed")
	}
	if o.Message__ == nil {
		return
	}
	return *o.Message__
}

func (o EmojiRemoteSource) Stockalias() (res EmojiStockAlias) {
	if o.Typ__ != EmojiRemoteSourceTyp_STOCKALIAS {
		panic("wrong case accessed")
	}
	if o.Stockalias__ == nil {
		return
	}
	return *o.Stockalias__
}

func NewEmojiRemoteSourceWithMessage(v EmojiMessage) EmojiRemoteSource {
	return EmojiRemoteSource{
		Typ__:     EmojiRemoteSourceTyp_MESSAGE,
		Message__: &v,
	}
}

func NewEmojiRemoteSourceWithStockalias(v EmojiStockAlias) EmojiRemoteSource {
	return EmojiRemoteSource{
		Typ__:        EmojiRemoteSourceTyp_STOCKALIAS,
		Stockalias__: &v,
	}
}

func (o EmojiRemoteSource) DeepCopy() EmojiRemoteSource {
	return EmojiRemoteSource{
		Typ__: o.Typ__.DeepCopy(),
		Message__: (func(x *EmojiMessage) *EmojiMessage {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Message__),
		Stockalias__: (func(x *EmojiStockAlias) *EmojiStockAlias {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Stockalias__),
	}
}

type HarvestedEmoji struct {
	Alias       string            `codec:"alias" json:"alias"`
	IsBig       bool              `codec:"isBig" json:"isBig"`
	IsCrossTeam bool              `codec:"isCrossTeam" json:"isCrossTeam"`
	Source      EmojiRemoteSource `codec:"source" json:"source"`
}

func (o HarvestedEmoji) DeepCopy() HarvestedEmoji {
	return HarvestedEmoji{
		Alias:       o.Alias,
		IsBig:       o.IsBig,
		IsCrossTeam: o.IsCrossTeam,
		Source:      o.Source.DeepCopy(),
	}
}

type EmojiCreationInfo struct {
	Username string       `codec:"username" json:"username"`
	Time     gregor1.Time `codec:"time" json:"time"`
}

func (o EmojiCreationInfo) DeepCopy() EmojiCreationInfo {
	return EmojiCreationInfo{
		Username: o.Username,
		Time:     o.Time.DeepCopy(),
	}
}

type Emoji struct {
	Alias        string             `codec:"alias" json:"alias"`
	IsBig        bool               `codec:"isBig" json:"isBig"`
	IsReacji     bool               `codec:"isReacji" json:"isReacji"`
	IsCrossTeam  bool               `codec:"isCrossTeam" json:"isCrossTeam"`
	IsAlias      bool               `codec:"isAlias" json:"isAlias"`
	Source       EmojiLoadSource    `codec:"source" json:"source"`
	NoAnimSource EmojiLoadSource    `codec:"noAnimSource" json:"noAnimSource"`
	RemoteSource EmojiRemoteSource  `codec:"remoteSource" json:"remoteSource"`
	CreationInfo *EmojiCreationInfo `codec:"creationInfo,omitempty" json:"creationInfo,omitempty"`
	Teamname     *string            `codec:"teamname,omitempty" json:"teamname,omitempty"`
}

func (o Emoji) DeepCopy() Emoji {
	return Emoji{
		Alias:        o.Alias,
		IsBig:        o.IsBig,
		IsReacji:     o.IsReacji,
		IsCrossTeam:  o.IsCrossTeam,
		IsAlias:      o.IsAlias,
		Source:       o.Source.DeepCopy(),
		NoAnimSource: o.NoAnimSource.DeepCopy(),
		RemoteSource: o.RemoteSource.DeepCopy(),
		CreationInfo: (func(x *EmojiCreationInfo) *EmojiCreationInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.CreationInfo),
		Teamname: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Teamname),
	}
}

type EmojiGroup struct {
	Name   string  `codec:"name" json:"name"`
	Emojis []Emoji `codec:"emojis" json:"emojis"`
}

func (o EmojiGroup) DeepCopy() EmojiGroup {
	return EmojiGroup{
		Name: o.Name,
		Emojis: (func(x []Emoji) []Emoji {
			if x == nil {
				return nil
			}
			ret := make([]Emoji, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Emojis),
	}
}

type UserEmojis struct {
	Emojis []EmojiGroup `codec:"emojis" json:"emojis"`
}

func (o UserEmojis) DeepCopy() UserEmojis {
	return UserEmojis{
		Emojis: (func(x []EmojiGroup) []EmojiGroup {
			if x == nil {
				return nil
			}
			ret := make([]EmojiGroup, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Emojis),
	}
}

type EmojiStorage struct {
	Mapping map[string]EmojiRemoteSource `codec:"mapping" json:"mapping"`
}

func (o EmojiStorage) DeepCopy() EmojiStorage {
	return EmojiStorage{
		Mapping: (func(x map[string]EmojiRemoteSource) map[string]EmojiRemoteSource {
			if x == nil {
				return nil
			}
			ret := make(map[string]EmojiRemoteSource, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.Mapping),
	}
}

type EmojiInterface interface {
}

func EmojiProtocol(i EmojiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "chat.1.emoji",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type EmojiClient struct {
	Cli rpc.GenericClient
}
