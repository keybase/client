// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package metricsutil

import (
	"fmt"
	"io"
	"sort"
	"time"

	"github.com/rcrowley/go-metrics"
)

// The code below is adapted from
// https://github.com/rcrowley/go-metrics/blob/master/writer.go
// .

// WriteMetrics sorts and writes metrics in the given registry to the given
// io.Writer.
func WriteMetrics(r metrics.Registry, w io.Writer) {
	var namedMetrics namedMetricSlice
	r.Each(func(name string, i interface{}) {
		namedMetrics = append(namedMetrics, namedMetric{name, i})
	})

	sort.Sort(namedMetrics)
	for _, namedMetric := range namedMetrics {
		switch metric := namedMetric.m.(type) {
		case metrics.Counter:
			fmt.Fprintf(w, "counter %s\n", namedMetric.name)
			fmt.Fprintf(w, "  count: %9d\n", metric.Count())
		case metrics.Gauge:
			fmt.Fprintf(w, "gauge %s\n", namedMetric.name)
			fmt.Fprintf(w, "  value: %9d\n", metric.Value())
		case metrics.GaugeFloat64:
			fmt.Fprintf(w, "gauge %s\n", namedMetric.name)
			fmt.Fprintf(w, "  value: %f\n", metric.Value())
		case metrics.Healthcheck:
			metric.Check()
			fmt.Fprintf(w, "healthcheck %s\n", namedMetric.name)
			fmt.Fprintf(w, "  error: %v\n", metric.Error())
		case metrics.Histogram:
			h := metric.Snapshot()
			ps := h.Percentiles([]float64{0.5, 0.75, 0.95, 0.99, 0.999})
			fmt.Fprintf(w, "histogram %s\n", namedMetric.name)
			fmt.Fprintf(w, "  count=%d, mean=%.2f, stddef=%.2f\n", h.Count(), h.Mean(), h.StdDev())
			fmt.Fprintf(w, "  min=%.2fms median=%.2fms max=%.2fms\n",
				float64(h.Min())/float64(time.Millisecond),
				ps[0]/float64(time.Millisecond),
				float64(h.Max())/float64(time.Millisecond))
			fmt.Fprintf(w, "  %%iles (ms): 75=%.2f 95=%.2f 99=%.2f 99.9=%.2f\n",
				ps[1]/float64(time.Millisecond),
				ps[2]/float64(time.Millisecond),
				ps[3]/float64(time.Millisecond),
				ps[4]/float64(time.Millisecond))
		case metrics.Meter:
			m := metric.Snapshot()
			fmt.Fprintf(w, "meter %s\n", namedMetric.name)
			fmt.Fprintf(w, "  count: %d\n", m.Count())
			fmt.Fprintf(w, "  rates: 1m=%.2f 5m=%.2f 15m=%.2f mean=%.2f\n", m.Rate1(), m.Rate5(), m.Rate15(), m.RateMean())
		case metrics.Timer:
			t := metric.Snapshot()
			ps := t.Percentiles([]float64{0.5, 0.75, 0.95, 0.99, 0.999})
			fmt.Fprintf(w, "timer %s\n", namedMetric.name)
			fmt.Fprintf(w, "  count=%d, mean=%.2fms, stddev=%.2fms\n",
				t.Count(), t.Mean()/float64(time.Millisecond), t.StdDev()/float64(time.Millisecond))
			fmt.Fprintf(w, "  min=%.2fms median=%.2fms max=%.2fms\n",
				float64(t.Min())/float64(time.Millisecond),
				ps[0]/float64(time.Millisecond),
				float64(t.Max())/float64(time.Millisecond))
			fmt.Fprintf(w, "  %%iles (ms): 75=%.2f 95=%.2f 99=%.2f 99.9=%.2f\n",
				ps[1]/float64(time.Millisecond),
				ps[2]/float64(time.Millisecond),
				ps[3]/float64(time.Millisecond),
				ps[4]/float64(time.Millisecond))
			fmt.Fprintf(w, "  rates: 1m=%.2f 5m=%.2f 15m=%.2f mean=%.2f\n", t.Rate1(), t.Rate5(), t.Rate15(), t.RateMean())
		}
	}
}

type namedMetric struct {
	name string
	m    interface{}
}

// namedMetricSlice is a slice of namedMetrics that implements sort.Interface.
type namedMetricSlice []namedMetric

func (nms namedMetricSlice) Len() int { return len(nms) }

func (nms namedMetricSlice) Swap(i, j int) { nms[i], nms[j] = nms[j], nms[i] }

func (nms namedMetricSlice) Less(i, j int) bool {
	return nms[i].name < nms[j].name
}
