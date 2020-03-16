// Auto-generated to Go types and interfaces using avdl-compiler v1.4.8 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/chat1/emoji.avdl

package chat1

import (
	"errors"
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type EmojiLoadSourceTyp int

const (
	EmojiLoadSourceTyp_HTTPSRV EmojiLoadSourceTyp = 0
)

func (o EmojiLoadSourceTyp) DeepCopy() EmojiLoadSourceTyp { return o }

var EmojiLoadSourceTypMap = map[string]EmojiLoadSourceTyp{
	"HTTPSRV": 0,
}

var EmojiLoadSourceTypRevMap = map[EmojiLoadSourceTyp]string{
	0: "HTTPSRV",
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
}

func (o *EmojiLoadSource) Typ() (ret EmojiLoadSourceTyp, err error) {
	switch o.Typ__ {
	case EmojiLoadSourceTyp_HTTPSRV:
		if o.Httpsrv__ == nil {
			err = errors.New("unexpected nil value for Httpsrv__")
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

func NewEmojiLoadSourceWithHttpsrv(v string) EmojiLoadSource {
	return EmojiLoadSource{
		Typ__:     EmojiLoadSourceTyp_HTTPSRV,
		Httpsrv__: &v,
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
	}
}

type Emoji struct {
	Alias  string          `codec:"alias" json:"alias"`
	Source EmojiLoadSource `codec:"source" json:"source"`
}

func (o Emoji) DeepCopy() Emoji {
	return Emoji{
		Alias:  o.Alias,
		Source: o.Source.DeepCopy(),
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
