//
//  KBButton.h
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

typedef void (^KBButtonTargetBlock)();

@interface KBButton : NSButton

@property (nonatomic) NSString *text;
@property (nonatomic, copy) KBButtonTargetBlock targetBlock;

+ (KBButton *)buttonAsLinkWithText:(NSString *)text;

+ (KBButton *)buttonWithText:(NSString *)text;

@end

