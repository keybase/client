package stellarnet

import "errors"

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
