//
//  KBPGPTextView.m
//  Keybase
//
//  Created by Gabriel on 5/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPTextView.h"
#import "KBAppDefines.h"
#import "KBFormatter.h"

@implementation KBPGPTextView

- (void)viewInit {
  [super viewInit];

  self.view.editable = YES;
  self.view.textContainerInset = CGSizeMake(10, 10);
  self.view.textColor = KBAppearance.currentAppearance.textColor;
  self.view.font = [KBAppearance.currentAppearance fontForStyle:KBTextStyleDefault options:KBTextOptionsMonospace];
  GHWeakSelf gself = self;
  self.onPaste = ^BOOL(KBTextView *textView) {
    NSPasteboard *pasteboard = [NSPasteboard generalPasteboard];
    NSString *str = [pasteboard stringForType:NSPasteboardTypeString];
    [gself setData:[str dataUsingEncoding:NSUTF8StringEncoding] armored:YES];
    return NO;
  };
}

- (void)setEditable:(BOOL)editable {
  self.view.editable = editable;
}

- (BOOL)isEditable {
  return self.view.editable;
}

- (void)setData:(NSData *)data armored:(BOOL)armored {
  _data = data;
  _armored = armored;
  if (armored) {
    [self setText:[[NSString alloc] initWithData:_data encoding:NSUTF8StringEncoding] style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
  } else {
    [self setText:KBHexString(_data, @"") style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
  }
}

@end
