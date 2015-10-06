package kex2

import (
	"bytes"
	"crypto/rand"
	"errors"
	"io"
	"net"
	"strings"
	"testing"
	"time"
)

type message struct {
	seqno Seqno
	msg   []byte
}

type simplexSession struct {
	sender   DeviceID
	receiver DeviceID
	eof      bool
	ch       chan message
}

var zeroDeviceID DeviceID

func (d DeviceID) isZero() bool {
	return d.Eq(zeroDeviceID)
}

func newSimplexSession(s DeviceID, r DeviceID) *simplexSession {
	return &simplexSession{
		sender:   s,
		receiver: r,
		eof:      false,
		ch:       make(chan message, 100),
	}
}

type session struct {
	id    SessionID
	left  *simplexSession
	right *simplexSession
}

type mockRouter struct {
	behavior int
	maxPoll  time.Duration
	sessions map[SessionID]*session
}

const (
	GoodRouter                   = 0
	BadRouterCorruptedSession    = 1 << iota
	BadRouterCorruptedSender     = 1 << iota
	BadRouterCorruptedCiphertext = 1 << iota
	BadRouterReorder             = 1 << iota
	BadRouterDrop                = 1 << iota
)

func corruptMessage(behavior int, msg []byte) {
	if (behavior & BadRouterCorruptedSession) != 0 {
		msg[23] ^= 0x80
	}
	if (behavior & BadRouterCorruptedSender) != 0 {
		msg[10] ^= 0x40
	}
	if (behavior & BadRouterCorruptedCiphertext) != 0 {
		msg[len(msg)-10] ^= 0x01
	}
}

func newMockRouter() *mockRouter {
	return &mockRouter{
		behavior: GoodRouter,
		sessions: make(map[SessionID]*session),
	}
}

func newMockRouterWithBehavior(b int) *mockRouter {
	return &mockRouter{
		behavior: b,
		sessions: make(map[SessionID]*session),
	}
}

func newMockRouterWithBehaviorAndMaxPoll(b int, mp time.Duration) *mockRouter {
	return &mockRouter{
		behavior: b,
		maxPoll:  mp,
		sessions: make(map[SessionID]*session),
	}
}

func (ss *simplexSession) post(seqno Seqno, msg []byte) error {
	ss.ch <- message{seqno, msg}
	return nil
}

func (s *session) findOrMakeSimplexSession(sender DeviceID, receiver DeviceID) (ss *simplexSession, err error) {

	myeq := func(a DeviceID, b DeviceID) bool {
		return a.Eq(b) || a.isZero() || b.isZero()
	}

	myfix := func(ss *simplexSession, s DeviceID, r DeviceID) {
		if ss.sender.isZero() && !s.isZero() {
			ss.sender = s
		}
		if ss.receiver.isZero() && !r.isZero() {
			ss.receiver = r
		}
	}

	if s.left == nil {
		s.left = newSimplexSession(sender, receiver)
		return s.left, nil
	}
	if myeq(s.left.sender, sender) && myeq(s.left.receiver, receiver) {
		myfix(s.left, sender, receiver)
		return s.left, nil
	}

	if s.right == nil {
		s.right = newSimplexSession(sender, receiver)
		return s.right, nil
	}
	if myeq(s.right.sender, sender) && myeq(s.right.receiver, receiver) {
		myfix(s.right, sender, receiver)
		if !myeq(s.right.sender, s.left.receiver) || !myeq(s.left.sender, s.right.receiver) {
			return nil, errors.New("sender/receiver cross-mismatch")
		}
		return s.right, nil
	}
	return nil, errors.New("mysterious third party in this session")
}

func (mr *mockRouter) findOrMakeSimplexSession(I SessionID, sender DeviceID, receiver DeviceID) (ss *simplexSession, err error) {
	sess, ok := mr.sessions[I]
	if !ok {
		sess = &session{I, nil, nil}
		mr.sessions[I] = sess
	}
	return sess.findOrMakeSimplexSession(sender, receiver)
}

func (mr *mockRouter) Post(I SessionID, sender DeviceID, seqno Seqno, msg []byte) error {
	ss, err := mr.findOrMakeSimplexSession(I, sender, zeroDeviceID)
	if err != nil {
		return err
	}
	corruptMessage(mr.behavior, msg)
	return ss.post(seqno, msg)
}

