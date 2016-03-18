// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"strings"
)

type headerOrFooterMarker string

const (
	headerMarker headerOrFooterMarker = "BEGIN"
	footerMarker headerOrFooterMarker = "END"
)

func pop(v *([]string), n int) (ret []string) {
	ret = (*v)[(len(*v) - n):]
	*v = (*v)[0:(len(*v) - n)]
	return
}

func shift(v *([]string), n int) (ret []string) {
	ret = (*v)[0:n]
	*v = (*v)[n:]
	return
}

func makeFrame(which headerOrFooterMarker, typ MessageType, brand string) string {
	sffx := getStringForType(typ)
	if len(sffx) == 0 {
		return sffx
	}
	words := []string{string(which)}
	if len(brand) > 0 {
		words = append(words, brand)
		brand += " "
	}
	words = append(words, strings.ToUpper(SaltpackFormatName))
	words = append(words, sffx)
	return strings.Join(words, " ")
}

// MakeArmorHeader makes the armor header for the message type for the given "brand"
func MakeArmorHeader(typ MessageType, brand string) string {
	return makeFrame(headerMarker, typ, brand)
}

// MakeArmorFooter makes the armor footer for the message type for the given "brand"
func MakeArmorFooter(typ MessageType, brand string) string {
	return makeFrame(footerMarker, typ, brand)
}

func getStringForType(typ MessageType) string {
	switch typ {
	case MessageTypeEncryption:
		return EncryptionArmorString
	case MessageTypeAttachedSignature:
		return SignedArmorString
	case MessageTypeDetachedSignature:
		return DetachedSignatureArmorString
	default:
		return ""
	}
}

func parseFrame(m string, typ MessageType, hof headerOrFooterMarker) (brand string, err error) {

	sffx := getStringForType(typ)
	if len(sffx) == 0 {
		err = makeErrBadFrame("Message type %v not found", typ)
		return
	}
	v := strings.Split(m, " ")
	if len(v) != 4 && len(v) != 5 {
		err = makeErrBadFrame("wrong number of words (%d)", len(v))
		return
	}

	front := shift(&v, 1)
	if front[0] != string(hof) {
		err = makeErrBadFrame("Bad prefix: %s (wanted %s)", front[0], string(hof))
		return
	}

	expected := getStringForType(typ)
	tmp := pop(&v, 2)
	received := strings.Join(tmp, " ")
	if received != expected {
		err = makeErrBadFrame("wanted %q but got %q", expected, received)
		return
	}
	spfn := pop(&v, 1)
	if spfn[0] != strings.ToUpper(SaltpackFormatName) {
		err = makeErrBadFrame("bad format name (%s)", spfn[0])
		return
	}
	if len(v) > 0 {
		brand = v[0]
	}
	return brand, err
}
