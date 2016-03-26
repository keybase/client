package pubsub

import (
	"errors"
	"hash/fnv"
	"io"
	"strings"
	"sync"
	"time"

	"github.com/cenkalti/backoff"
	"github.com/garyburd/redigo/redis"
	"golang.org/x/net/context"
)

// ErrNotSubscribed is returned when an unsubscribe request is received for an unsubscribed channel.
var ErrNotSubscribed = errors.New("Not subscribed")

// DefaultSubscriberPoolSize is the default subscription worker pool size.
const DefaultSubscriberPoolSize = 16

// ConnectionToken is an opaque token used to identify a particular connection's generation.
// It's returned on any reconnection as well as from the subscribe command. The same token
// returned when subscribing is expected to be submitted when unsubscribing.
type ConnectionToken int

// Subscriber is an interface to a subscriber implementation. This library implements it with Redis.
type Subscriber interface {
	// Subscribe is called to subscribe for messages broadcast on the given channel.
	Subscribe(channel string) (token ConnectionToken, retChan <-chan error)
	// Unsubscribe is called to unsubscribe from the given channel.
	Unsubscribe(channel string, token ConnectionToken, count int) (currentCount int, err error)
	// GetSlot returns the slot number for the given channel.
	GetSlot(channel string) int
	// Shutdown is called to close all connections.
	Shutdown()
}

// SubscriptionHandler is an interface for receiving notification of subscriber events.
type SubscriptionHandler interface {
	// OnSubscriberConnect is called upon each successful connection.
	OnSubscriberConnect(s Subscriber, conn redis.Conn,
		address string, slot int, token ConnectionToken)
	// OnSubscriberConnectError is called whenever there is an error connecting.
	OnSubscriberConnectError(err error, nextTime time.Duration)
	// OnSubscribe is called upon successful channel subscription.
	OnSubscribe(channel string, count int)
	// OnUnsubscribe is called upon successful unsubscription from a channel.
	OnUnsubscribe(channel string, count int)
	// OnMessage is called whenever a message is broadcast on a channel a subscriber subscribes to.
	OnMessage(channel string, data []byte)
	// OnUnsubscribeError is called in the event of an unsubscription error.
	OnUnsubscribeError(channel string, err error)
	// OnReceiveError is called for any non-fatal error received.
	OnReceiveError(err error)
	// OnDisconnected is called whenever a connection is disconnected.
	// "channels" contains the list of channels this connection was subscribed to at the time.
	OnDisconnected(err error, slot int, channels []string)
	// GetUnsubscribeTimeout returns how long the implementation should wait prior to unsubscribing
	// from a channel after the subscriber count drops to 0.
	GetUnsubscribeTimeout() time.Duration
}

type redisSubscriberConn struct {
	slot       int
	token      int
	subscriber *redisSubscriber
	mutex      sync.Mutex
	conn       *redis.PubSubConn
	counts     map[string]int
	pending    map[string]chan error
	timers     map[string]context.CancelFunc
}

func (c *redisSubscriberConn) subscribe(channel string) (
	token int, retChan <-chan error) {
	errChan := make(chan error, 1)
	c.mutex.Lock()
	defer c.mutex.Unlock()
	count, ok := 0, false
	if count, ok = c.counts[channel]; ok {
		count++
	} else {
		count = 1
	}
	// update subscriber count
	c.counts[channel] = count
	if pendingChan, ok := c.pending[channel]; !ok {
		// first subscriber
		if count == 1 {
			if _, ok := c.timers[channel]; ok {
				// cancel existing unsubscribe timer
				c.setUnsubscribeTimerLocked(channel, 0)
				// already subscribed
				errChan <- nil
			} else {
				// save as pending
				c.pending[channel] = errChan
				// send the SUBSCRIBE+FLUSH commands
				if err := c.conn.Subscribe(channel); err != nil {
					errChan <- err
					delete(c.counts, channel)
					delete(c.pending, channel)
				}
			}
		} else {
			// already subscribed
			errChan <- nil
		}
	} else {
		// still pending
		errChan = pendingChan
	}
	return c.token, errChan
}

