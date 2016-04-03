package pubsub

import (
	"errors"
	"sync"
	"time"

	"github.com/cenkalti/backoff"
	"github.com/garyburd/redigo/redis"
)

// ErrPublishWouldBlock is returned when the outgoing message buffer is full.
var ErrPublishWouldBlock = errors.New("Publish would block")

// ErrPublishPoolClosed is returned when the publish pool is closed.
var ErrPublishPoolClosed = errors.New("Publish pool closed")

// DefaultPublisherPoolSize is the default size of the worker pool.
const DefaultPublisherPoolSize = 16

// DefaultPublisherBufferSize is the default size of the outgoing message buffer.
const DefaultPublisherBufferSize = 1 << 20

// Publisher is an interface to a publisher imlementation. This library implements it with Redis.
type Publisher interface {
	// Publish is called to publish the given message to the given channel.
	Publish(channel string, data []byte)
	// PublishBatch is called to synchronously publish a batch of messages.
	// The returned error is the result of the FLUSH command.
	PublishBatch(channels []string, data [][]byte) error
	// Shutdown is called to synchronously stop all publishing activity.
	Shutdown()
}

// PublicationHandler is an interface for receiving notification of publisher events.
type PublicationHandler interface {
	// OnPublishConnect is called upon each successful connection.
	OnPublishConnect(conn redis.Conn, address string)
	// OnPublishConnectError is called whenever there is an error connecting.
	OnPublishConnectError(err error, nextTime time.Duration)
	// OnPublishError is called upon any error when attempting to publish a message.
	OnPublishError(err error, channel string, data []byte)
}

type message struct {
	channel string
	data    []byte
}

type redisPublisher struct {
	pool      *redis.Pool
	handler   PublicationHandler
	messages  chan *message
	closeChan chan struct{}
	wg        sync.WaitGroup
}

// NewRedisPublisher instantiates a Publisher implementation backed by
// Redis.  If poolSize is 0, DefaultPublisherPoolSize is used.  If
// bufferSize if 0, DefaultPublishedBufferSize is used.
func NewRedisPublisher(address string, handler PublicationHandler, poolSize, bufferSize int) Publisher {
	if poolSize == 0 {
		poolSize = DefaultPublisherPoolSize
	}
	if bufferSize == 0 {
		bufferSize = DefaultPublisherBufferSize
	}
	closeChan := make(chan struct{}, 1)
	p := &redisPublisher{
		pool: &redis.Pool{
			MaxIdle: poolSize,
			Dial: func() (conn redis.Conn, err error) {
				expBackoff := backoff.NewExponentialBackOff()
				// don't quit trying
				expBackoff.MaxElapsedTime = 0
				err = backoff.RetryNotify(func() error {
					select {
					case <-closeChan:
						// break out of loop if closed
						return nil
					default:
					}
					var err error
					conn, err = redis.Dial("tcp", address)
					return err
				}, expBackoff,
					handler.OnPublishConnectError)
				select {
				case <-closeChan:
					err = ErrPublishPoolClosed
					return conn, err
				default:
				}
				if err == nil {
					handler.OnPublishConnect(conn, address)
				}
				return conn, err
			},
		},
		handler:   handler,
		messages:  make(chan *message, bufferSize),
		closeChan: closeChan,
	}
	// start the workers
	p.wg.Add(poolSize)
	for i := 0; i < poolSize; i++ {
		go p.publishLoop()
	}
	return p
}

func (p *redisPublisher) publishLoop() {
	defer p.wg.Done()
	for m := range p.messages {
		func() {
			conn := p.pool.Get()
			defer conn.Close()
			if _, err := conn.Do("PUBLISH", m.channel, m.data); err != nil {
				p.handler.OnPublishError(err, m.channel, m.data)
			}
		}()
	}
}

// Publish implements the Publisher interface.
func (p *redisPublisher) Publish(channel string, data []byte) {
	select {
	case p.messages <- &message{channel: channel, data: data}:
	default:
		p.handler.OnPublishError(ErrPublishWouldBlock, channel, data)
	}
}

// PublishBatch implements the Publisher interface.
func (p *redisPublisher) PublishBatch(channels []string, data [][]byte) error {
	if len(data) == 0 {
		return nil
	}
	conn := p.pool.Get()
	defer conn.Close()
	for i, d := range data {
		if err := conn.Send("PUBLISH", channels[i], d); err != nil {
			// This would be a fatal encoder error. redigo closes
			// the connection in this case.
			return err
		}
	}
	if err := conn.Flush(); err != nil {
		// Fatal; redigo closes the conection.
		return err
	}
	// Drain replies; errors may not always be fatal.
	var err error
	for i, d := range data {
		if _, e := conn.Receive(); e != nil {
			// Call the handler for each.
			p.handler.OnPublishError(err, channels[i], d)
			if err == nil {
				// Return the first error.
				err = e
			}
		}
	}
	return err
}

// Shutdown implements the Publisher interface.
func (p *redisPublisher) Shutdown() {
	close(p.closeChan)
	close(p.messages)
	p.pool.Close()
	p.wg.Wait()
}