func (ss *simplexSession) get(seqno Seqno, poll time.Duration, behavior int) (ret [][]byte, err error) {
	if ss.eof {
		return nil, io.EOF
	}
	timeout := false
	hitEOF := false
	handleMessage := func(msg message) {
		if msg.msg == nil {
			hitEOF = true
			ss.eof = true
		} else {
			ret = append(ret, msg.msg)
		}
	}
	if poll.Nanoseconds() > 0 {
		select {
		case msg := <-ss.ch:
			handleMessage(msg)
		case <-time.After(poll):
			timeout = true
		}
	}
	if !timeout {
	loopMessages:
		for {
			select {
			case msg := <-ss.ch:
				handleMessage(msg)
			default:
				break loopMessages
			}
		}
	}

	if hitEOF {
		err = io.EOF
	}

	if len(ret) == 0 && err != io.EOF {
		if poll.Nanoseconds() > 0 {
			err = ErrTimedOut
		} else {
			err = ErrAgain
		}
	}

	if (behavior&BadRouterReorder) != 0 && len(ret) > 1 {
		ret[0], ret[1] = ret[1], ret[0]
	}
	if (behavior&BadRouterDrop) != 0 && len(ret) > 1 {
		ret = ret[1:]
	}

	return ret, err
}

func (mr *mockRouter) Get(I SessionID, receiver DeviceID, seqno Seqno, poll time.Duration) ([][]byte, error) {
	ss, err := mr.findOrMakeSimplexSession(I, zeroDeviceID, receiver)
	if err != nil {
		return nil, err
	}
	if mr.maxPoll > time.Duration(0) && poll > mr.maxPoll {
		poll = mr.maxPoll
	}
	return ss.get(seqno, poll, mr.behavior)
}

func genSecret(t *testing.T) (ret Secret) {
	_, err := rand.Read([]byte(ret[:]))
	if err != nil {
		t.Fatal(err)
	}
	return ret
}

func genDeviceID(t *testing.T) (ret DeviceID) {
	_, err := rand.Read([]byte(ret[:]))
	if err != nil {
		t.Fatal(err)
	}
	return ret
}

func genNewConn(t *testing.T, mr MessageRouter, s Secret, d DeviceID, rt time.Duration) net.Conn {
	ret, err := NewConn(mr, s, d, rt)
	if err != nil {
		t.Fatal(err)
	}
	return ret
}

func genConnPair(t *testing.T, behavior int, readTimeout time.Duration) (c1 net.Conn, c2 net.Conn, d1 DeviceID, d2 DeviceID) {
	r := newMockRouterWithBehavior(behavior)
	s := genSecret(t)
	d1 = genDeviceID(t)
	d2 = genDeviceID(t)
	c1 = genNewConn(t, r, s, d1, readTimeout)
	c2 = genNewConn(t, r, s, d2, readTimeout)
	return
}

func TestHello(t *testing.T) {
	c1, c2, _, _ := genConnPair(t, GoodRouter, time.Duration(0))
	txt := []byte("hello friend")
	if _, err := c1.Write(txt); err != nil {
		t.Fatal(err)
	}
	buf := make([]byte, 100)
	if n, err := c2.Read(buf); err != nil {
		t.Fatal(err)
	} else if n != len(txt) {
		t.Fatal("bad read len")
	} else if !bytes.Equal(buf[0:n], txt) {
		t.Fatal("wrong message back")
	}
	txt2 := []byte("pong PONG pong PONG pong PONG")
	if _, err := c2.Write(txt2); err != nil {
		t.Fatal(err)
	} else if n, err := c1.Read(buf); err != nil {
		t.Fatal(err)
	} else if n != len(txt2) {
		t.Fatal("bad read len")
	} else if !bytes.Equal(buf[0:n], txt2) {
		t.Fatal("wrong ponged text")
	}
	return
}

