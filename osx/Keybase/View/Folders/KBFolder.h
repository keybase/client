//
//  KBFolder.h
//  Keybase
//
//  Created by Gabriel on 3/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef NS_ENUM (NSInteger, KBFolderType) {
  KBFolderTypeDefault,
  KBFolderTypeOther
};

@interface KBFolder : NSObject

@property NSString *name;
@property KBFolderType folderType;
@property NSDate *dateModified;

+ (instancetype)folderWithName:(NSString *)name dateModified:(NSDate *)dateModified;

@end
