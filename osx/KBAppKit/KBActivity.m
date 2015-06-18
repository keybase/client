//
//  KBActivity.m
//  Keybase
//
//  Created by Gabriel on 4/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBActivity.h"
#import "KBNavigationView.h"

@interface NSWindow (KBActivity)
- (void)setProgressEnabled:(BOOL)progressEnabled;
@end

@interface KBActivity (KBNavigationView)
@property (weak) KBNavigationView *navigation;
@end

@implementation KBActivity

+ (void)setProgressEnabled:(BOOL)progressEnabled sender:(id)sender {
  [self setProgressEnabled:progressEnabled sender:sender except:nil];
}

+ (void)setProgressEnabled:(BOOL)progressEnabled sender:(id)sender except:(NSArray *)except {
  if ([sender respondsToSelector:@selector(navigation)] && [sender navigation]) {
    [[sender navigation] setProgressEnabled:progressEnabled];
  } else if ([sender respondsToSelector:@selector(window)]) {
    NSWindow *window = [sender window];
    if ([window respondsToSelector:@selector(setProgressEnabled:)]) {
      [window setProgressEnabled:progressEnabled];
    }
  }

  [self setProgressEnabled:progressEnabled subviews:[sender subviews] except:except];
}

+ (void)setProgressEnabled:(BOOL)progressEnabled subviews:(NSArray *)subviews {
  [self setProgressEnabled:progressEnabled subviews:subviews except:nil];
}

+ (void)setProgressEnabled:(BOOL)progressEnabled subviews:(NSArray *)subviews except:(NSArray *)except {
  for (NSView *view in subviews) {
    if ([view isKindOfClass:NSControl.class] && ![except containsObject:view]) {
      ((NSControl *)view).enabled = !progressEnabled;
    } else {
      [self setProgressEnabled:progressEnabled subviews:view.subviews except:except];
    }
  }
}

+ (BOOL)setError:(NSError *)error sender:(id)sender {
  if ([sender respondsToSelector:@selector(navigation)] && [sender navigation]) {
    return [[sender navigation] setError:error sender:sender];
  } else {
    return [[NSApp delegate] setError:error sender:sender];
  }
}

@end
