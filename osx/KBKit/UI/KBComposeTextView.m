//
//  KBComposeTextView.m
//  Keybase
//
//  Created by Gabriel on 6/11/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBComposeTextView.h"

#import "KBFormatter.h"

@implementation KBComposeTextView

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
    [gself setData:[str dataUsingEncoding:NSUTF8StringEncoding]];
    return NO;
  };
}

- (void)setData:(NSData *)data {
  _data = data;
  [self setText:[[NSString alloc] initWithData:_data encoding:NSUTF8StringEncoding] style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
}

@end
