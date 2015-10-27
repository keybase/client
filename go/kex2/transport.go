package kex2

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"io"
	"net"
	"sync"
	"time"

	"github.com/ugorji/go/codec"
	"golang.org/x/crypto/nacl/secretbox"
)

// DeviceID is a 16-byte identifier that each side of key exchange has. It's
// used primarily to tell sender from receiver.
type DeviceID [16]byte

// SessionID is a 32-byte session identifier that's derived from the shared
// session secret. It's used to route messages on the server side.
type SessionID [32]byte

// SecretLen is the number of bytes in the secret.
const SecretLen = 32

// Secret is the 32-byte shared secret identifier
type Secret [SecretLen]byte

// Seqno increments on every message sent from a Kex sender.
type Seqno uint32

// Eq returns true if the two device IDs are equal
func (d DeviceID) Eq(d2 DeviceID) bool {
	return hmac.Equal(d[:], d2[:])
}

// Eq returns true if the two session IDs are equal
func (s SessionID) Eq(s2 SessionID) bool {
	return hmac.Equal(s[:], s2[:])
}

// MessageRouter is a stateful message router that will be implemented by
// JSON/REST calls to the Keybase API server.
type MessageRouter interface {

	// Post a message. Message will always be non-nil and non-empty.
	// Even for an EOF, the empty buffer is encrypted via SecretBox,
	// so the buffer posted to the server will have data.
	Post(I SessionID, sender DeviceID, seqno Seqno, msg []byte) error

	// Get messages on the channel.  Only poll for `poll` milliseconds. If the timeout
	// elapses without any data ready, then just return an empty result, with nil error.
	// Several messages can be returned at once, which should be processed in serial.
	// They are guaranteed to be in order; otherwise, there was an issue.
	// Get() should only return a non-nil error if there was an HTTPS or TCP-level error.
	// Application-level errors like EOF or no data ready are handled by modulating
	// the `msgs` result.
	Get(I SessionID, receiver DeviceID, seqno Seqno, poll time.Duration) (msg [][]byte, err error)
}

// Conn is a struct that obeys the net.Conn interface. It establishes a session abstraction
// over a message channel bounced off the Keybase API server, applying the appropriate
// e2e encryption/MAC'ing.
type Conn struct {
	router    MessageRouter
	secret    Secret
	sessionID SessionID
	deviceID  DeviceID

	// Protects the read path. There should only be one reader outstanding at once.
	readMutex    sync.Mutex
	readSeqno    Seqno
	readDeadline time.Time
	readTimeout  time.Duration
	bufferedMsgs [][]byte

	// Protects the write path. There should only be one writer oustanding at once.
	writeMutex sync.Mutex
	writeSeqno Seqno

	// Protects the setting of error states. Only one thread should be setting or
	// accessing these errors at a time.
	errMutex sync.Mutex
	readErr  error
	writeErr error
}

const sessionIDText = "Kex v2 Session ID"

// NewConn establishes a Kex session based on the given secret. Will work for
// both ends of the connection, regardless of which order the two started
// their conntection. Will communicate with the other end via the given message router.
// You can specify an optional timeout to cancel any reads longer than that timeout.
func NewConn(r MessageRouter, s Secret, d DeviceID, readTimeout time.Duration) (con net.Conn, err error) {
	mac := hmac.New(sha256.New, []byte(s[:]))
	mac.Write([]byte(sessionIDText))
	tmp := mac.Sum(nil)
	var sessionID SessionID
	copy(sessionID[:], tmp)
	ret := &Conn{
		router:      r,
		secret:      s,
		sessionID:   sessionID,
		deviceID:    d,
		readSeqno:   0,
		readTimeout: readTimeout,
		writeSeqno:  0,
	}
	return ret, nil
}

// TimedoutError is for operations that timed out; for instance, if no read
// data was available before the deadline.
type timedoutError struct{}

// Error returns the string representation of this error
func (t timedoutError) Error() string { return "operation timed out" }

// Temporary returns if the error is retriable
func (t timedoutError) Temporary() bool { return true }

// Timeout returns if this error is a timeout
func (t timedoutError) Timeout() bool { return true }

