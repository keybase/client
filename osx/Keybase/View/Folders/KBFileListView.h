//
//  KBFolderListView.h
//  Keybase
//
//  Created by Gabriel on 3/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBFileLabel.h"

typedef NS_ENUM(NSInteger, KBFileColumnStyle) {
  KBFileColumnStyleName = 1,
  KBFileColumnStyleNameDate,
};

@interface KBFileListView : KBTableView

@property (nonatomic) KBFileLabelStyle fileLabelStyle;

- (void)setFileColumnStyle:(KBFileColumnStyle)fileColumnStyle;

@end
