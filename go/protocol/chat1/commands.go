// Auto-generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/chat1/commands.avdl

package chat1

import (
	"errors"
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type ConversationCommand struct {
	Description string  `codec:"description" json:"description"`
	Name        string  `codec:"name" json:"name"`
	Usage       string  `codec:"usage" json:"usage"`
	HasHelpText bool    `codec:"hasHelpText" json:"hasHelpText"`
	Username    *string `codec:"username,omitempty" json:"username,omitempty"`
}

func (o ConversationCommand) DeepCopy() ConversationCommand {
	return ConversationCommand{
		Description: o.Description,
		Name:        o.Name,
		Usage:       o.Usage,
		HasHelpText: o.HasHelpText,
		Username: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Username),
	}
}

type ConversationCommandGroupsTyp int

const (
	ConversationCommandGroupsTyp_BUILTIN ConversationCommandGroupsTyp = 0
	ConversationCommandGroupsTyp_CUSTOM  ConversationCommandGroupsTyp = 1
	ConversationCommandGroupsTyp_NONE    ConversationCommandGroupsTyp = 2
)

func (o ConversationCommandGroupsTyp) DeepCopy() ConversationCommandGroupsTyp { return o }

var ConversationCommandGroupsTypMap = map[string]ConversationCommandGroupsTyp{
	"BUILTIN": 0,
	"CUSTOM":  1,
	"NONE":    2,
}

var ConversationCommandGroupsTypRevMap = map[ConversationCommandGroupsTyp]string{
	0: "BUILTIN",
	1: "CUSTOM",
	2: "NONE",
}

func (e ConversationCommandGroupsTyp) String() string {
	if v, ok := ConversationCommandGroupsTypRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ConversationBuiltinCommandTyp int

const (
	ConversationBuiltinCommandTyp_NONE           ConversationBuiltinCommandTyp = 0
	ConversationBuiltinCommandTyp_ADHOC          ConversationBuiltinCommandTyp = 1
	ConversationBuiltinCommandTyp_SMALLTEAM      ConversationBuiltinCommandTyp = 2
	ConversationBuiltinCommandTyp_BIGTEAM        ConversationBuiltinCommandTyp = 3
	ConversationBuiltinCommandTyp_BIGTEAMGENERAL ConversationBuiltinCommandTyp = 4
)

func (o ConversationBuiltinCommandTyp) DeepCopy() ConversationBuiltinCommandTyp { return o }

var ConversationBuiltinCommandTypMap = map[string]ConversationBuiltinCommandTyp{
	"NONE":           0,
	"ADHOC":          1,
	"SMALLTEAM":      2,
	"BIGTEAM":        3,
	"BIGTEAMGENERAL": 4,
}

var ConversationBuiltinCommandTypRevMap = map[ConversationBuiltinCommandTyp]string{
	0: "NONE",
	1: "ADHOC",
	2: "SMALLTEAM",
	3: "BIGTEAM",
	4: "BIGTEAMGENERAL",
}

func (e ConversationBuiltinCommandTyp) String() string {
	if v, ok := ConversationBuiltinCommandTypRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ConversationCommandGroupsCustom struct {
	Commands []ConversationCommand `codec:"commands" json:"commands"`
}

func (o ConversationCommandGroupsCustom) DeepCopy() ConversationCommandGroupsCustom {
	return ConversationCommandGroupsCustom{
		Commands: (func(x []ConversationCommand) []ConversationCommand {
			if x == nil {
				return nil
			}
			ret := make([]ConversationCommand, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Commands),
	}
}

type ConversationCommandGroups struct {
	Typ__     ConversationCommandGroupsTyp     `codec:"typ" json:"typ"`
	Builtin__ *ConversationBuiltinCommandTyp   `codec:"builtin,omitempty" json:"builtin,omitempty"`
	Custom__  *ConversationCommandGroupsCustom `codec:"custom,omitempty" json:"custom,omitempty"`
}

func (o *ConversationCommandGroups) Typ() (ret ConversationCommandGroupsTyp, err error) {
	switch o.Typ__ {
	case ConversationCommandGroupsTyp_BUILTIN:
		if o.Builtin__ == nil {
			err = errors.New("unexpected nil value for Builtin__")
			return ret, err
		}
	case ConversationCommandGroupsTyp_CUSTOM:
		if o.Custom__ == nil {
			err = errors.New("unexpected nil value for Custom__")
			return ret, err
		}
	}
	return o.Typ__, nil
}

func (o ConversationCommandGroups) Builtin() (res ConversationBuiltinCommandTyp) {
	if o.Typ__ != ConversationCommandGroupsTyp_BUILTIN {
		panic("wrong case accessed")
	}
	if o.Builtin__ == nil {
		return
	}
	return *o.Builtin__
}

func (o ConversationCommandGroups) Custom() (res ConversationCommandGroupsCustom) {
	if o.Typ__ != ConversationCommandGroupsTyp_CUSTOM {
		panic("wrong case accessed")
	}
	if o.Custom__ == nil {
		return
	}
	return *o.Custom__
}

func NewConversationCommandGroupsWithBuiltin(v ConversationBuiltinCommandTyp) ConversationCommandGroups {
	return ConversationCommandGroups{
		Typ__:     ConversationCommandGroupsTyp_BUILTIN,
		Builtin__: &v,
	}
}

func NewConversationCommandGroupsWithCustom(v ConversationCommandGroupsCustom) ConversationCommandGroups {
	return ConversationCommandGroups{
		Typ__:    ConversationCommandGroupsTyp_CUSTOM,
		Custom__: &v,
	}
}

func NewConversationCommandGroupsWithNone() ConversationCommandGroups {
	return ConversationCommandGroups{
		Typ__: ConversationCommandGroupsTyp_NONE,
	}
}

func (o ConversationCommandGroups) DeepCopy() ConversationCommandGroups {
	return ConversationCommandGroups{
		Typ__: o.Typ__.DeepCopy(),
		Builtin__: (func(x *ConversationBuiltinCommandTyp) *ConversationBuiltinCommandTyp {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Builtin__),
		Custom__: (func(x *ConversationCommandGroupsCustom) *ConversationCommandGroupsCustom {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Custom__),
	}
}

type CommandsInterface interface {
}

func CommandsProtocol(i CommandsInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "chat.1.commands",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type CommandsClient struct {
	Cli rpc.GenericClient
}
