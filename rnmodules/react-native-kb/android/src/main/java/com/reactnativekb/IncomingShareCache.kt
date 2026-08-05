package com.reactnativekb

import android.content.Context
import java.io.File

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

    fun file(context: Context, filename: String): File = File(dir(context), filename)

    // Call off the main thread: this stats every file in the directory.
    fun purgeOld(context: Context) {
        val cutoff = System.currentTimeMillis() - MAX_AGE_MS
        // null means the listing itself failed, which is not the same as an empty
        // directory: the copies are still there, so say so rather than looking swept
        val files = dir(context).listFiles()
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
