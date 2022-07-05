package rpc

import (
	"bytes"
	"errors"
	"fmt"

	"github.com/keybase/go-codec/codec"
	"golang.org/x/net/context"
)

type rpcMessage interface {
	Type() MethodType
	Name() string
	SeqNo() SeqNumber
	MinLength() int
	Compression() CompressionType
	Err() error
	DecodeMessage(int, *fieldDecoder, *protocolHandler, *callContainer, *compressorCacher, NetworkInstrumenterStorage) error
	RecordAndFinish(context.Context, int64) error
}

type basicRPCData struct {
	ctx          context.Context
	instrumenter *NetworkInstrumenter
}

func (r *basicRPCData) Context() context.Context {
	if r.ctx == nil {
		return context.Background()
	}
	return r.ctx
}

func (r *basicRPCData) loadContext(l int, d *fieldDecoder) error {
	if l == 0 {
		return nil
	}
	tags := make(CtxRpcTags)
	if err := d.Decode(&tags); err != nil {
		return err
	}
	r.ctx = AddRpcTagsToContext(context.Background(), tags)
	return nil
}

type rpcCallMessage struct {
	basicRPCData
	seqno SeqNumber
	name  string
	arg   interface{}
	err   error
}

func (rpcCallMessage) MinLength() int {
	return 3
}

func (r *rpcCallMessage) RecordAndFinish(ctx context.Context, size int64) error {
	return r.instrumenter.RecordAndFinish(ctx, size)
}

func (r *rpcCallMessage) DecodeMessage(l int, d *fieldDecoder, p *protocolHandler, _ *callContainer,
	_ *compressorCacher, instrumenterStorage NetworkInstrumenterStorage) error {
	if r.err = d.Decode(&r.seqno); r.err != nil {
		return r.err
	}
	if r.err = d.Decode(&r.name); r.err != nil {
		return r.err
	}
	r.instrumenter = NewNetworkInstrumenter(instrumenterStorage, RPCInstrumentTag(r.Type(), r.Name()))
	r.instrumenter.IncrementSize(int64(d.totalSize))
	if r.arg, r.err = p.getArg(r.name); r.err != nil {
		return r.err
	}
	if r.err = d.Decode(r.arg); r.err != nil {
		return r.err
	}
	r.err = r.loadContext(l-r.MinLength(), d)
	return r.err
}

func (r rpcCallMessage) Type() MethodType {
	return MethodCall
}

func (r rpcCallMessage) SeqNo() SeqNumber {
	return r.seqno
}

func (r rpcCallMessage) Name() string {
	return r.name
}

func (r rpcCallMessage) Arg() interface{} {
	return r.arg
}

func (r rpcCallMessage) Err() error {
	return r.err
}

func (r rpcCallMessage) Compression() CompressionType {
	return CompressionNone
}

type rpcCallCompressedMessage struct {
	rpcCallMessage
	ctype CompressionType
}

func (rpcCallCompressedMessage) MinLength() int {
	return 4
}

func (r *rpcCallCompressedMessage) RecordAndFinish(ctx context.Context, size int64) error {
	return r.instrumenter.RecordAndFinish(ctx, size)
}

func (r *rpcCallCompressedMessage) DecodeMessage(l int, d *fieldDecoder, p *protocolHandler, _ *callContainer,
	compressorCacher *compressorCacher, instrumenterStorage NetworkInstrumenterStorage) error {
	if r.err = d.Decode(&r.seqno); r.err != nil {
		return r.err
	}
	if r.err = d.Decode(&r.ctype); r.err != nil {
		return r.err
	}
	if r.err = d.Decode(&r.name); r.err != nil {
		return r.err
	}
	r.instrumenter = NewNetworkInstrumenter(instrumenterStorage, RPCInstrumentTag(r.Type(), r.Name()))
	r.instrumenter.IncrementSize(int64(d.totalSize))
	if r.arg, r.err = p.getArg(r.name); r.err != nil {
		return r.err
	}

	if compressor := compressorCacher.getCompressor(r.ctype); compressor != nil {
		var compressed []byte
		if r.err = d.Decode(&compressed); r.err != nil {
			return r.err
		}
		if len(compressed) > 0 {
			uncompressed, err := compressor.Decompress(compressed)
			if err != nil {
				r.err = err
				return r.err
			}
			if r.err = newUncompressedDecoder(uncompressed, d.fieldNumber).Decode(r.arg); r.err != nil {
				return r.err
			}
		}
	} else {
		if r.err = d.Decode(r.arg); r.err != nil {
			return r.err
		}
	}

	r.err = r.loadContext(l-r.MinLength(), d)
	return r.err
}

