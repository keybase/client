//
//  KBStrengthLabel.m
//  Keybase
//
//  Created by Gabriel on 2/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBStrengthLabel.h"

//#import <ZXCVBN/BBPasswordStrength.h>

@implementation KBStrengthLabel

- (NSString *)scoreLabelForScore:(NSInteger)score length:(NSInteger)length {
  if (score == 0) {
    return @"Very Weak";
  } else if (score == 1) {
    return @"Weak";
  } else if (score == 2) {
    return @"Meh";
  } else if (score == 3) {
    if (length < 12) {
      return @"Almost";
    } else {
      return @"Good";
    }
  } else if (score == 4) {
    if (length < 12) {
      return @"Almost";
    } else {
      return @"Great!";
    }
  }
  return @"Unknown";
}

- (void)setPassword:(NSString *)password {
  if (!password) {
    self.attributedText = nil;
    return;
  }

  /*
  BBPasswordStrength *strength = [[BBPasswordStrength alloc] initWithPassword:password];

  NSUInteger score = [strength score];
  NSColor *color = KBColorFromRGBA(0x333333, 1.0, NSBackgroundStyleLight);
  if (score == 0) {
    color = [NSColor colorWithRed:200.0/255.0 green:24.0/255.0 blue:24.0/255.0 alpha:1.0];
  } else if (score == 1) {
    color = [NSColor colorWithRed:200.0/255.0 green:24.0/255.0 blue:24.0/255.0 alpha:1.0];
  } else if (score == 2) {
    color = [NSColor colorWithRed:226.0/255.0 green:143.0/255.0 blue:0/255.0 alpha:1.0];
  } else if (score == 3) {
    color = [NSColor colorWithRed:138.0/255.0 green:160.0/255.0 blue:80.0/255.0 alpha:1.0];
  } else if (score == 4) {
    color = [NSColor colorWithRed:39.0/255.0 green:179.0/255.0 blue:15.0/255.0 alpha:1.0];
  }

  NSString *text = ([password length] > 0 ? [self scoreLabelForScore:strength.score length:password.length] : @"");

  [self setText:text font:[NSFont systemFontOfSize:12] color:color alignment:NSRightTextAlignment lineBreakMode:NSLineBreakByClipping];
   */
}

@end
