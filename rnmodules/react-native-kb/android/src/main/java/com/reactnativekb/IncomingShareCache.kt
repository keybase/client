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

    // Each item gets its own directory so two items with the same name, in one
    // share or in overlapping ones, never overwrite each other's copy. name must
    // be a single path component (see IncomingShareFileName). share, when given,
    // tags the directory with the share it belongs to (see discardShare).
    fun newItemFile(context: Context, name: String, share: String? = null): File {
        val uuid = UUID.randomUUID().toString()
        val itemDir = File(dir(context), if (share == null) uuid else "$share-$uuid")
        if (!itemDir.mkdirs()) {
            throw IOException("unable to create ${itemDir.path}")
        }
        return File(itemDir, name)
    }

    // Copies input into a new item file named name. On any failure nothing is
    // left behind.
    fun copyIn(context: Context, input: InputStream, name: String, share: String? = null): File {
        val file = newItemFile(context, name, share)
        try {
            FileOutputStream(file).use { output -> input.copyTo(output, 64 * 1024) }
        } catch (e: Exception) {
            discardItem(context, file)
            throw e
        }
        return file
    }

    // Removes every copy made for share, finished or cut off: a copy the process
    // was killed in the middle of is left as it was.
    fun discardShare(context: Context, share: String) = discardShare(dir(context), share)

    fun discardShare(dir: File, share: String) {
        dir.listFiles()?.filter { it.name.startsWith("$share-") }?.forEach { it.deleteRecursively() }
    }

    // Removes a copy made by newItemFile, along with its directory.
    fun discardItem(context: Context, file: File) {
        val itemDir = file.parentFile ?: return
        if (itemDir.parentFile == dir(context)) {
            itemDir.deleteRecursively()
        }
    }

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
