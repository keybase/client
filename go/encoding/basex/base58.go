package basex

const base58EncodeStd = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

// Base58StdEncoding is the standard base58-encoding
var Base58StdEncoding = NewEncoding(base58EncodeStd, 19)