func (c *redisSubscriberConn) unsubscribe(channel string,
	token, count int) (int, error) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	if token != c.token {
		return 0, ErrNotSubscribed
	}
	currentCount, ok := 0, false
	if currentCount, ok = c.counts[channel]; ok {
		currentCount -= count
		if currentCount == 0 {
			delete(c.counts, channel)
			// start the unsubscribe timer for this channel
			timeout := c.subscriber.handler.GetUnsubscribeTimeout()
			c.setUnsubscribeTimerLocked(channel, timeout)
		} else {
			c.counts[channel] = currentCount
		}
	} else {
		return 0, ErrNotSubscribed
	}
	return currentCount, nil
}

func (c *redisSubscriberConn) setUnsubscribeTimerLocked(channel string, timeout time.Duration) {
	// cancel any existing timer
	if cancel, ok := c.timers[channel]; ok {
		delete(c.timers, channel)
		cancel()
	}
	if timeout == 0 {
		return
	}
	// start a new timer
	timer := time.NewTimer(timeout)
	ctx, cancel := context.WithCancel(context.Background())
	c.timers[channel] = cancel
	go func() {
		defer cancel()
		select {
		case <-timer.C:
			err := func() error {
				c.mutex.Lock()
				defer c.mutex.Unlock()
				if _, ok := c.counts[channel]; !ok {
					// remove the cancel function for this channel
					delete(c.timers, channel)
					// send the UNSUBSCRIBE+FLUSH commands
					return c.conn.Unsubscribe(channel)
				}
				return nil
			}()
			if err != nil {
				// notify the handler
				c.subscriber.handler.OnUnsubscribeError(channel, err)
			}
		case <-ctx.Done():
		}
	}()
}

func (c *redisSubscriberConn) isDisconnectError(err error) bool {
	switch err {
	case io.EOF:
		fallthrough
	case io.ErrUnexpectedEOF:
		fallthrough
	case io.ErrClosedPipe:
		return true
	default:
		if strings.HasSuffix(err.Error(), "use of closed network connection") {
			return true
		}
		return false
	}
}

func (c *redisSubscriberConn) receiveLoop() {
	for {
		switch msg := c.conn.Receive().(type) {
		case error:
			if c.isDisconnectError(msg) {
				var channels []string
				func() {
					c.mutex.Lock()
					defer c.mutex.Unlock()
					for channel := range c.counts {
						channels = append(channels, channel)
					}
					// close the connection
					c.closeLocked()
				}()
				// notify the subscription handler of channels we're no longer tracking
				c.subscriber.handler.OnDisconnected(msg, c.slot, channels)
				// reconnect
				c.subscriber.reconnectSlot(c.slot, c.token)
				return
			}
			c.subscriber.handler.OnReceiveError(msg)
		case redis.Message:
			// notify handler of new message
			c.subscriber.handler.OnMessage(msg.Channel, msg.Data)
		case redis.Subscription:
			// notify handler of new subscription event
			if msg.Kind == "subscribe" {
				func() {
					// signal waiting subscribers
					c.mutex.Lock()
					defer c.mutex.Unlock()
					if pendingChan, ok := c.pending[msg.Channel]; ok {
						pendingChan <- nil
					}
					delete(c.pending, msg.Channel)
				}()
				c.subscriber.handler.OnSubscribe(msg.Channel, msg.Count)
			} else if msg.Kind == "unsubscribe" {
				c.subscriber.handler.OnUnsubscribe(msg.Channel, msg.Count)
			}
		}
	}
}

func (c *redisSubscriberConn) close() {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	c.closeLocked()
}

func (c *redisSubscriberConn) closeLocked() {
	// close the connection
	c.conn.Close()
	// clear channel subscription counts
	c.counts = make(map[string]int)
	// cancel all timers
	for _, cancel := range c.timers {
		cancel()
	}
	c.timers = make(map[string]context.CancelFunc)
	// send error signal for all pending subscriptions
	for _, pendingChan := range c.pending {
		pendingChan <- io.EOF
	}
	c.pending = make(map[string]chan error)
}

