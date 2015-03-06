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
#import "KBContentView.h"

@interface KBKeySelectView : KBContentView

@property KBGPGKeysView *keysView;
@property KBButton *selectButton;
@property KBButton *cancelButton;
//@property KBButton *pushCheckbox;

- (void)setGPGKeys:(NSArray *)GPGKeys completion:(MPRequestCompletion)completion;

@end
