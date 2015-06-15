//
//  KBFile.m
//  Keybase
//
//  Created by Gabriel on 3/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFile.h"
#import "KBAlert.h"
#import <ObjectiveSugar/ObjectiveSugar.h>

@implementation KBFile

+ (instancetype)fileWithPath:(NSString *)path {
  KBFile *file = [[KBFile alloc] init];
  file.name = [path lastPathComponent];
  file.path = path;
  //file.dateModified = dateModified;
  return file;
}

+ (instancetype)fileWithURL:(NSURL *)URL {
  if ([URL isFileURL]) {
    return [self fileWithPath:URL.path];
  } else {
    NSAssert(NO, @"TODO");
    return nil;
  }
}

+ (instancetype)folderWithName:(NSString *)name dateModified:(NSDate *)dateModified {
  KBFile *folder = [[KBFile alloc] init];
  folder.name = name;
  folder.fileType = KBFileTypeFolder;
  folder.dateModified = dateModified;
  return folder;
}

+ (instancetype)fileFromExtensionItem:(NSExtensionItem *)extensionItem {
  KBFile *file = [[KBFile alloc] init];
  NSAssert(NO, @"TODO");
  return file;
}

NSImage *KBImageForFile(KBFile *file) {
  if (file.fileType == KBFileTypeFolder) {
    return [[NSWorkspace sharedWorkspace] iconForFileType:NSFileTypeForHFSTypeCode(kGenericFolderIcon)];
  } else {
    return [[NSWorkspace sharedWorkspace] iconForFile:file.path ? file.path : file.name];
  }
}

- (NSImage *)icon {
  if (!_icon) _icon = KBImageForFile(self);
  return _icon;
}

+ (void)promptOverwrite:(NSString *)path view:(NSView *)view completion:(void (^)(KBFileResponse response))completion {
  NSString *title = NSStringWithFormat(@"Overwrite %@", [path lastPathComponent]);
  NSString *description = NSStringWithFormat(@"Do you want to overwrite %@", path);
  [KBAlert promptWithTitle:title description:description style:NSInformationalAlertStyle buttonTitles:@[@"Cancel", @"Skip", @"Overwrite", @"Overwrite All"] view:view completion:^(NSModalResponse returnCode) {
    if (returnCode == NSAlertFirstButtonReturn) {
      completion(KBFileResponseCancel);
    } else if (returnCode == NSAlertFirstButtonReturn + 1) {
      completion(KBFileResponseSkip);
    } else if (returnCode == NSAlertFirstButtonReturn + 2) {
      completion(KBFileResponseOverwrite);
    } else if (returnCode == NSAlertFirstButtonReturn + 3) {
      completion(KBFileResponseOverwriteAll);
    }
    
   }];
}

@end
