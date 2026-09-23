package com.reactnativekb

// The last tapped notification, held until JS acks its id. A new tap replaces
// any held one with a higher id; ids count taps of this process from 1. Written
// on the main thread, read and cleared on the JS thread.
class PushTapSlot {
    data class Tap(val payload: String, val id: Long)

    private var held: Tap? = null
    private var lastID = 0L

    @Synchronized
    fun set(payload: String): Long {
        lastID++
        held = Tap(payload, lastID)
        return lastID
    }

    // Does not clear: the tap stays until acked.
    @Synchronized
    fun peek(): Tap? = held

    // No-op unless id is the held tap's.
    @Synchronized
    fun ack(id: Long) {
        if (held?.id == id) {
            held = null
        }
    }
}
