// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/notify_runtimestats.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
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

type PerfEventType int

const (
	PerfEventType_NETWORK      PerfEventType = 0
	PerfEventType_TEAMBOXAUDIT PerfEventType = 1
	PerfEventType_TEAMAUDIT    PerfEventType = 2
	PerfEventType_USERCHAIN    PerfEventType = 3
	PerfEventType_TEAMCHAIN    PerfEventType = 4
	PerfEventType_CLEARCONV    PerfEventType = 5
	PerfEventType_CLEARINBOX   PerfEventType = 6
	PerfEventType_TEAMTREELOAD PerfEventType = 7
)

func (o PerfEventType) DeepCopy() PerfEventType { return o }

var PerfEventTypeMap = map[string]PerfEventType{
	"NETWORK":      0,
	"TEAMBOXAUDIT": 1,
	"TEAMAUDIT":    2,
	"USERCHAIN":    3,
	"TEAMCHAIN":    4,
	"CLEARCONV":    5,
	"CLEARINBOX":   6,
	"TEAMTREELOAD": 7,
}

var PerfEventTypeRevMap = map[PerfEventType]string{
	0: "NETWORK",
	1: "TEAMBOXAUDIT",
	2: "TEAMAUDIT",
	3: "USERCHAIN",
	4: "TEAMCHAIN",
	5: "CLEARCONV",
	6: "CLEARINBOX",
	7: "TEAMTREELOAD",
}

func (e PerfEventType) String() string {
	if v, ok := PerfEventTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type PerfEvent struct {
	Message   string        `codec:"message" json:"message"`
	Ctime     Time          `codec:"ctime" json:"ctime"`
	EventType PerfEventType `codec:"eventType" json:"eventType"`
}

func (o PerfEvent) DeepCopy() PerfEvent {
	return PerfEvent{
		Message:   o.Message,
		Ctime:     o.Ctime.DeepCopy(),
		EventType: o.EventType.DeepCopy(),
	}
}

type RuntimeStats struct {
	ProcessStats        []ProcessRuntimeStats `codec:"processStats" json:"processStats"`
	DbStats             []DbStats             `codec:"dbStats" json:"dbStats"`
	PerfEvents          []PerfEvent           `codec:"perfEvents" json:"perfEvents"`
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
		PerfEvents: (func(x []PerfEvent) []PerfEvent {
			if x == nil {
				return nil
			}
			ret := make([]PerfEvent, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.PerfEvents),
		ConvLoaderActive:    o.ConvLoaderActive,
		SelectiveSyncActive: o.SelectiveSyncActive,
	}
}

type RuntimeStatsUpdateArg struct {
	Stats *RuntimeStats `codec:"stats,omitempty" json:"stats,omitempty"`
}

type NotifyRuntimeStatsInterface interface {
	RuntimeStatsUpdate(context.Context, *RuntimeStats) error
}

func NotifyRuntimeStatsProtocol(i NotifyRuntimeStatsInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyRuntimeStats",
		Methods: map[string]rpc.ServeHandlerDescription{
			"runtimeStatsUpdate": {
				MakeArg: func() interface{} {
					var ret [1]RuntimeStatsUpdateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RuntimeStatsUpdateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RuntimeStatsUpdateArg)(nil), args)
						return
					}
					err = i.RuntimeStatsUpdate(ctx, typedArgs[0].Stats)
					return
				},
			},
		},
	}
}

type NotifyRuntimeStatsClient struct {
	Cli rpc.GenericClient
}

func (c NotifyRuntimeStatsClient) RuntimeStatsUpdate(ctx context.Context, stats *RuntimeStats) (err error) {
	__arg := RuntimeStatsUpdateArg{Stats: stats}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyRuntimeStats.runtimeStatsUpdate", []interface{}{__arg}, 0*time.Millisecond)
	return
}