// ErrTimedOut is the signleton error we use if the operation timedout.
var ErrTimedOut net.Error = timedoutError{}

// ErrUnimplemented indicates the given method isn't implemented
var ErrUnimplemented = errors.New("unimplemented")

// ErrBadMetadata indicates that the metadata outside the encrypted message
// didn't match what was inside.
var ErrBadMetadata = errors.New("bad metadata")

// ErrBadDecryption indicates that a ciphertext failed to decrypt or MAC properly
var ErrDecryption = errors.New("decryption failed")

// ErrNotEnoughRandomness indicates that encryption failed due to insufficient
// randomness
var ErrNotEnoughRandomness = errors.New("not enough random data")

// ErrBadPacketSequence indicates that packets arrived out of order from the
// server (which they shouldn't).
var ErrBadPacketSequence = errors.New("packets arrived out-of-order")

// ErrWrongSession indicatest that the given session didn't match the
// clients expectations
var ErrWrongSession = errors.New("got message for wrong Session ID")

// ErrSelfReceive indicates that the client received a message sent by
// itself, which should never happen
var ErrSelfRecieve = errors.New("got message back that we sent")

// ErrAgain indicates that no data was available to read, but the
// reader was in non-blocking mode, so to try again later.
var ErrAgain = errors.New("no data were ready to read")

// ErrBadSecret indicates that the secret received was invalid.
var ErrBadSecret = errors.New("bad secret")

func (c *Conn) setReadError(e error) error {
	c.errMutex.Lock()
	c.readErr = e
	c.errMutex.Unlock()
	return e
}

func (c *Conn) setWriteError(e error) error {
	c.errMutex.Lock()
	c.writeErr = e
	c.errMutex.Unlock()
	return e
}

func (c *Conn) getErrorForWrite() error {
	var err error
	c.errMutex.Lock()
	if c.readErr != nil && c.readErr != io.EOF {
		err = c.readErr
	} else if c.writeErr != nil {
		err = c.writeErr
	}
	c.errMutex.Unlock()
	return err
}

func (c *Conn) getErrorForRead() error {
	var err error
	c.errMutex.Lock()
	if c.readErr != nil {
		err = c.readErr
	} else if c.writeErr != nil && c.writeErr != io.EOF {
		err = c.writeErr
	}
	c.errMutex.Unlock()
	return err
}

type outerMsg struct {
	_struct   bool      `codec:",toarray"`
	SenderID  DeviceID  `codec:"senderID"`
	SessionID SessionID `codec:"sessionID"`
	Seqno     Seqno     `codec:"seqno"`
	Nonce     [24]byte  `codec:"nonce"`
	Payload   []byte    `codec:"payload"`
}

type innerMsg struct {
	_struct   bool      `codec:",toarray"`
	SenderID  DeviceID  `codec:"senderID"`
	SessionID SessionID `codec:"sessionID"`
	Seqno     Seqno     `codec:"seqno"`
	Payload   []byte    `codec:"payload"`
}

func (c *Conn) decryptIncomingMessage(msg []byte) (int, error) {
	var err error
	mh := codec.MsgpackHandle{WriteExt: true}
	dec := codec.NewDecoderBytes(msg, &mh)
	var om outerMsg
	err = dec.Decode(&om)
	if err != nil {
		return 0, err
	}
	var plaintext []byte
	var ok bool
	plaintext, ok = secretbox.Open(plaintext, om.Payload, &om.Nonce, (*[32]byte)(&c.secret))
	if !ok {
		return 0, ErrDecryption
	}
	dec = codec.NewDecoderBytes(plaintext, &mh)
	var im innerMsg
	err = dec.Decode(&im)
	if err != nil {
		return 0, err
	}
	if !om.SenderID.Eq(im.SenderID) || !om.SessionID.Eq(im.SessionID) || om.Seqno != im.Seqno {
		return 0, ErrBadMetadata
	}
	if !im.SessionID.Eq(c.sessionID) {
		return 0, ErrWrongSession
	}
	if im.SenderID.Eq(c.deviceID) {
		return 0, ErrSelfRecieve
	}

	if im.Seqno != c.readSeqno+1 {
		return 0, ErrBadPacketSequence
	}
	c.readSeqno = im.Seqno

	c.bufferedMsgs = append(c.bufferedMsgs, im.Payload)
	return len(im.Payload), nil
}

