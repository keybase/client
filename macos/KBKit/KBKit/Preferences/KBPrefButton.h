//
//  KBPrefButton.h
//  Keybase
//
//  Created by Gabriel on 4/7/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBPreferences.h"
#import <YOLayout/YOLayout.h>

@interface KBPrefButton : YOView

@property CGFloat inset;

- (void)setCategory:(NSString *)category;

- (void)setButtonText:(NSString *)buttonText targetBlock:(dispatch_block_t)targetBlock;

@end
