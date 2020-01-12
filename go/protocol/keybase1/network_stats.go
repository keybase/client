// Auto-generated to Go types and interfaces using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/network_stats.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type InstrumentationDiskRecord struct {
	Ctime Time         `codec:"c" json:"ctime"`
	Dur   DurationMsec `codec:"d" json:"dur"`
	Size  int64        `codec:"s" json:"size"`
}

func (o InstrumentationDiskRecord) DeepCopy() InstrumentationDiskRecord {
	return InstrumentationDiskRecord{
		Ctime: o.Ctime.DeepCopy(),
		Dur:   o.Dur.DeepCopy(),
		Size:  o.Size,
	}
}

type InstrumentationStat struct {
	Tag       string       `codec:"tag" json:"tag"`
	NumCalls  int          `codec:"numCalls" json:"numCalls"`
	AvgDur    DurationMsec `codec:"avgDur" json:"avgDur"`
	MaxDur    DurationMsec `codec:"maxDur" json:"maxDur"`
	MinDur    DurationMsec `codec:"minDur" json:"minDur"`
	TotalDur  DurationMsec `codec:"totalDur" json:"totalDur"`
	AvgSize   int64        `codec:"avgSize" json:"avgSize"`
	MaxSize   int64        `codec:"maxSize" json:"maxSize"`
	MinSize   int64        `codec:"minSize" json:"minSize"`
	TotalSize int64        `codec:"totalSize" json:"totalSize"`
}

func (o InstrumentationStat) DeepCopy() InstrumentationStat {
	return InstrumentationStat{
		Tag:       o.Tag,
		NumCalls:  o.NumCalls,
		AvgDur:    o.AvgDur.DeepCopy(),
		MaxDur:    o.MaxDur.DeepCopy(),
		MinDur:    o.MinDur.DeepCopy(),
		TotalDur:  o.TotalDur.DeepCopy(),
		AvgSize:   o.AvgSize,
		MaxSize:   o.MaxSize,
		MinSize:   o.MinSize,
		TotalSize: o.TotalSize,
	}
}

type NetworkStatsInterface interface {
}

func NetworkStatsProtocol(i NetworkStatsInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "keybase.1.NetworkStats",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type NetworkStatsClient struct {
	Cli rpc.GenericClient
}
