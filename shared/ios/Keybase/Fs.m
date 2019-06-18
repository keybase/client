//
//  Fs.m
//  Keybase
//
//  Created by Michael Maxim on 9/5/18.
//  Copyright © 2018 Keybase. All rights reserved.
//

#import "Fs.h"

@implementation FsHelper

- (BOOL)addSkipBackupAttributeToItemAtPath:(NSString *) filePathString
{
  NSURL * URL = [NSURL fileURLWithPath: filePathString];
  NSError * error = nil;
  BOOL success = [URL setResourceValue: @YES forKey: NSURLIsExcludedFromBackupKey error: &error];
  if(!success){
    NSLog(@"Error excluding %@ from backup %@", [URL lastPathComponent], error);
  }
  return success;
}

- (void) createBackgroundReadableDirectory:(NSString*) path setAllFiles:(BOOL)setAllFiles
{
  NSFileManager* fm = [NSFileManager defaultManager];
  NSError* error = nil;
  NSLog(@"creating background readable directory: path: %@ setAllFiles: %d", path, setAllFiles);
  // Setting NSFileProtectionCompleteUntilFirstUserAuthentication makes the directory accessible as long as the user has
  // unlocked the phone once. The files are still stored on the disk encrypted (note for the chat database, it
  // means we are encrypting it twice), and are inaccessible otherwise.
  NSDictionary* noProt = [NSDictionary dictionaryWithObject:NSFileProtectionCompleteUntilFirstUserAuthentication forKey:NSFileProtectionKey];
  [fm createDirectoryAtPath:path withIntermediateDirectories:YES
                 attributes:noProt
                      error:nil];
  if (![fm setAttributes:noProt ofItemAtPath:path error:&error]) {
    NSLog(@"Error setting file attributes on path: %@ error: %@", path, error);
  }
  if (!setAllFiles) {
    NSLog(@"setAllFiles is false, so returning now");
    return;
  } else {
    NSLog(@"setAllFiles is true charging forward");
  }

  // If the caller wants us to set everything in the directory, then let's do it now (one level down at least)
  NSArray<NSString*>* contents = [fm contentsOfDirectoryAtPath:path error:&error];
  if (contents == nil) {
    NSLog(@"Error listing directory contents: %@", error);
  } else {
    for (NSString* file in contents) {
      NSString* filePath = [NSString stringWithFormat:@"%@/%@", path, file];
      if (![fm setAttributes:noProt ofItemAtPath:filePath error:&error]) {
        NSLog(@"Error setting file attributes on file: %@ error: %@", file, error);
      }
    }
  }
}

- (BOOL) maybeMigrateDirectory:(NSString*)source dest:(NSString*)dest {
  NSError* error = nil;
  NSFileManager* fm = [NSFileManager defaultManager];

  // Always do this move in case it doesn't work on previous attempts.
  NSArray<NSString*>* sourceContents = [fm contentsOfDirectoryAtPath:source error:&error];
  if (nil == sourceContents) {
    NSLog(@"Error listing app contents directory: %@", error);
    return NO;
  } else {
    for (NSString* file in sourceContents) {
      BOOL isDirectory = NO;
      NSString* path = [NSString stringWithFormat:@"%@/%@", source, file];
      NSString* destPath = [NSString stringWithFormat:@"%@/%@", dest, file];
      if ([fm fileExistsAtPath:path isDirectory:&isDirectory] && isDirectory) {
        NSLog(@"skipping directory: %@", file);
        continue;
      }
      if (![fm moveItemAtPath:path toPath:destPath error:&error]) {
        if ([error code] == NSFileWriteFileExistsError) {
          // Just charge forward if the file is there already
          continue;
        }
        NSLog(@"Error moving file: %@ error: %@", file, error);
        return NO;
      }
    }
  }
  return YES;
}