func (r rpcCallCompressedMessage) Type() MethodType {
	return MethodCallCompressed
}

func (r rpcCallCompressedMessage) Compression() CompressionType {
	return r.ctype
}

type rpcResponseMessage struct {
	c           *call
	err         error
	responseErr error
}

func (r rpcResponseMessage) MinLength() int {
	return 3
}

func (r *rpcResponseMessage) RecordAndFinish(ctx context.Context, size int64) error {
	if r.c == nil {
		return nil
	}
	return r.c.instrumenter.RecordAndFinish(ctx, size)
}

func (r *rpcResponseMessage) DecodeMessage(l int, d *fieldDecoder, _ *protocolHandler, cc *callContainer,
	compressorCacher *compressorCacher, _ NetworkInstrumenterStorage) error {

	var seqNo SeqNumber
	if r.err = d.Decode(&seqNo); r.err != nil {
		return r.err
	}

	// Attempt to retrieve the call
	r.c = cc.RetrieveCall(seqNo)
	if r.c == nil {
		r.err = newCallNotFoundError(seqNo)
		return r.err
	}
	r.c.instrumenter.IncrementSize(int64(d.totalSize))

	// Decode the error
	var responseErr interface{}
	if r.c.errorUnwrapper != nil {
		responseErr = r.c.errorUnwrapper.MakeArg()
	} else {
		responseErr = new(string)
	}
	if r.err = d.Decode(responseErr); r.err != nil {
		return r.err
	}

	// Ensure the error is wrapped correctly
	if r.c.errorUnwrapper != nil {
		r.responseErr, r.err = r.c.errorUnwrapper.UnwrapError(responseErr)
		if r.err != nil {
			return r.err
		}
	} else {
		errAsString, ok := responseErr.(*string)
		if !ok {
			r.err = fmt.Errorf("unable to convert error to string: %v", responseErr)
			return r.err
		}
		if *errAsString != "" {
			r.responseErr = errors.New(*errAsString)
		}
	}

	// Decode the result
	if r.c.res == nil {
		return nil
	}

	if compressor := compressorCacher.getCompressor(r.c.ctype); compressor != nil {
		var compressed []byte
		if r.err = d.Decode(&compressed); r.err != nil {
			return r.err
		}
		if len(compressed) > 0 {
			uncompressed, err := compressor.Decompress(compressed)
			if err != nil {
				r.err = err
				return r.err
			}
			d = newUncompressedDecoder(uncompressed, d.fieldNumber)
		}
	}

	r.err = d.Decode(r.c.res)
	return r.err
}

func (r rpcResponseMessage) Type() MethodType {
	return MethodResponse
}

func (r rpcResponseMessage) Compression() CompressionType {
	if r.c != nil {
		return r.c.ctype
	}
	return CompressionNone
}

func (r rpcResponseMessage) SeqNo() SeqNumber {
	if r.c == nil {
		return -1
	}
	return r.c.seqid
}

func (r rpcResponseMessage) Name() string {
	if r.c == nil {
		return ""
	}
	return r.c.method
}

func (r rpcResponseMessage) Err() error {
	return r.err
}

func (r rpcResponseMessage) ResponseErr() error {
	return r.responseErr
}

func (r rpcResponseMessage) Res() interface{} {
	if r.c == nil {
		return nil
	}
	return r.c.res
}

func (r rpcResponseMessage) ResponseCh() chan *rpcResponseMessage {
	if r.c == nil {
		return nil
	}
	return r.c.resultCh
}

type rpcNotifyMessage struct {
	basicRPCData
	name string
	arg  interface{}
	err  error
}

func (r *rpcNotifyMessage) RecordAndFinish(ctx context.Context, size int64) error {
	return r.instrumenter.RecordAndFinish(ctx, size)
}

func (r *rpcNotifyMessage) DecodeMessage(l int, d *fieldDecoder, p *protocolHandler, _ *callContainer,
	_ *compressorCacher, instrumenterStorage NetworkInstrumenterStorage) error {
	if r.err = d.Decode(&r.name); r.err != nil {
		return r.err
	}
	r.instrumenter = NewNetworkInstrumenter(instrumenterStorage, RPCInstrumentTag(r.Type(), r.Name()))
	r.instrumenter.IncrementSize(int64(d.totalSize))
	if r.arg, r.err = p.getArg(r.name); r.err != nil {
		return r.err
	}
	if r.err = d.Decode(r.arg); r.err != nil {
		return r.err
	}
	r.err = r.loadContext(l-r.MinLength(), d)
	return r.err
}

