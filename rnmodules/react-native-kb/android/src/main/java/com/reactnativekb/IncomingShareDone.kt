package com.reactnativekb

import android.content.Context
import java.io.File

// The keys of the shares JS was last done with, kept outside the Activity's
// saved state: that state can be saved while a share is still open, and the
// share then sent before the process is killed. A restore drops a share whose
// key is here, so a sent share never comes back. Written synchronously when JS
// is done with a share, before anything can kill the process for it.
object IncomingShareDone {
    private const val FILE_NAME = "incoming-shares-done"
    // A saved state only ever holds one share, so a few recent keys are plenty.
    private const val KEPT = 16

    fun file(context: Context) = File(context.filesDir, FILE_NAME)

    @Synchronized
    fun record(file: File, key: String) {
        if (key.isEmpty()) return
        val keys = (read(file) + key).takeLast(KEPT)
        val tmp = File(file.path + ".tmp")
        tmp.writeText(keys.joinToString("\n"))
        if (!tmp.renameTo(file)) {
            file.writeText(keys.joinToString("\n"))
            tmp.delete()
        }
    }

    @Synchronized
    fun contains(file: File, key: String): Boolean = key.isNotEmpty() && key in read(file)

    private fun read(file: File): List<String> =
        if (file.exists()) file.readLines().filter { it.isNotEmpty() } else emptyList()
}
