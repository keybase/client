type SerializingClient struct {
	sync.Mutex
	baseClient rpc.Client
	sentChan chan rpc.SeqNumber
	mySeqno int
}

func NewSerializingClient(xp rpc.Transporter) *SerializingClient {
	ch := make(chan rpc.Seqno)
	f := func (s rpc.Seqno) {
		ch <- s
	}
	cli := rpc.NewclientWithSendNotifier(xp, nil, nil, f)
	return &SerializingClient{cli, ch}
}

func(c *SerializingClient) Call(ctx context.Context, method string, arg interface{}, res interface{}) (err error) {
	c.Lock()
	doneCh := make(chan struct{})
	seqno := c.mySeqno
	c.mySeqno++
	go func() {
		myArg := someFunc(seqno, arg)
		err = c.baseClient.Call(ctx, method, myArg, res)
		doneCh <- struct{}{}
	}()
	<-c.sentChan
	c.Unlock()
	<-doneCh
	return err
}
