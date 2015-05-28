//
//  KBPGPTextView.m
//  Keybase
//
//  Created by Gabriel on 5/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPTextView.h"
#import "KBDefines.h"

@implementation KBPGPTextView

- (void)viewInit {
  [super viewInit];

  self.view.editable = YES;
  self.view.textContainerInset = CGSizeMake(10, 10);
  self.view.textColor = KBAppearance.currentAppearance.textColor;
  self.view.font = [KBAppearance.currentAppearance fontForStyle:KBTextStyleDefault options:KBTextOptionsMonospace];
  self.onPaste = ^BOOL(KBTextView *textView) {
    NSPasteboard *pasteboard = [NSPasteboard generalPasteboard];
    NSString *str = [pasteboard stringForType:NSPasteboardTypeString];
    [textView setText:str style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
    return NO;
  };
}

- (void)setEditable:(BOOL)editable {
  self.view.editable = editable;
}

- (BOOL)isEditable {
  return self.view.editable;
}

- (void)setArmoredText:(NSString *)armoredText {
  _armoredText = armoredText;
  _data = nil;
  [self setText:armoredText style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
}

- (void)setData:(NSData *)data {
  _data = data;
  [self setText:KBHexString(_data, @"") style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
}

@end
