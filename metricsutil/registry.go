package metricsutil

import "github.com/rcrowley/go-metrics"

// InboundRegistry is a metrics.Registry meant for inbound requests.
type InboundRegistry struct {
	metrics.Registry
}

// OutboundRegistry is a metrics.Registry meant for outbound requests.
type OutboundRegistry struct {
	metrics.Registry
}

// MakeInboundRegistry makes an InboundRegistry from the given one. r
// can be nil, in which case nil is returned.
func MakeInboundRegistry(r metrics.Registry) InboundRegistry {
	if r == nil {
		return InboundRegistry{}
	}

	return InboundRegistry{
		Registry: metrics.NewPrefixedChildRegistry(r, "inbound - "),
	}
}

// MakeOutboundRegistry makes an OutboundRegistry from the given one. r
// can be nil, in which case nil is returned.
func MakeOutboundRegistry(r metrics.Registry) OutboundRegistry {
	if r == nil {
		return OutboundRegistry{}
	}

	return OutboundRegistry{
		Registry: metrics.NewPrefixedChildRegistry(r, "outbound - "),
	}
}
