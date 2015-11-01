// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package basex

const base58EncodeStd = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

// Base58StdEncoding is the standard base58-encoding
var Base58StdEncoding = NewEncoding(base58EncodeStd, 19)
