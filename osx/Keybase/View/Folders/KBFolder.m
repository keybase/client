//
//  KBFolder.m
//  Keybase
//
//  Created by Gabriel on 3/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFolder.h"

@implementation KBFolder

+ (instancetype)folderWithName:(NSString *)name dateModified:(NSDate *)dateModified {
  KBFolder *folder = [[KBFolder alloc] init];
  folder.name = name;
  folder.dateModified = dateModified;
  return folder;
}

NSImage *KBImageForFolder(KBFolder *folder) {
  return [[NSWorkspace sharedWorkspace] iconForFileType:NSFileTypeForHFSTypeCode(kGenericFolderIcon)];
}

@end
