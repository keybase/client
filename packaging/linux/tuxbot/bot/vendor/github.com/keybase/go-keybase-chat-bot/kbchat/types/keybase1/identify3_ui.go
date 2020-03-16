// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/identify3_ui.avdl

package keybase1

import (
	"fmt"
)

type Identify3RowState int

const (
	Identify3RowState_CHECKING Identify3RowState = 1
	Identify3RowState_VALID    Identify3RowState = 2
	Identify3RowState_ERROR    Identify3RowState = 3
	Identify3RowState_WARNING  Identify3RowState = 4
	Identify3RowState_REVOKED  Identify3RowState = 5
)

func (o Identify3RowState) DeepCopy() Identify3RowState { return o }

var Identify3RowStateMap = map[string]Identify3RowState{
	"CHECKING": 1,
	"VALID":    2,
	"ERROR":    3,
	"WARNING":  4,
	"REVOKED":  5,
}

var Identify3RowStateRevMap = map[Identify3RowState]string{
	1: "CHECKING",
	2: "VALID",
	3: "ERROR",
	4: "WARNING",
	5: "REVOKED",
}

func (e Identify3RowState) String() string {
	if v, ok := Identify3RowStateRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type Identify3RowColor int

const (
	Identify3RowColor_BLUE   Identify3RowColor = 1
	Identify3RowColor_RED    Identify3RowColor = 2
	Identify3RowColor_BLACK  Identify3RowColor = 3
	Identify3RowColor_GREEN  Identify3RowColor = 4
	Identify3RowColor_GRAY   Identify3RowColor = 5
	Identify3RowColor_YELLOW Identify3RowColor = 6
	Identify3RowColor_ORANGE Identify3RowColor = 7
)

func (o Identify3RowColor) DeepCopy() Identify3RowColor { return o }

var Identify3RowColorMap = map[string]Identify3RowColor{
	"BLUE":   1,
	"RED":    2,
	"BLACK":  3,
	"GREEN":  4,
	"GRAY":   5,
	"YELLOW": 6,
	"ORANGE": 7,
}

var Identify3RowColorRevMap = map[Identify3RowColor]string{
	1: "BLUE",
	2: "RED",
	3: "BLACK",
	4: "GREEN",
	5: "GRAY",
	6: "YELLOW",
	7: "ORANGE",
}

func (e Identify3RowColor) String() string {
	if v, ok := Identify3RowColorRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type Identify3ResultType int

const (
	Identify3ResultType_OK            Identify3ResultType = 0
	Identify3ResultType_BROKEN        Identify3ResultType = 1
	Identify3ResultType_NEEDS_UPGRADE Identify3ResultType = 2
	Identify3ResultType_CANCELED      Identify3ResultType = 3
)

func (o Identify3ResultType) DeepCopy() Identify3ResultType { return o }

var Identify3ResultTypeMap = map[string]Identify3ResultType{
	"OK":            0,
	"BROKEN":        1,
	"NEEDS_UPGRADE": 2,
	"CANCELED":      3,
}

var Identify3ResultTypeRevMap = map[Identify3ResultType]string{
	0: "OK",
	1: "BROKEN",
	2: "NEEDS_UPGRADE",
	3: "CANCELED",
}

func (e Identify3ResultType) String() string {
	if v, ok := Identify3ResultTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type Identify3RowMeta struct {
	Color Identify3RowColor `codec:"color" json:"color"`
	Label string            `codec:"label" json:"label"`
}

func (o Identify3RowMeta) DeepCopy() Identify3RowMeta {
	return Identify3RowMeta{
		Color: o.Color.DeepCopy(),
		Label: o.Label,
	}
}

type Identify3Row struct {
	GuiID         Identify3GUIID     `codec:"guiID" json:"guiID"`
	Key           string             `codec:"key" json:"key"`
	Value         string             `codec:"value" json:"value"`
	Priority      int                `codec:"priority" json:"priority"`
	SiteURL       string             `codec:"siteURL" json:"siteURL"`
	SiteIcon      []SizedImage       `codec:"siteIcon" json:"siteIcon"`
	SiteIconFull  []SizedImage       `codec:"siteIconFull" json:"siteIconFull"`
	SiteIconWhite []SizedImage       `codec:"siteIconWhite" json:"siteIconWhite"`
	ProofURL      string             `codec:"proofURL" json:"proofURL"`
	SigID         SigID              `codec:"sigID" json:"sigID"`
	Ctime         Time               `codec:"ctime" json:"ctime"`
	State         Identify3RowState  `codec:"state" json:"state"`
	Metas         []Identify3RowMeta `codec:"metas" json:"metas"`
	Color         Identify3RowColor  `codec:"color" json:"color"`
	Kid           *KID               `codec:"kid,omitempty" json:"kid,omitempty"`
}

func (o Identify3Row) DeepCopy() Identify3Row {
	return Identify3Row{
		GuiID:    o.GuiID.DeepCopy(),
		Key:      o.Key,
		Value:    o.Value,
		Priority: o.Priority,
		SiteURL:  o.SiteURL,
		SiteIcon: (func(x []SizedImage) []SizedImage {
			if x == nil {
				return nil
			}
			ret := make([]SizedImage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.SiteIcon),
		SiteIconFull: (func(x []SizedImage) []SizedImage {
			if x == nil {
				return nil
			}
			ret := make([]SizedImage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.SiteIconFull),
		SiteIconWhite: (func(x []SizedImage) []SizedImage {
			if x == nil {
				return nil
			}
			ret := make([]SizedImage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.SiteIconWhite),
		ProofURL: o.ProofURL,
		SigID:    o.SigID.DeepCopy(),
		Ctime:    o.Ctime.DeepCopy(),
		State:    o.State.DeepCopy(),
		Metas: (func(x []Identify3RowMeta) []Identify3RowMeta {
			if x == nil {
				return nil
			}
			ret := make([]Identify3RowMeta, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Metas),
		Color: o.Color.DeepCopy(),
		Kid: (func(x *KID) *KID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Kid),
	}
}
