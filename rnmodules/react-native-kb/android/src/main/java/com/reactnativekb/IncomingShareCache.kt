package com.reactnativekb

import android.content.Context
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.util.UUID

// Sharing into the app copies the sender's content out of its content:// uri and
// into our cache, because the uri is only readable for as long as the intent
// lives. Nothing deletes those copies afterwards: the share is handed to JS as a
// path and the app never learns when it is finished with it. Keeping them in one
// named directory rather than loose in cacheDir is what makes a sweep possible at
// all -- the copies carry the sender's own filenames, so there is no pattern to
// match on.
object IncomingShareCache {
    private const val DIR_NAME = "incoming-shares"

    // A share is what launches the app, so a blind sweep at startup could delete
    // the file the user is looking at. Anything this old is from a previous run.
    private const val MAX_AGE_MS = 24L * 60 * 60 * 1000

    fun dir(context: Context): File {
        val dir = File(context.cacheDir, DIR_NAME)
        dir.mkdirs()
        return dir
    }

    // Copies input into a new item file named name, in dir (see dir). Each item
    // gets its own directory so two items with the same name, in one share or in
    // overlapping ones, never overwrite each other's copy. name must be a single
    // path component (see IncomingShareFileName). On any failure nothing is left
    // behind.
    fun copyIn(dir: File, input: InputStream, name: String): File {
        val itemDir = File(dir, UUID.randomUUID().toString())
        if (!itemDir.mkdirs()) {
            throw IOException("unable to create ${itemDir.path}")
        }
        val file = File(itemDir, name)
        try {
            FileOutputStream(file).use { output -> input.copyTo(output, 64 * 1024) }
        } catch (e: Exception) {
            itemDir.deleteRecursively()
            throw e
        }
        return file
    }

    // Call off the main thread: this stats every file in dir (see dir).
    fun purgeOld(dir: File) {
        val cutoff = System.currentTimeMillis() - MAX_AGE_MS
        // null means the listing itself failed, which is not the same as an empty
        // directory: the copies are still there, so say so rather than looking swept
        val files = dir.listFiles()
        if (files == null) {
            NativeLogger.warn("IncomingShareCache: unable to list the cache directory, skipping purge")
            return
        }
        files.forEach { file ->
            if (file.lastModified() < cutoff) {
                file.deleteRecursively()
            }
        }
    }
}
