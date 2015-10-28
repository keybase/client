//
//  KBAppToolbar.h
//  Keybase
//
//  Created by Gabriel on 4/22/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"
#import "KBAppDefines.h"

@class KBAppToolbar;

@protocol KBAppToolbarDelegate
- (void)appToolbar:(KBAppToolbar *)appToolbar didSelectItem:(KBAppViewItem)item;
@end


@interface KBAppToolbar : YOView

@property KBAppViewItem selectedItem;
@property (weak) id<KBAppToolbarDelegate> delegate;

- (void)setUser:(KBRUser *)user;

@end
