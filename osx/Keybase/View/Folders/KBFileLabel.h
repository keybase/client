//
//  KBFolderView.h
//  Keybase
//
//  Created by Gabriel on 3/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBRPC.h"
#import "KBFile.h"

typedef NS_ENUM (NSInteger, KBFileLabelStyle) {
  KBFileLabelStyleDefault,
  KBFileLabelStyleLarge,
};


@interface KBFileLabel : YOView

@property KBFileLabelStyle fileLabelStyle;

- (void)setFile:(KBFile *)file;

+ (NSFont *)fontForStyle:(KBFileLabelStyle)fileLabelStyle;

@end
