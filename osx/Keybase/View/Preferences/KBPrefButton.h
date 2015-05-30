//
//  KBPrefButton.h
//  Keybase
//
//  Created by Gabriel on 4/7/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppDefines.h"
#import "KBPreferences.h"

@interface KBPrefButton : YOView

@property CGFloat inset;

- (void)setCategory:(NSString *)category;

- (void)setButtonText:(NSString *)buttonText targetBlock:(dispatch_block_t)targetBlock;

@end
