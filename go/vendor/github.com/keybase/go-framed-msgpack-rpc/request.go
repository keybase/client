package rpc

type request interface {
	Message() *message
	Reply(encoder, LogInterface) error
	LogInvocation(log LogInterface, err error, arg interface{})
	LogCompletion(log LogInterface, err error)
}

type callRequest struct {
	*message
}

func newCallRequest() *callRequest {
	r := &callRequest{
		message: &message{
			remainingFields: 3,
		},
	}
	r.decodeSlots = []interface{}{
		&r.seqno,
		&r.method,
	}
	return r
}

func (r *callRequest) Message() *message {
	return r.message
}

func (r *callRequest) LogInvocation(log LogInterface, err error, arg interface{}) {
	log.ServerCall(r.seqno, r.method, err, arg)
}

func (r *callRequest) LogCompletion(log LogInterface, err error) {
	log.ServerReply(r.seqno, r.method, err, r.res)
}

func (r *callRequest) Reply(enc encoder, log LogInterface) error {
	v := []interface{}{
		MethodResponse,
		r.seqno,
		r.err,
		r.res,
	}
	err := enc.Encode(v)
	if err != nil {
		log.Warning("Reply error for %d: %s", r.seqno, err.Error())
	}
	return err
}

type notifyRequest struct {
	*message
}

func newNotifyRequest() *notifyRequest {
	r := &notifyRequest{
		message: &message{
			remainingFields: 2,
		},
	}
	r.decodeSlots = []interface{}{
		&r.method,
	}
	return r
}

func (r *notifyRequest) Message() *message {
	return r.message
}

func (r *notifyRequest) LogInvocation(log LogInterface, err error, arg interface{}) {
	log.ServerNotifyCall(r.method, err, arg)
}

func (r *notifyRequest) LogCompletion(log LogInterface, err error) {
	log.ServerNotifyComplete(r.method, err)
}

func (r *notifyRequest) Reply(enc encoder, log LogInterface) error {
	return nil
}

func newRequest(methodType MethodType) request {
	switch methodType {
	case MethodCall:
		return newCallRequest()
	case MethodNotify:
		return newNotifyRequest()
	}
	return nil
}

func decodeIntoRequest(dec decoder, r request) error {
	m := r.Message()
	for _, s := range m.decodeSlots {
		if err := decodeMessage(dec, m, s); err != nil {
			return err
		}
	}
	return nil
}
