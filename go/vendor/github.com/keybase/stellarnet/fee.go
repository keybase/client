package stellarnet

import (
	"errors"
	"strconv"
)

// FeeStats returns NumericFeeStats given a FeeStatFetcher.
func FeeStats(f FeeStatFetcher) (NumericFeeStats, error) {
	resp, err := f.FeeStatFetch()
	if err != nil {
		return NumericFeeStats{}, err
	}
	return resp.Convert()
}

// FeeStatsResponse describes the json response from the horizon
// /fee_stats endpoint (which is unfortunately all strings).
type FeeStatsResponse struct {
	LastLedger          string `json:"last_ledger"`
	LastLedgerBaseFee   string `json:"last_ledger_base_fee"`
	LedgerCapacityUsage string `json:"ledger_capacity_usage"`
	MinAcceptedFee      string `json:"min_accepted_fee"`
	ModeAcceptedFee     string `json:"mode_accepted_fee"`
	P10AcceptedFee      string `json:"p10_accepted_fee"`
	P20AcceptedFee      string `json:"p20_accepted_fee"`
	P30AcceptedFee      string `json:"p30_accepted_fee"`
	P40AcceptedFee      string `json:"p40_accepted_fee"`
	P50AcceptedFee      string `json:"p50_accepted_fee"`
	P60AcceptedFee      string `json:"p60_accepted_fee"`
	P70AcceptedFee      string `json:"p70_accepted_fee"`
	P80AcceptedFee      string `json:"p80_accepted_fee"`
	P90AcceptedFee      string `json:"p90_accepted_fee"`
	P95AcceptedFee      string `json:"p95_accepted_fee"`
	P99AcceptedFee      string `json:"p99_accepted_fee"`
}

// Convert converts a FeeStatsResponse into NumericFeeStats by
// converting all the strings to the appropriate numeric types.
func (f FeeStatsResponse) Convert() (x NumericFeeStats, err error) {
	var s NumericFeeStats
	n, err := strconv.ParseInt(f.LastLedger, 10, 32)
	if err != nil {
		return x, err
	}
	s.LastLedger = int32(n)
	s.LastLedgerBaseFee, err = strconv.ParseUint(f.LastLedgerBaseFee, 10, 64)
	if err != nil {
		return x, err
	}
	s.LedgerCapacityUsage, err = strconv.ParseFloat(f.LedgerCapacityUsage, 64)
	if err != nil {
		return x, err
	}
	s.MinAcceptedFee, err = strconv.ParseUint(f.MinAcceptedFee, 10, 64)
	if err != nil {
		return x, err
	}
	s.ModeAcceptedFee, err = strconv.ParseUint(f.ModeAcceptedFee, 10, 64)
	if err != nil {
		return x, err
	}
	s.P10AcceptedFee, err = strconv.ParseUint(f.P10AcceptedFee, 10, 64)
	if err != nil {
		return x, err
	}
	s.P20AcceptedFee, err = strconv.ParseUint(f.P20AcceptedFee, 10, 64)
	if err != nil {
		return x, err
	}
	s.P30AcceptedFee, err = strconv.ParseUint(f.P30AcceptedFee, 10, 64)
	if err != nil {
		return x, err
	}
	s.P40AcceptedFee, err = strconv.ParseUint(f.P40AcceptedFee, 10, 64)
	if err != nil {
		return x, err
	}
	s.P50AcceptedFee, err = strconv.ParseUint(f.P50AcceptedFee, 10, 64)
	if err != nil {
		return x, err
	}
	s.P60AcceptedFee, err = strconv.ParseUint(f.P60AcceptedFee, 10, 64)
	if err != nil {
		return x, err
	}
	s.P70AcceptedFee, err = strconv.ParseUint(f.P70AcceptedFee, 10, 64)
	if err != nil {
		return x, err
	}
	s.P80AcceptedFee, err = strconv.ParseUint(f.P80AcceptedFee, 10, 64)
	if err != nil {
		return x, err
	}
	s.P90AcceptedFee, err = strconv.ParseUint(f.P90AcceptedFee, 10, 64)
	if err != nil {
		return x, err
	}
	s.P95AcceptedFee, err = strconv.ParseUint(f.P95AcceptedFee, 10, 64)
	if err != nil {
		return x, err
	}
	s.P99AcceptedFee, err = strconv.ParseUint(f.P99AcceptedFee, 10, 64)
	if err != nil {
		return x, err
	}

	return s, nil
}

// FeeStatFetcher contains FeeStatFetch, which will get a FeeStatsResponse.
type FeeStatFetcher interface {
	FeeStatFetch() (FeeStatsResponse, error)
}

// NumericFeeStats is a numeric representation of the fee stats.
type NumericFeeStats struct {
	LastLedger          int32
	LastLedgerBaseFee   uint64
	LedgerCapacityUsage float64
	MinAcceptedFee      uint64
	ModeAcceptedFee     uint64
	P10AcceptedFee      uint64
	P20AcceptedFee      uint64
	P30AcceptedFee      uint64
	P40AcceptedFee      uint64
	P50AcceptedFee      uint64
	P60AcceptedFee      uint64
	P70AcceptedFee      uint64
	P80AcceptedFee      uint64
	P90AcceptedFee      uint64
	P95AcceptedFee      uint64
	P99AcceptedFee      uint64
}

// HorizonFeeStatFetcher is a FeeStatFetcher that uses a live horizon
// client.
type HorizonFeeStatFetcher struct{}

// FeeStatFetch implements FeeStatFetcher.
func (h *HorizonFeeStatFetcher) FeeStatFetch() (FeeStatsResponse, error) {
	c := Client()
	if c == nil {
		return FeeStatsResponse{}, errors.New("no horizon client")
	}
	statsURL := c.URL + "/fee_stats"

	var resp FeeStatsResponse
	err := getDecodeJSONStrict(statsURL, c.HTTP.Get, &resp)
	if err != nil {
		return FeeStatsResponse{}, err
	}

	return resp, nil
}
