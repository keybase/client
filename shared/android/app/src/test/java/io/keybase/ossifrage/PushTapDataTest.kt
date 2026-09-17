package io.keybase.ossifrage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class PushTapDataTest {
    // A chat push's data fields, as the FCM Bundle carries them.
    private fun chatPush(convID: String, messageID: String) =
        mapOf(
            "type" to "chat.newmessage",
            "convID" to convID,
            "uid" to "u1",
            "d" to messageID,
            "m" to "encrypted payload",
            "t" to "1",
            "badge" to "3"
        )

    private fun fieldsOf(push: Map<String, String>) = PushTapData.tapFields { push[it] }

    private fun dataFor(push: Map<String, String>) = PushTapData.tapIntentData(fieldsOf(push))

    // W7: buildPendingIntent reused one PendingIntent per second, and extras are not part of
    // filterEquals, so two notifications built together shared one and the second one's tap
    // opened the first one's conversation. The payload rides in the Intent's data instead.
    @Test
    fun twoNotificationsInTheSameSecondGetDistinctTapTargets() {
        val first = dataFor(chatPush("conv-a", "1"))
        val second = dataFor(chatPush("conv-b", "2"))

        assertNotEquals(first, second)
        assertEquals("""{"type":"chat.newmessage","convID":"conv-a","uid":"u1"}""", PushTapData.decode(first))
        assertEquals("""{"type":"chat.newmessage","convID":"conv-b","uid":"u1"}""", PushTapData.decode(second))
    }

    // Deliberate: both notifications open the same conversation, so sharing a PendingIntent is
    // correct. Only the target has to be distinct, not the message.
    @Test
    fun twoMessagesInOneConversationShareOneTapTarget() {
        assertEquals(dataFor(chatPush("conv-a", "1")), dataFor(chatPush("conv-a", "2")))
    }

    @Test
    fun onlyTheFieldsATapNeedsAreEncoded() {
        assertEquals(
            mapOf("type" to "chat.newmessage", "convID" to "conv-a", "uid" to "u1"),
            fieldsOf(chatPush("conv-a", "1"))
        )
        assertEquals(
            mapOf("type" to "follow", "targetUID" to "u2", "username" to "testuser"),
            PushTapData.tapFields(
                mapOf("type" to "follow", "targetUID" to "u2", "username" to "testuser", "message" to "x")::get
            )
        )
    }

    // pushTapTarget only tests the prefix, so the contact's name never reaches the data URI.
    @Test
    fun aContactMessageIsTruncatedToItsPrefix() {
        val fields = PushTapData.tapFields(mapOf("message" to "Your contact testuser joined Keybase")::get)

        assertEquals(mapOf("message" to "Your contact"), fields)
    }

    @Test
    fun anEmptyFieldIsLeftOut() {
        assertEquals(
            mapOf("type" to "device.new"),
            PushTapData.tapFields(mapOf("type" to "device.new", "uid" to "", "username" to "")::get)
        )
    }

    @Test
    fun aPayloadRoundTripsThroughTheDataUri() {
        val fields = mapOf("type" to "follow", "username" to """a"b\c ü+%/&""")

        assertEquals(
            """{"type":"follow","username":"a\"b\\c ü+%/&"}""",
            PushTapData.decode(PushTapData.tapIntentData(fields))
        )
    }

    @Test
    fun aDataUriFromAnywhereElseDecodesToNothing() {
        assertEquals("", PushTapData.decode(null))
        assertEquals("", PushTapData.decode("keybase://convid/0000ab"))
        assertEquals("", PushTapData.decode(""))
    }
}
