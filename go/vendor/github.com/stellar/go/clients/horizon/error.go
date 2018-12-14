package horizon

import (
	"encoding/json"

	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/support/render/problem"
	"github.com/stellar/go/xdr"
)

func (herr Error) Error() string {
	return `Horizon error: "` + herr.Problem.Title + `". Check horizon.Error.Problem for more information.`
}

// ToProblem converts the Prolem to a problem.P
func (prob Problem) ToProblem() problem.P {
	extras := make(map[string]interface{})
	for k, v := range prob.Extras {
		extras[k] = v
	}

	return problem.P{
		Type:     prob.Type,
		Title:    prob.Title,
		Status:   prob.Status,
		Detail:   prob.Detail,
		Instance: prob.Instance,
		Extras:   extras,
	}
}

// Envelope extracts the transaction envelope that triggered this error from the
// extra fields.
func (herr *Error) Envelope() (*xdr.TransactionEnvelope, error) {
	raw, ok := herr.Problem.Extras["envelope_xdr"]
	if !ok {
		return nil, ErrEnvelopeNotPopulated
	}

	var b64 string
	var result xdr.TransactionEnvelope

	err := json.Unmarshal(raw, &b64)
	if err != nil {
		return nil, errors.Wrap(err, "json decode failed")
	}

	err = xdr.SafeUnmarshalBase64(b64, &result)
	if err != nil {
		return nil, errors.Wrap(err, "xdr decode failed")
	}

	return &result, nil
}

// ResultString extracts the transaction result as a string.
func (herr *Error) ResultString() (string, error) {
	raw, ok := herr.Problem.Extras["result_xdr"]
	if !ok {
		return "", ErrResultNotPopulated
	}

	var b64 string

	err := json.Unmarshal(raw, &b64)
	if err != nil {
		return "", errors.Wrap(err, "json decode failed")
	}

	return b64, nil
}

// ResultCodes extracts a result code summary from the error, if possible.
func (herr *Error) ResultCodes() (*TransactionResultCodes, error) {

	raw, ok := herr.Problem.Extras["result_codes"]
	if !ok {
		return nil, ErrResultCodesNotPopulated
	}

	var result TransactionResultCodes
	err := json.Unmarshal(raw, &result)
	if err != nil {
		return nil, errors.Wrap(err, "json decode failed")
	}

	return &result, nil
}
