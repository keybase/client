package stellarnet

import "errors"

// ErrAccountNotFound is returned if there is no stellar account for an address.
var ErrAccountNotFound = errors.New("account not found")

// ErrAddressNotSeed is returned when the string is a stellar address, not a seed.
var ErrAddressNotSeed = errors.New("string provided is an address not a seed")

// ErrSeedNotAddress is returned when the string is a stellar seed, not an address.
var ErrSeedNotAddress = errors.New("string provided is a seed not an address")

// ErrUnknownKeypairType is returned if the string parses to an unknown keypair type.
var ErrUnknownKeypairType = errors.New("unknown keypair type")
