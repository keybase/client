package rpc

import (
	"io"

	"golang.org/x/net/context"
)

type dispatcher interface {
	Call(ctx context.Context, name string, arg interface{}, res interface{},
		ctype CompressionType, u ErrorUnwrapper, sendNotifier SendNotifier) error
	Notify(ctx context.Context, name string, arg interface{}, sendNotifier SendNotifier) error
	Close()
}

type dispatch struct {
	writer *framedMsgpackEncoder
	calls  *callContainer

	// Stops all loops when closed
	stopCh chan struct{}
	// Closed once all loops are finished
	closedCh chan struct{}

	log LogInterface
}

func newDispatch(enc *framedMsgpackEncoder, calls *callContainer, l LogInterface) *dispatch {
	d := &dispatch{
		writer:   enc,
		calls:    calls,
		stopCh:   make(chan struct{}),
		closedCh: make(chan struct{}),

		log: l,
	}
	return d
}

func currySendNotifier(sendNotifier SendNotifier, seqid SeqNumber) func() {
	if sendNotifier == nil {
		return nil
	}
	return func() {
		sendNotifier(seqid)
	}
}

func (d *dispatch) Call(ctx context.Context, name string, arg interface{}, res interface{},
	ctype CompressionType, u ErrorUnwrapper, sendNotifier SendNotifier) error {
	profiler := d.log.StartProfiler("call %s", name)
	defer profiler.Stop()

	c := d.calls.NewCall(ctx, name, arg, res, ctype, u)

	// Have to add call before encoding otherwise we'll race the response
	d.calls.AddCall(c)
	defer d.calls.RemoveCall(c.seqid)

	var v []interface{}
	var logCall func()
	switch ctype {
	case CompressionNone:
		v = []interface{}{MethodCall, c.seqid, c.method, c.arg}
		logCall = func() { d.log.ClientCall(c.seqid, c.method, c.arg) }
	default:
		arg, err := d.writer.compressData(c.ctype, c.arg)
		if err != nil {
			return err
		}
		v = []interface{}{MethodCallCompressed, c.seqid, c.ctype, c.method, arg}
		logCall = func() { d.log.ClientCallCompressed(c.seqid, c.method, c.arg, c.ctype) }
	}

	rpcTags, _ := RpcTagsFromContext(ctx)
	if len(rpcTags) > 0 {
		v = append(v, rpcTags)
	}
	errCh := d.writer.EncodeAndWrite(ctx, v, currySendNotifier(sendNotifier, c.seqid))

	// Wait for result from encode
	select {
	case err := <-errCh:
		if err != nil {
			return err
		}
	case <-c.ctx.Done():
		return d.handleCancel(c)
	case <-d.stopCh:
		return io.EOF
	}

	logCall()

	// Wait for result from call
	select {
	case res := <-c.resultCh:
		d.log.ClientReply(c.seqid, c.method, res.ResponseErr(), res.Res())
		return res.ResponseErr()
	case <-c.ctx.Done():
		return d.handleCancel(c)
	case <-d.stopCh:
		return io.EOF
	}
}

func (d *dispatch) Notify(ctx context.Context, name string, arg interface{}, sendNotifier SendNotifier) error {
	rpcTags, _ := RpcTagsFromContext(ctx)
	v := []interface{}{MethodNotify, name, arg}
	if len(rpcTags) > 0 {
		v = append(v, rpcTags)
	}
	errCh := d.writer.EncodeAndWrite(ctx, v, currySendNotifier(sendNotifier, SeqNumber(-1)))
	select {
	case err := <-errCh:
		if err == nil {
			d.log.ClientNotify(name, arg)
		}
		return err
	case <-d.stopCh:
		return io.EOF
	case <-ctx.Done():
		d.log.ClientCancel(-1, name, nil)
		return ctx.Err()
	}
}

func (d *dispatch) Close() {
	close(d.stopCh)
}

func (d *dispatch) handleCancel(c *call) error {
	d.log.ClientCancel(c.seqid, c.method, nil)
	errCh := d.writer.EncodeAndWriteAsync([]interface{}{MethodCancel, c.seqid, c.method})
	select {
	case err := <-errCh:
		if err != nil {
			d.log.Info("error while dispatching cancellation: %+v", err.Error())
		}
	default:
		// Don't block on receiving the error from the Encode
	}
	return c.ctx.Err()
}