func TestBadMetadata(t *testing.T) {

	testBehavior := func(b int, t *testing.T, wanted error) {
		c1, c2, _, _ := genConnPair(t, b, time.Duration(0))
		txt := []byte("hello friend")
		if _, err := c1.Write(txt); err != nil {
			t.Fatal(err)
		}
		buf := make([]byte, 100)
		if _, err := c2.Read(buf); err == nil {
			t.Fatalf("behavior %d: wanted an error, didn't get one", b)
		} else if err != wanted {
			t.Fatalf("behavior %d: wanted error '%v', got '%v'", b, err, wanted)
		}
	}
	testBehavior(BadRouterCorruptedSession, t, ErrBadMetadata)
	testBehavior(BadRouterCorruptedSender, t, ErrBadMetadata)
	testBehavior(BadRouterCorruptedCiphertext, t, ErrDecryption)
}

func TestReadDeadline(t *testing.T) {
	c1, c2, _, _ := genConnPair(t, GoodRouter, time.Duration(0))
	wait := time.Duration(10) * time.Millisecond
	c2.SetReadDeadline(time.Now().Add(wait))
	go func() {
		time.Sleep(wait * 2)
		c1.Write([]byte("hello friend"))
	}()
	buf := make([]byte, 100)
	_, err := c2.Read(buf)
	if err != ErrTimedOut {
		t.Fatalf("wanted a read timeout")
	}
}

func TestReadTimeout(t *testing.T) {
	wait := time.Duration(10) * time.Millisecond
	c1, c2, _, _ := genConnPair(t, GoodRouter, wait)
	go func() {
		time.Sleep(wait * 2)
		c1.Write([]byte("hello friend"))
	}()
	buf := make([]byte, 100)
	_, err := c2.Read(buf)
	if err != ErrTimedOut {
		t.Fatalf("wanted a read timeout")
	}
}

func TestReadDelayedWrite(t *testing.T) {
	c1, c2, _, _ := genConnPair(t, GoodRouter, time.Duration(0))
	wait := time.Duration(10) * time.Millisecond
	c2.SetReadDeadline(time.Now().Add(wait))
	text := "hello friend"
	go func() {
		time.Sleep(wait / 2)
		c1.Write([]byte(text))
	}()
	buf := make([]byte, 100)
	n, err := c2.Read(buf)
	if err != nil {
		t.Fatal(err)
	}
	if n != len(text) {
		t.Fatalf("wrong read length")
	}
}

func TestMultipleWritesOneRead(t *testing.T) {
	c1, c2, _, _ := genConnPair(t, GoodRouter, time.Duration(0))
	msgs := []string{
		"Alas, poor Yorick! I knew him, Horatio: a fellow",
		"of infinite jest, of most excellent fancy: he hath",
		"borne me on his back a thousand times; and now, how",
		"abhorred in my imagination it is! my gorge rims at",
		"it.",
	}
	for i, m := range msgs {
		if i > 0 {
			m = "\n" + m
		}
		if _, err := c1.Write([]byte(m)); err != nil {
			t.Fatal(err)
		}
	}
	buf := make([]byte, 1000)
	if n, err := c2.Read(buf); err != nil {
		t.Fatal(err)
	} else if strings.Join(msgs, "\n") != string(buf[0:n]) {
		t.Fatal("string mismatch")
	}
}

func TestOneWriteMultipleReads(t *testing.T) {
	c1, c2, _, _ := genConnPair(t, GoodRouter, time.Duration(0))
	msg := `Crows maunder on the petrified fairway.
Absence! My heart grows tense
as though a harpoon were sparring for the kill.`
	if _, err := c1.Write([]byte(msg)); err != nil {
		return
	}
	small := make([]byte, 3)
	var buf []byte
	for {
		if n, err := c2.Read(small); err != nil && err != ErrAgain {
			t.Fatal(err)
		} else if n == 0 {
			if err != ErrAgain {
				t.Fatalf("exepcted ErrAgain if we read 0 bytes, but got %v", err)
			}
			break
		} else {
			buf = append(buf, small[0:n]...)
		}
	}
	if string(buf) != msg {
		t.Fatal("message mismatch")
	}
}

