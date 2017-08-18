//
//  KeyListener.m
//  Keybase
//
//  Created by Chris Nojima on 9/28/16.
//  Copyright © 2017 Keybase. All rights reserved.
//

#import "KeyListener.h"
#import "RCTEventDispatcher.h"

@implementation KeyListener 

- (BOOL)canBecomeFirstResponder {
  return YES;
}

- (NSArray *)keyCommands {
  return @[
           [UIKeyCommand keyCommandWithInput:@"[" modifierFlags:UIKeyModifierCommand action:@selector(goBackInTime:)],
           [UIKeyCommand keyCommandWithInput:@"]" modifierFlags:UIKeyModifierCommand action:@selector(goForwardInTime:)],
           [UIKeyCommand keyCommandWithInput:@"s" modifierFlags:UIKeyModifierCommand|UIKeyModifierShift action:@selector(saveState:)],
           [UIKeyCommand keyCommandWithInput:@"c" modifierFlags:UIKeyModifierCommand|UIKeyModifierShift action:@selector(clearState:)]
           ];
}

- (void)goBackInTime:(UIKeyCommand *)sender {
  [self.bridge.eventDispatcher sendAppEventWithName:@"backInTime"
                                               body:@true];
}
- (void)goForwardInTime:(UIKeyCommand *)sender {
  [self.bridge.eventDispatcher sendAppEventWithName:@"forwardInTime"
                                               body:@true];
}
- (void)saveState:(UIKeyCommand *)sender {
  [self.bridge.eventDispatcher sendAppEventWithName:@"saveState"
                                               body:@true];
}
- (void)clearState:(UIKeyCommand *)sender {
  [self.bridge.eventDispatcher sendAppEventWithName:@"clearState"
                                               body:@true];
}



@end