type redisSubscriber struct {
	address       string
	handler       SubscriptionHandler
	slotMutexes   []sync.RWMutex
	slots         []*redisSubscriberConn
	shutdownMutex sync.RWMutex
	shutdown      bool
}

// NewRedisSubscriber instantiates a Subscriber implementation backed by Redis.
func NewRedisSubscriber(address string, handler SubscriptionHandler, poolSize int) Subscriber {
	if poolSize == 0 {
		poolSize = DefaultSubscriberPoolSize
	}
	// create the subscriber
	subscriber := &redisSubscriber{
		address:     address,
		handler:     handler,
		slotMutexes: make([]sync.RWMutex, poolSize),
		slots:       make([]*redisSubscriberConn, poolSize),
	}
	for slot := 0; slot < poolSize; slot++ {
		subscriber.reconnectSlot(slot, 0)
	}
	return subscriber
}

func (s *redisSubscriber) reconnectSlot(slot, lastToken int) {
	// connect. todo: let handler specify backoff parameters
	expBackoff := backoff.NewExponentialBackOff()
	// don't quit trying
	expBackoff.MaxElapsedTime = 0

	var conn redis.Conn
	err := backoff.RetryNotify(func() error {
		// quit reconnecting if shutting down
		if s.isShutdown() {
			return nil
		}
		var err error
		conn, err = redis.Dial("tcp", s.address)
		return err
	}, expBackoff, s.handler.OnSubscriberConnectError)

	// shouldn't be possible
	if err != nil {
		panic(err)
	}

	// prevent respawning a receive loop
	s.shutdownMutex.RLock()
	defer s.shutdownMutex.RUnlock()
	if s.shutdown {
		if conn != nil {
			conn.Close()
		}
		return
	}

	// don't care if this overflows
	lastToken++

	// create the connection
	connection := &redisSubscriberConn{
		slot:       slot,
		token:      lastToken,
		subscriber: s,
		conn:       &redis.PubSubConn{Conn: conn},
		counts:     make(map[string]int),
		pending:    make(map[string]chan error),
		timers:     make(map[string]context.CancelFunc),
	}
	func() {
		// save it to its slot
		s.slotMutexes[slot].Lock()
		defer s.slotMutexes[slot].Unlock()
		s.slots[slot] = connection
	}()

	// call the callback
	s.handler.OnSubscriberConnect(s, conn, s.address, slot, ConnectionToken(lastToken))

	// start the receive loop
	go connection.receiveLoop()
}

func (s *redisSubscriber) isShutdown() bool {
	s.shutdownMutex.RLock()
	defer s.shutdownMutex.RUnlock()
	return s.shutdown
}

// GetSlot implements the Subscriber interface.
func (s *redisSubscriber) GetSlot(channel string) int {
	// attempt to evenly spread channels over available connections.
	// this mitigates the impact of a single disconnection and spreads load.
	h := fnv.New32a()
	h.Write([]byte(channel))
	return int(h.Sum32() % uint32(len(s.slots)))
}

// Subscribe implements the Subscriber interface.
func (s *redisSubscriber) Subscribe(channel string) (
	token ConnectionToken, retChan <-chan error) {
	slot := s.GetSlot(channel)
	s.slotMutexes[slot].RLock()
	defer s.slotMutexes[slot].RUnlock()
	t, retChan := s.slots[slot].subscribe(channel)
	return ConnectionToken(t), retChan
}

// Unsubscribe implements the Subscriber interface.
func (s *redisSubscriber) Unsubscribe(channel string,
	token ConnectionToken, count int) (int, error) {
	slot := s.GetSlot(channel)
	s.slotMutexes[slot].RLock()
	defer s.slotMutexes[slot].RUnlock()
	return s.slots[slot].unsubscribe(channel, int(token), count)
}

// Shutdown implements the Subscriber interface.
func (s *redisSubscriber) Shutdown() {
	s.shutdownMutex.Lock()
	defer s.shutdownMutex.Unlock()
	s.shutdown = true
	for _, conn := range s.slots {
		conn.close()
	}
}
