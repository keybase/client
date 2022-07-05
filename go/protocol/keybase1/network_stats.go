// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/network_stats.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type NetworkSource int

const (
	NetworkSource_LOCAL  NetworkSource = 0
	NetworkSource_REMOTE NetworkSource = 1
)

func (o NetworkSource) DeepCopy() NetworkSource { return o }

var NetworkSourceMap = map[string]NetworkSource{
	"LOCAL":  0,
	"REMOTE": 1,
}

var NetworkSourceRevMap = map[NetworkSource]string{
	0: "LOCAL",
	1: "REMOTE",
}

func (e NetworkSource) String() string {
	if v, ok := NetworkSourceRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type InstrumentationStat struct {
	Tag       string       `codec:"t" json:"tag"`
	NumCalls  int          `codec:"n" json:"numCalls"`
	Ctime     Time         `codec:"c" json:"ctime"`
	Mtime     Time         `codec:"m" json:"mtime"`
	AvgDur    DurationMsec `codec:"ad" json:"avgDur"`
	MaxDur    DurationMsec `codec:"xd" json:"maxDur"`
	MinDur    DurationMsec `codec:"nd" json:"minDur"`
	TotalDur  DurationMsec `codec:"td" json:"totalDur"`
	AvgSize   int64        `codec:"as" json:"avgSize"`
	MaxSize   int64        `codec:"xs" json:"maxSize"`
	MinSize   int64        `codec:"ns" json:"minSize"`
	TotalSize int64        `codec:"ts" json:"totalSize"`
}

func (o InstrumentationStat) DeepCopy() InstrumentationStat {
	return InstrumentationStat{
		Tag:       o.Tag,
		NumCalls:  o.NumCalls,
		Ctime:     o.Ctime.DeepCopy(),
		Mtime:     o.Mtime.DeepCopy(),
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