func (c *Conn) decryptIncomingMessages(msgs [][]byte) (int, error) {
	var ret int
	for _, msg := range msgs {
		n, e := c.decryptIncomingMessage(msg)
		if e != nil {
			return ret, e
		}
		ret += n
	}
	return ret, nil
}

func (c *Conn) readBufferedMsgsIntoBytes(out []byte) (int, error) {
	p := 0

	// If no buffered messages, then return that we didn't pull any
	// new data from the server.
	if len(c.bufferedMsgs) == 0 {
		return 0, nil
	}

	// Any empty buffer signals an EOF condition
	if len(c.bufferedMsgs[0]) == 0 {
		return 0, io.EOF
	}

	for p < len(out) {
		rem := len(out) - p
		if len(c.bufferedMsgs) > 0 {
			front := c.bufferedMsgs[0]
			n := len(front)

			// An empty buffer signifies that the other side wanted
			// and EOF condition. However, we shouldn't return an EOF
			// if we've read anything, this time through.
			if n == 0 {
				var err error
				if p == 0 {
					err = io.EOF
				}
				return p, err
			}

			if rem < n {
				n = rem
				copy(out[p:(p+n)], front[0:n])
				front = front[n:]
				if len(front) == 0 {
					// Be careful not to recycle an empty buffer into the
					// list of buffered messages, since that has special
					// significance (see above).
					c.bufferedMsgs = c.bufferedMsgs[1:]
				} else {
					c.bufferedMsgs[0] = front
				}
			} else {
				copy(out[p:(p+n)], front[:])
				c.bufferedMsgs = c.bufferedMsgs[1:]
			}

			p += n
		} else {
			break
		}
	}
	return p, nil
}

func (c *Conn) pollLoop(poll time.Duration) (msgs [][]byte, err error) {

	var totalWaitTime time.Duration

	start := time.Now()
	for {
		newPoll := poll - totalWaitTime
		msgs, err = c.router.Get(c.sessionID, c.deviceID, c.readSeqno+1, newPoll)
		totalWaitTime = time.Since(start)
		if err != nil || len(msgs) > 0 || totalWaitTime >= poll {
			return
		}
	}
}

// Read data from the connection, returning plaintext data if all
// cryptographic checks passed. Obeys the `net.Conn` interface.
// Returns the number of bytes read into the output buffer.
func (c *Conn) Read(out []byte) (n int, err error) {

	c.readMutex.Lock()
	defer c.readMutex.Unlock()

	// The first error kills the whole stream
	if err = c.getErrorForRead(); err != nil {
		return 0, err
	}
	// First see if there's anything buffered, and read that
	// out now.
	if n, err = c.readBufferedMsgsIntoBytes(out); err != nil {
		return 0, c.setReadError(err)
	}
	if n > 0 {
		return n, nil
	}

	var poll time.Duration
	if !c.readDeadline.IsZero() {
		poll = c.readDeadline.Sub(time.Now())
		if poll.Nanoseconds() < 0 {
			return 0, c.setReadError(ErrTimedOut)
		}
	} else {
		poll = c.readTimeout
	}

	var msgs [][]byte
	msgs, err = c.pollLoop(poll)

	if err != nil {
		return 0, c.setReadError(err)
	}
	if _, err = c.decryptIncomingMessages(msgs); err != nil {
		return 0, c.setReadError(err)
	}
	if n, err = c.readBufferedMsgsIntoBytes(out); err != nil {
		return 0, c.setReadError(err)
	}

	if n == 0 {
		if poll > 0 {
			err = ErrTimedOut
		} else {
			err = ErrAgain
		}
	}

	return n, err
}

