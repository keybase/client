package io.keybase.ossifrage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class PushTapDataTest {
    @Test
    fun aPayloadRoundTrips() {
        val payload = """{"type":"chat.newmessage","convID":"0000ab","uid":"u 1&x/+","message":"hi ünïcode"}"""
        assertEquals(payload, PushTapData.decode(PushTapData.encode(payload)))
    }

    // W7: buildPendingIntent reused one request code per second, and extras are not part of
    // filterEquals, so two notifications built in the same second shared a PendingIntent and
    // the second one's tap opened the first one's target. Distinct data makes them non-equal.
    @Test
    fun twoNotificationsInTheSameSecondGetDistinctTapTargets() {
        val first = PushTapData.encode("""{"type":"chat.newmessage","convID":"conv-a","uid":"u1"}""")
        val second = PushTapData.encode("""{"type":"chat.newmessage","convID":"conv-b","uid":"u1"}""")

        assertNotEquals(first, second)
        assertEquals("""{"type":"chat.newmessage","convID":"conv-a","uid":"u1"}""", PushTapData.decode(first))
        assertEquals("""{"type":"chat.newmessage","convID":"conv-b","uid":"u1"}""", PushTapData.decode(second))
    }

    @Test
    fun twoNotificationsWithTheSamePayloadShareOneTapTarget() {
        val payload = """{"type":"follow","username":"testuser"}"""
        assertEquals(PushTapData.encode(payload), PushTapData.encode(payload))
    }

    @Test
    fun aDataUriFromAnywhereElseDecodesToNothing() {
        assertEquals("", PushTapData.decode(null))
        assertEquals("", PushTapData.decode("keybase://convid/0000ab"))
        assertEquals("", PushTapData.decode(""))
    }
}
