// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcrypto

type AlgoType int

const (
	KIDPGPBase    AlgoType = 0x00
	KIDPGPRsa     AlgoType = 0x1
	KIDPGPElgamal AlgoType = 0x10
	KIDPGPDsa     AlgoType = 0x11
	KIDPGPEcdh    AlgoType = 0x12
	KIDPGPEcdsa   AlgoType = 0x13
	KIDPGPEddsa   AlgoType = 0x16
	KIDNaclEddsa  AlgoType = 0x20
	KIDNaclDH     AlgoType = 0x21

	SigKbEddsa AlgoType = KIDNaclEddsa
)
