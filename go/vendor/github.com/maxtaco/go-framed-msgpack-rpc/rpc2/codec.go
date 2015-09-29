package rpc2

type Decoder interface {
	Decode(interface{}) error
}