func (c *Conn) encryptOutgoingMessage(seqno Seqno, buf []byte) (ret []byte, err error) {
	var nonce [24]byte
	var n int

	if n, err = rand.Read(nonce[:]); err != nil {
		return nil, err
	} else if n != 24 {
		return nil, ErrNotEnoughRandomness
	}
	im := innerMsg{
		SenderID:  c.deviceID,
		SessionID: c.sessionID,
		Seqno:     seqno,
		Payload:   buf,
	}
	mh := codec.MsgpackHandle{WriteExt: true}
	var imPacked []byte
	enc := codec.NewEncoderBytes(&imPacked, &mh)
	if err = enc.Encode(im); err != nil {
		return nil, err
	}
	ciphertext := secretbox.Seal(nil, imPacked, &nonce, (*[32]byte)(&c.secret))

	om := outerMsg{
		SenderID:  c.deviceID,
		SessionID: c.sessionID,
		Seqno:     seqno,
		Nonce:     nonce,
		Payload:   ciphertext,
	}
	enc = codec.NewEncoderBytes(&ret, &mh)
	if err = enc.Encode(om); err != nil {
		return nil, err
	}
	return ret, nil
}

func (c *Conn) nextWriteSeqno() Seqno {
	c.writeSeqno++
	return c.writeSeqno
}

// Write data to the connection, encrypting and MAC'ing along the way.
// Obeys the `net.Conn` interface
func (c *Conn) Write(buf []byte) (n int, err error) {

	c.writeMutex.Lock()
	defer c.writeMutex.Unlock()

	// Our protocol specifes that writing an empty buffer means "close"
	// the connection.  We don't want callers of `Write` to do this by
	// accident, we want them to call `Close()` explicitly. So short-circuit
	// the write operation here for empty buffers.
	if len(buf) == 0 {
		return 0, nil
	}

	return c.writeWithLock(buf)
}

func (c *Conn) writeWithLock(buf []byte) (n int, err error) {

	var ctext []byte

	// The first error kills the whole stream
	if err = c.getErrorForWrite(); err != nil {
		return 0, err
	}

	seqno := c.nextWriteSeqno()

	ctext, err = c.encryptOutgoingMessage(seqno, buf)
	if err != nil {
		return 0, c.setWriteError(err)
	}

	if err = c.router.Post(c.sessionID, c.deviceID, seqno, ctext); err != nil {
		return 0, c.setWriteError(err)
	}

	return len(ctext), nil
}

// Close the connection to the server, sending an empty buffer via POST
// through the `MessageRouter`. Fulfills the `net.Conn` interface
func (c *Conn) Close() error {

	c.writeMutex.Lock()
	defer c.writeMutex.Unlock()

	// Write an empty buffer to signal EOF
	if _, err := c.writeWithLock([]byte{}); err != nil {
		return err
	}

	// All subsequent writes should fail.
	c.setWriteError(io.EOF)
	return nil
}

// LocalAddr returns the local network address, fulfilling the `net.Conn interface`
func (c *Conn) LocalAddr() (addr net.Addr) {
	return
}

// RemoteAddr returns the remote network address, fulfilling the `net.Conn interface`
func (c *Conn) RemoteAddr() (addr net.Addr) {
	return
}

// SetDeadline sets the read and write deadlines associated
// with the connection. It is equivalent to calling both
// SetReadDeadline and SetWriteDeadline.
//
// A deadline is an absolute time after which I/O operations
// fail with a timeout (see type Error) instead of
// blocking. The deadline applies to all future I/O, not just
// the immediately following call to Read or Write.
//
// An idle timeout can be implemented by repeatedly extending
// the deadline after successful Read or Write calls.
//
// A zero value for t means I/O operations will not time out.
func (c *Conn) SetDeadline(t time.Time) error {
	return c.SetReadDeadline(t)
}

// SetReadDeadline sets the deadline for future Read calls.
// A zero value for t means Read will not time out.
func (c *Conn) SetReadDeadline(t time.Time) error {
	c.readMutex.Lock()
	c.readDeadline = t
	c.readMutex.Unlock()
	return nil
}

// SetWriteDeadline sets the deadline for future Write calls.
// Even if write times out, it may return n > 0, indicating that
// some of the data was successfully written.
// A zero value for t means Write will not time out.
// We're not implementing this feature for now, so make it an error
// if we try to do so.
func (c *Conn) SetWriteDeadline(t time.Time) error {
	return ErrUnimplemented
}
