//
//  KBKeySelectView.h
//  Keybase
//
//  Created by Gabriel on 1/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBRPC.h"
#import "KBGPGKeysView.h"

@interface KBKeySelectView : YONSView

@property KBGPGKeysView *keysView;
@property KBButton *selectButton;
@property KBButton *cancelButton;
@property KBButton *pushCheckbox;

@end
