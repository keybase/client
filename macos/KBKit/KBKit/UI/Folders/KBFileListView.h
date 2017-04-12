//
//  KBFolderListView.h
//  Keybase
//
//  Created by Gabriel on 3/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>


#import "KBFileLabel.h"

typedef NS_ENUM(NSInteger, KBFileColumnStyle) {
  KBFileColumnStyleName = 1,
  KBFileColumnStyleNameDate,
};

@interface KBFileListView : KBTableView

@property (nonatomic) KBImageLabelStyle imageLabelStyle;

- (void)setFileColumnStyle:(KBFileColumnStyle)fileColumnStyle;

@end
