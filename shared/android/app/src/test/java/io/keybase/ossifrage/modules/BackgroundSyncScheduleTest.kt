package io.keybase.ossifrage.modules

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class BackgroundSyncScheduleTest {
    private val calls = mutableListOf<String>()
    private var enqueueFails = false
    private var done = false

    private val jobs = object : BackgroundSyncJobs {
        override fun cancelAll() {
            calls.add("cancelAll")
        }

        override fun enqueueUnique() {
            if (enqueueFails) throw IllegalStateException("enqueue failed")
            calls.add("enqueueUnique")
        }
    }

    private val flag = object : LegacyJobsCleanupFlag {
        override fun isDone() = done

        override fun markDone() {
            done = true
        }
    }

    @Test
    fun firstRunCancelsLegacyJobsThenEnqueues() {
        scheduleBackgroundSync(jobs, flag)
        assertEquals(listOf("cancelAll", "enqueueUnique"), calls)
        assertTrue(done)
    }

    @Test
    fun laterRunsOnlyEnqueue() {
        scheduleBackgroundSync(jobs, flag)
        calls.clear()
        scheduleBackgroundSync(jobs, flag)
        scheduleBackgroundSync(jobs, flag)
        assertEquals(listOf("enqueueUnique", "enqueueUnique"), calls)
    }

    @Test
    fun failedEnqueueRetriesTheCleanupNextRun() {
        enqueueFails = true
        try {
            scheduleBackgroundSync(jobs, flag)
            fail("the failure propagates")
        } catch (e: IllegalStateException) {
        }
        assertFalse(done)
        enqueueFails = false
        calls.clear()
        scheduleBackgroundSync(jobs, flag)
        assertEquals(listOf("cancelAll", "enqueueUnique"), calls)
        assertTrue(done)
    }
}
