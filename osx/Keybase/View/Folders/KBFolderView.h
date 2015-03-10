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
#import "KBFolder.h"

@interface KBFolderView : YONSView // NSTableCellView

- (void)setFolder:(KBFolder *)folder;

@end
