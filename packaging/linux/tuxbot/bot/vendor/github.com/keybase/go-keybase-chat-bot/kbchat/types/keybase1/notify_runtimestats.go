// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/notify_runtimestats.avdl

package keybase1

import (
	"fmt"
)

type StatsSeverityLevel int

const (
	StatsSeverityLevel_NORMAL  StatsSeverityLevel = 0
	StatsSeverityLevel_WARNING StatsSeverityLevel = 1
	StatsSeverityLevel_SEVERE  StatsSeverityLevel = 2
)

func (o StatsSeverityLevel) DeepCopy() StatsSeverityLevel { return o }

var StatsSeverityLevelMap = map[string]StatsSeverityLevel{
	"NORMAL":  0,
	"WARNING": 1,
	"SEVERE":  2,
}

var StatsSeverityLevelRevMap = map[StatsSeverityLevel]string{
	0: "NORMAL",
	1: "WARNING",
	2: "SEVERE",
}

func (e StatsSeverityLevel) String() string {
	if v, ok := StatsSeverityLevelRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type DbStats struct {
	Type            DbType `codec:"type" json:"type"`
	MemCompActive   bool   `codec:"memCompActive" json:"memCompActive"`
	TableCompActive bool   `codec:"tableCompActive" json:"tableCompActive"`
}

func (o DbStats) DeepCopy() DbStats {
	return DbStats{
		Type:            o.Type.DeepCopy(),
		MemCompActive:   o.MemCompActive,
		TableCompActive: o.TableCompActive,
	}
}

type ProcessType int

const (
	ProcessType_MAIN ProcessType = 0
	ProcessType_KBFS ProcessType = 1
)

func (o ProcessType) DeepCopy() ProcessType { return o }

var ProcessTypeMap = map[string]ProcessType{
	"MAIN": 0,
	"KBFS": 1,
}

var ProcessTypeRevMap = map[ProcessType]string{
	0: "MAIN",
	1: "KBFS",
}

func (e ProcessType) String() string {
	if v, ok := ProcessTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ProcessRuntimeStats struct {
	Type             ProcessType        `codec:"type" json:"type"`
	Cpu              string             `codec:"cpu" json:"cpu"`
	Resident         string             `codec:"resident" json:"resident"`
	Virt             string             `codec:"virt" json:"virt"`
	Free             string             `codec:"free" json:"free"`
	Goheap           string             `codec:"goheap" json:"goheap"`
	Goheapsys        string             `codec:"goheapsys" json:"goheapsys"`
	Goreleased       string             `codec:"goreleased" json:"goreleased"`
	CpuSeverity      StatsSeverityLevel `codec:"cpuSeverity" json:"cpuSeverity"`
	ResidentSeverity StatsSeverityLevel `codec:"residentSeverity" json:"residentSeverity"`
}

func (o ProcessRuntimeStats) DeepCopy() ProcessRuntimeStats {
	return ProcessRuntimeStats{
		Type:             o.Type.DeepCopy(),
		Cpu:              o.Cpu,
		Resident:         o.Resident,
		Virt:             o.Virt,
		Free:             o.Free,
		Goheap:           o.Goheap,
		Goheapsys:        o.Goheapsys,
		Goreleased:       o.Goreleased,
		CpuSeverity:      o.CpuSeverity.DeepCopy(),
		ResidentSeverity: o.ResidentSeverity.DeepCopy(),
	}
}

type RuntimeStats struct {
	ProcessStats        []ProcessRuntimeStats `codec:"processStats" json:"processStats"`
	DbStats             []DbStats             `codec:"dbStats" json:"dbStats"`
	ConvLoaderActive    bool                  `codec:"convLoaderActive" json:"convLoaderActive"`
	SelectiveSyncActive bool                  `codec:"selectiveSyncActive" json:"selectiveSyncActive"`
}

func (o RuntimeStats) DeepCopy() RuntimeStats {
	return RuntimeStats{
		ProcessStats: (func(x []ProcessRuntimeStats) []ProcessRuntimeStats {
			if x == nil {
				return nil
			}
			ret := make([]ProcessRuntimeStats, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.ProcessStats),
		DbStats: (func(x []DbStats) []DbStats {
			if x == nil {
				return nil
			}
			ret := make([]DbStats, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.DbStats),
		ConvLoaderActive:    o.ConvLoaderActive,
		SelectiveSyncActive: o.SelectiveSyncActive,
	}
}