func (rpcNotifyMessage) MinLength() int {
	return 2
}

func (r rpcNotifyMessage) Type() MethodType {
	return MethodNotify
}

func (r rpcNotifyMessage) Compression() CompressionType {
	return CompressionNone
}

func (r rpcNotifyMessage) SeqNo() SeqNumber {
	return -1
}

func (r rpcNotifyMessage) Name() string {
	return r.name
}

func (r rpcNotifyMessage) Arg() interface{} {
	return r.arg
}

func (r rpcNotifyMessage) Err() error {
	return r.err
}

type rpcCancelMessage struct {
	seqno SeqNumber
	name  string
	err   error
}

func (r *rpcCancelMessage) RecordAndFinish(ctx context.Context, size int64) error {
	return nil
}

func (r *rpcCancelMessage) DecodeMessage(l int, d *fieldDecoder, p *protocolHandler, _ *callContainer,
	_ *compressorCacher, _ NetworkInstrumenterStorage) error {
	if r.err = d.Decode(&r.seqno); r.err != nil {
		return r.err
	}
	r.err = d.Decode(&r.name)
	return r.err
}

func (rpcCancelMessage) MinLength() int {
	return 2
}

func (r rpcCancelMessage) Type() MethodType {
	return MethodCancel
}

func (r rpcCancelMessage) Compression() CompressionType {
	return CompressionNone
}

func (r rpcCancelMessage) SeqNo() SeqNumber {
	return r.seqno
}

func (r rpcCancelMessage) Name() string {
	return r.name
}

func (r rpcCancelMessage) Err() error {
	return r.err
}

// fieldDecoder decodes the fields of a packet.
type fieldDecoder struct {
	d           *codec.Decoder
	fieldNumber int
	totalSize   int32
}

func newFieldDecoder(reader *frameReader) *fieldDecoder {
	return &fieldDecoder{
		d:           codec.NewDecoder(reader, newCodecMsgpackHandle()),
		fieldNumber: 0,
		totalSize:   reader.totalSize,
	}
}

func newUncompressedDecoder(data []byte, fieldNumber int) *fieldDecoder {
	return &fieldDecoder{
		d:           codec.NewDecoder(bytes.NewBuffer(data), newCodecMsgpackHandle()),
		fieldNumber: fieldNumber,
		totalSize:   int32(len(data)),
	}
}

// Decode decodes the next field into the given interface.
func (dw *fieldDecoder) Decode(i interface{}) error {
	defer func() {
		dw.fieldNumber++
	}()

	if err := dw.d.Decode(i); err != nil {
		return newRPCMessageFieldDecodeError(dw.fieldNumber, err)
	}
	return nil
}

func decodeRPC(l int, r *frameReader, p *protocolHandler, cc *callContainer, compressorCacher *compressorCacher,
	instrumenterStorage NetworkInstrumenterStorage) (rpcMessage, error) {
	decoder := newFieldDecoder(r)

	typ := MethodInvalid
	if err := decoder.Decode(&typ); err != nil {
		return nil, newRPCDecodeError(typ, "", l, CompressionNone, err)
	}

	var data rpcMessage
	switch typ {
	case MethodCall:
		data = &rpcCallMessage{}
	case MethodResponse:
		data = &rpcResponseMessage{}
	case MethodNotify:
		data = &rpcNotifyMessage{}
	case MethodCancel:
		data = &rpcCancelMessage{}
	case MethodCallCompressed:
		data = &rpcCallCompressedMessage{}
	default:
		return nil, newRPCDecodeError(typ, "", l, CompressionNone, errors.New("invalid RPC type"))
	}

	dataLength := l - 1
	if dataLength < data.MinLength() {
		return nil, newRPCDecodeError(typ, "", l, CompressionNone, errors.New("wrong message length"))
	}

	if err := data.DecodeMessage(dataLength, decoder, p, cc, compressorCacher, instrumenterStorage); err != nil {
		return data, newRPCDecodeError(typ, data.Name(), l, data.Compression(), err)
	}
	return data, nil
}