- (NSString*) setupAppHome:(NSString*)home sharedHome:(NSString*)sharedHome {
  // Setup all directories
  NSString* appKeybasePath = [@"~/Library/Application Support/Keybase" stringByExpandingTildeInPath];
  NSString* appEraseableKVPath = [@"~/Library/Application Support/Keybase/eraseablekvstore/device-eks" stringByExpandingTildeInPath];
  [self createBackgroundReadableDirectory:appKeybasePath setAllFiles:YES];
  [self createBackgroundReadableDirectory:appEraseableKVPath setAllFiles:YES];
  [self addSkipBackupAttributeToItemAtPath:appKeybasePath];
  return home;
}

- (NSString*) setupSharedHome:(NSString*) home sharedHome:(NSString*)sharedHome {
  NSString* appKeybasePath = [@"~/Library/Application Support/Keybase" stringByExpandingTildeInPath];
  NSString* appEraseableKVPath = [@"~/Library/Application Support/Keybase/eraseablekvstore/device-eks" stringByExpandingTildeInPath];
  NSString* sharedKeybasePath = [NSString stringWithFormat:@"%@/Library/Application Support/Keybase", sharedHome];
  NSString* sharedEraseableKVPath =  [NSString stringWithFormat:@"%@/Library/Application Support/Keybase/eraseablekvstore/device-eks", sharedHome];
  [self createBackgroundReadableDirectory:sharedKeybasePath setAllFiles:YES];
  [self createBackgroundReadableDirectory:sharedEraseableKVPath setAllFiles:YES];
  [self addSkipBackupAttributeToItemAtPath:sharedKeybasePath];

  if (![self maybeMigrateDirectory:appKeybasePath dest:sharedKeybasePath]) {
    return home;
  }
  if (![self maybeMigrateDirectory:appEraseableKVPath dest:sharedEraseableKVPath]) {
    return home;
  }
  return sharedHome;
}

- (NSDictionary*) setupFs:(BOOL)skipLogFile setupSharedHome:(BOOL)setupSharedHome {
  NSString* home = NSHomeDirectory();
  NSURL* sharedURL = [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:@"group.keybase"];
  NSString* sharedHome = [sharedURL relativePath];
  home = [self setupAppHome:home sharedHome:sharedHome];
  if (setupSharedHome) {
    sharedHome = [self setupSharedHome:home sharedHome:sharedHome];
  }

  // Setup app level directories
  NSString* levelDBPath = [@"~/Library/Application Support/Keybase/keybase.leveldb" stringByExpandingTildeInPath];
  NSString* chatLevelDBPath = [@"~/Library/Application Support/Keybase/keybase.chat.leveldb" stringByExpandingTildeInPath];
  NSString* oldLogPath = [@"~/Library/Caches/Keybase" stringByExpandingTildeInPath];
  // Put logs in a subdir that is entirely background readable
  NSString* logPath = [oldLogPath stringByAppendingString:@"/logs"];
  NSString* serviceLogFile = skipLogFile ? @"" : [logPath stringByAppendingString:@"/ios.log"];

  if (!skipLogFile) {
      // cleanup old log files
      NSFileManager* fm = [NSFileManager defaultManager];
      NSArray<NSString*>* logs = @[@"/ios.log", @"/ios.log.ek"];
      for (NSString* file in logs) {
          NSString* oldPath = [oldLogPath stringByAppendingString:file];
          [fm removeItemAtPath:oldPath error:NULL];
      }
  }

  // Create LevelDB and log directories with a slightly lower data protection
  // mode so we can use them in the background
  [self createBackgroundReadableDirectory:chatLevelDBPath setAllFiles:YES];
  [self createBackgroundReadableDirectory:levelDBPath setAllFiles:YES];
  [self createBackgroundReadableDirectory:logPath setAllFiles:YES];

  return @{@"home": home,
           @"sharedHome": sharedHome,
           @"logFile": serviceLogFile
           };
}

@end