func TestReorder(t *testing.T) {
	c1, c2, _, _ := genConnPair(t, BadRouterReorder, time.Duration(0))
	msgs := []string{
		"Alas, poor Yorick! I knew him, Horatio: a fellow",
		"of infinite jest, of most excellent fancy: he hath",
		"borne me on his back a thousand times; and now, how",
		"abhorred in my imagination it is! my gorge rims at",
		"it.",
	}
	for i, m := range msgs {
		if i > 0 {
			m = "\n" + m
		}
		if _, err := c1.Write([]byte(m)); err != nil {
			t.Fatal(err)
		}
	}
	buf := make([]byte, 1000)
	if _, err := c2.Read(buf); err != ErrBadPacketSequence {
		t.Fatalf("expected an ErrBadPacketSequence; got %v", err)
	}
}

func TestDrop(t *testing.T) {
	c1, c2, _, _ := genConnPair(t, BadRouterDrop, time.Duration(0))
	msgs := []string{
		"Alas, poor Yorick! I knew him, Horatio: a fellow",
		"of infinite jest, of most excellent fancy: he hath",
		"borne me on his back a thousand times; and now, how",
		"abhorred in my imagination it is! my gorge rims at",
		"it.",
	}
	for i, m := range msgs {
		if i > 0 {
			m = "\n" + m
		}
		if _, err := c1.Write([]byte(m)); err != nil {
			t.Fatal(err)
		}
	}
	buf := make([]byte, 1000)
	if _, err := c2.Read(buf); err != ErrBadPacketSequence {
		t.Fatalf("expected an ErrBadPacketSequence; got %v", err)
	}
}

func TestClose(t *testing.T) {
	c1, c2, _, _ := genConnPair(t, GoodRouter, time.Duration(4)*time.Second)
	msg := "Hello friend. I'm going to mic drop."
	if _, err := c1.Write([]byte(msg)); err != nil {
		t.Fatal(err)
	}
	if err := c1.Close(); err != nil {
		t.Fatal(err)
	}
	buf := make([]byte, 1000)
	if n, err := c2.Read(buf); err != nil {
		t.Fatal(err)
	} else if n != len(msg) {
		t.Fatal("short read")
	} else if string(buf[0:n]) != msg {
		t.Fatal("wrong msg")
	}

	// Assert we get an EOF now and forever...
	for i := 0; i < 3; i++ {
		if n, err := c2.Read(buf); err != io.EOF {
			t.Fatalf("expected EOF, but got err = %v", err)
		} else if n != 0 {
			t.Fatalf("Expected 0-length read, but got %d", n)
		}
	}
}

func TestErrAgain(t *testing.T) {
	_, c2, _, _ := genConnPair(t, GoodRouter, time.Duration(0))
	buf := make([]byte, 100)
	if n, err := c2.Read(buf); err != ErrAgain {
		t.Fatalf("wanted ErrAgain, but got err = %v", err)
	} else if n != 0 {
		t.Fatalf("Wanted 0 bytes back; got %d", n)
	}
}

func TestPollLoopSuccess(t *testing.T) {

	wait := time.Duration(8) * time.Millisecond
	r := newMockRouterWithBehaviorAndMaxPoll(GoodRouter, wait/32)
	s := genSecret(t)
	d1 := genDeviceID(t)
	d2 := genDeviceID(t)
	c1 := genNewConn(t, r, s, d1, wait)
	c2 := genNewConn(t, r, s, d2, wait)

	text := "poll for this, will you?"

	go func() {
		time.Sleep(wait / 4)
		c1.Write([]byte(text))
	}()
	buf := make([]byte, 100)
	n, err := c2.Read(buf)
	if err != nil {
		t.Fatal(err)
	}
	if n != len(text) {
		t.Fatalf("wrong read length")
	}
}

func TestPollLoopTimeout(t *testing.T) {

	wait := time.Duration(8) * time.Millisecond
	r := newMockRouterWithBehaviorAndMaxPoll(GoodRouter, wait/32)
	s := genSecret(t)
	d1 := genDeviceID(t)
	d2 := genDeviceID(t)
	c1 := genNewConn(t, r, s, d1, wait)
	c2 := genNewConn(t, r, s, d2, wait)

	text := "poll for this, will you?"

	go func() {
		time.Sleep(wait * 2)
		c1.Write([]byte(text))
	}()
	buf := make([]byte, 100)
	if _, err := c2.Read(buf); err != ErrTimedOut {
		t.Fatalf("Wanted ErrTimedOut; got %v", err)
	}
}
