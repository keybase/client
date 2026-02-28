package tlfupgrade

import (
	"errors"

	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type GetTLFForUpgradeResType int

const (
	GetTLFForUpgradeResType_TLFAVAILABLE GetTLFForUpgradeResType = 0
	GetTLFForUpgradeResType_DELAY        GetTLFForUpgradeResType = 1
	GetTLFForUpgradeResType_ERR          GetTLFForUpgradeResType = 2
	GetTLFForUpgradeResType_DISABLED     GetTLFForUpgradeResType = 3
)

func (o GetTLFForUpgradeResType) DeepCopy() GetTLFForUpgradeResType { return o }

var GetTLFForUpgradeResTypeMap = map[string]GetTLFForUpgradeResType{
	"TLFAVAILABLE": 0,
	"DELAY":        1,
	"ERR":          2,
	"DISABLED":     3,
}

var GetTLFForUpgradeResTypeRevMap = map[GetTLFForUpgradeResType]string{
	0: "TLFAVAILABLE",
	1: "DELAY",
	2: "ERR",
	3: "DISABLED",
}

func (e GetTLFForUpgradeResType) String() string {
	if v, ok := GetTLFForUpgradeResTypeRevMap[e]; ok {
		return v
	}
	return ""
}

type DelayReason int

const (
	DelayReason_MISS     DelayReason = 0
	DelayReason_INFLIGHT DelayReason = 1
)

func (o DelayReason) DeepCopy() DelayReason { return o }

var DelayReasonMap = map[string]DelayReason{
	"MISS":     0,
	"INFLIGHT": 1,
}

var DelayReasonRevMap = map[DelayReason]string{
	0: "MISS",
	1: "INFLIGHT",
}

func (e DelayReason) String() string {
	if v, ok := DelayReasonRevMap[e]; ok {
		return v
	}
	return ""
}

type GetTLFForUpgradeAvailableRes struct {
	TlfID    keybase1.TLFID `codec:"tlfID" json:"tlfID"`
	TlfName  string         `codec:"tlfName" json:"tlfName"`
	IsPublic bool           `codec:"isPublic" json:"isPublic"`
}

func (o GetTLFForUpgradeAvailableRes) DeepCopy() GetTLFForUpgradeAvailableRes {
	return GetTLFForUpgradeAvailableRes{
		TlfID:    o.TlfID.DeepCopy(),
		TlfName:  o.TlfName,
		IsPublic: o.IsPublic,
	}
}

type GetTLFForUpgradeDelayRes struct {
	Delay  gregor1.Time `codec:"delay" json:"delay"`
	Reason DelayReason  `codec:"reason" json:"reason"`
}

func (o GetTLFForUpgradeDelayRes) DeepCopy() GetTLFForUpgradeDelayRes {
	return GetTLFForUpgradeDelayRes{
		Delay:  o.Delay.DeepCopy(),
		Reason: o.Reason.DeepCopy(),
	}
}

type GetTLFForUpgradeErrRes struct {
	Error string       `codec:"error" json:"error"`
	Delay gregor1.Time `codec:"delay" json:"delay"`
}

func (o GetTLFForUpgradeErrRes) DeepCopy() GetTLFForUpgradeErrRes {
	return GetTLFForUpgradeErrRes{
		Error: o.Error,
		Delay: o.Delay.DeepCopy(),
	}
}

type GetTLFForUpgradeDisabledRes struct {
	Delay gregor1.Time `codec:"delay" json:"delay"`
}

func (o GetTLFForUpgradeDisabledRes) DeepCopy() GetTLFForUpgradeDisabledRes {
	return GetTLFForUpgradeDisabledRes{
		Delay: o.Delay.DeepCopy(),
	}
}

type GetTLFForUpgradeRes struct {
	Typ__          GetTLFForUpgradeResType       `codec:"typ" json:"typ"`
	Tlfavailable__ *GetTLFForUpgradeAvailableRes `codec:"tlfavailable,omitempty" json:"tlfavailable,omitempty"`
	Delay__        *GetTLFForUpgradeDelayRes     `codec:"delay,omitempty" json:"delay,omitempty"`
	Err__          *GetTLFForUpgradeErrRes       `codec:"err,omitempty" json:"err,omitempty"`
	Disabled__     *GetTLFForUpgradeDisabledRes  `codec:"disabled,omitempty" json:"disabled,omitempty"`
}

func (o *GetTLFForUpgradeRes) Typ() (ret GetTLFForUpgradeResType, err error) {
	switch o.Typ__ {
	case GetTLFForUpgradeResType_TLFAVAILABLE:
		if o.Tlfavailable__ == nil {
			err = errors.New("unexpected nil value for Tlfavailable__")
			return ret, err
		}
	case GetTLFForUpgradeResType_DELAY:
		if o.Delay__ == nil {
			err = errors.New("unexpected nil value for Delay__")
			return ret, err
		}
	case GetTLFForUpgradeResType_ERR:
		if o.Err__ == nil {
			err = errors.New("unexpected nil value for Err__")
			return ret, err
		}
	case GetTLFForUpgradeResType_DISABLED:
		if o.Disabled__ == nil {
			err = errors.New("unexpected nil value for Disabled__")
			return ret, err
		}
	}
	return o.Typ__, nil
}

func (o GetTLFForUpgradeRes) Tlfavailable() (res GetTLFForUpgradeAvailableRes) {
	if o.Typ__ != GetTLFForUpgradeResType_TLFAVAILABLE {
		panic("wrong case accessed")
	}
	if o.Tlfavailable__ == nil {
		return
	}
	return *o.Tlfavailable__
}

func (o GetTLFForUpgradeRes) Delay() (res GetTLFForUpgradeDelayRes) {
	if o.Typ__ != GetTLFForUpgradeResType_DELAY {
		panic("wrong case accessed")
	}
	if o.Delay__ == nil {
		return
	}
	return *o.Delay__
}

func (o GetTLFForUpgradeRes) Err() (res GetTLFForUpgradeErrRes) {
	if o.Typ__ != GetTLFForUpgradeResType_ERR {
		panic("wrong case accessed")
	}
	if o.Err__ == nil {
		return
	}
	return *o.Err__
}

func (o GetTLFForUpgradeRes) Disabled() (res GetTLFForUpgradeDisabledRes) {
	if o.Typ__ != GetTLFForUpgradeResType_DISABLED {
		panic("wrong case accessed")
	}
	if o.Disabled__ == nil {
		return
	}
	return *o.Disabled__
}

func NewGetTLFForUpgradeResWithTlfavailable(v GetTLFForUpgradeAvailableRes) GetTLFForUpgradeRes {
	return GetTLFForUpgradeRes{
		Typ__:          GetTLFForUpgradeResType_TLFAVAILABLE,
		Tlfavailable__: &v,
	}
}

func NewGetTLFForUpgradeResWithDelay(v GetTLFForUpgradeDelayRes) GetTLFForUpgradeRes {
	return GetTLFForUpgradeRes{
		Typ__:   GetTLFForUpgradeResType_DELAY,
		Delay__: &v,
	}
}

func NewGetTLFForUpgradeResWithErr(v GetTLFForUpgradeErrRes) GetTLFForUpgradeRes {
	return GetTLFForUpgradeRes{
		Typ__: GetTLFForUpgradeResType_ERR,
		Err__: &v,
	}
}

func NewGetTLFForUpgradeResWithDisabled(v GetTLFForUpgradeDisabledRes) GetTLFForUpgradeRes {
	return GetTLFForUpgradeRes{
		Typ__:      GetTLFForUpgradeResType_DISABLED,
		Disabled__: &v,
	}
}

func (o GetTLFForUpgradeRes) DeepCopy() GetTLFForUpgradeRes {
	return GetTLFForUpgradeRes{
		Typ__: o.Typ__.DeepCopy(),
		Tlfavailable__: (func(x *GetTLFForUpgradeAvailableRes) *GetTLFForUpgradeAvailableRes {
			if x == nil {
				return nil
			}
			tmp := x.DeepCopy()
			return &tmp
		})(o.Tlfavailable__),
		Delay__: (func(x *GetTLFForUpgradeDelayRes) *GetTLFForUpgradeDelayRes {
			if x == nil {
				return nil
			}
			tmp := x.DeepCopy()
			return &tmp
		})(o.Delay__),
		Err__: (func(x *GetTLFForUpgradeErrRes) *GetTLFForUpgradeErrRes {
			if x == nil {
				return nil
			}
			tmp := x.DeepCopy()
			return &tmp
		})(o.Err__),
		Disabled__: (func(x *GetTLFForUpgradeDisabledRes) *GetTLFForUpgradeDisabledRes {
			if x == nil {
				return nil
			}
			tmp := x.DeepCopy()
			return &tmp
		})(o.Disabled__),
	}
}
