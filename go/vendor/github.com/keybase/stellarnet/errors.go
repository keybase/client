package stellarnet

import (
	"errors"
	"fmt"
	"net/url"

	perrors "github.com/pkg/errors"

	"github.com/stellar/go/clients/horizon"
)

// TimeoutHandler will be called whenever a timeout error happens.
var TimeoutHandler func()

// ErrResourceNotFound is returned if there is no stellar resource found.
// It is a generic not found error.
var ErrResourceNotFound = errors.New("resource not found")

// ErrSourceAccountNotFound is returned if there is no stellar account for a source account address.
var ErrSourceAccountNotFound = errors.New("source account not found")

// ErrDestinationAccountNotFound is returned if there is no stellar account for a destinationaccount address.
var ErrDestinationAccountNotFound = errors.New("destination account not found")

// ErrAddressNotSeed is returned when the string is a stellar address, not a seed.
var ErrAddressNotSeed = errors.New("string provided is an address not a seed")

// ErrSeedNotAddress is returned when the string is a stellar seed, not an address.
var ErrSeedNotAddress = errors.New("string provided is a seed not an address")

// ErrUnknownKeypairType is returned if the string parses to an unknown keypair type.
var ErrUnknownKeypairType = errors.New("unknown keypair type")

// ErrAssetNotFound is returned if no asset matches a code/issuer pair.
var ErrAssetNotFound = errors.New("asset not found")

// ErrMemoExists is returned if more than one memo is added to a Tx.
var ErrMemoExists = errors.New("memo already exists in this tx")

// ErrTimeBoundsExist is returned if more than one time bounds is added to a Tx.
var ErrTimeBoundsExist = errors.New("time bounds already exist in this tx")

// ErrTxOpFull is returned if an operation is added to a Tx that has 100 ops in it.
var ErrTxOpFull = errors.New("tx cannot hold more operations")

// ErrNoOps means a Tx has no operations.
var ErrNoOps = errors.New("no operations in tx")

// Error provides a hopefully user-friendly default in Error()
// but with some details that might actually help debug in Verbose().
type Error struct {
	Display       string
	Details       string
	HorizonError  *horizon.Error
	OriginalError error
}

// Error implements the error interface.
func (e Error) Error() string {
	return e.Display
}

// Verbose returns additional details about the error.
func (e Error) Verbose() string {
	return fmt.Sprintf("%s [%s]", e.Display, e.Details)
}

// errMap maps some horizon errors to stellarnet errors.
func errMap(err error) error {
	if err == nil {
		return nil
	}

	// the error might be wrapped, so get the unwrapped error
	xerr := perrors.Cause(err)

	switch xerr := xerr.(type) {
	case Error:
		// already wrapped it up
		return xerr
	case *horizon.Error:
		if isOpNoDestination(xerr) {
			return ErrDestinationAccountNotFound
		}
		if xerr.Problem.Status == 404 {
			return ErrResourceNotFound
		}

		// catch-all
		return Error{
			Display:       "stellar network error",
			Details:       fmt.Sprintf("horizon Problem: %+v", xerr.Problem),
			HorizonError:  xerr,
			OriginalError: err,
		}
	case *url.Error:
		if xerr.Timeout() {
			if TimeoutHandler != nil {
				TimeoutHandler()
			}
			return Error{
				Display:       "stellar network timeout",
				Details:       fmt.Sprintf("stellar network timeout, url: %s, error: %s", xerr.URL, xerr.Error()),
				OriginalError: err,
			}
		}

		return xerr
	default:
		return err
	}
}

func errMapAccount(err error) error {
	xerr := errMap(err)
	if xerr == ErrResourceNotFound {
		return ErrSourceAccountNotFound
	}
	return xerr
}

func isOpNoDestination(herr *horizon.Error) bool {
	resultCodes, err := herr.ResultCodes()
	if err != nil {
		return false
	}
	if resultCodes.TransactionCode != "tx_failed" {
		return false
	}
	if len(resultCodes.OperationCodes) != 1 {
		// only handle one operation now
		return false
	}
	return resultCodes.OperationCodes[0] == "op_no_destination"
}
