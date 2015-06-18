//
//  KBColor.m
//  KBAppKit
//
//  Created by Gabriel on 6/12/15.
//  Copyright (c) 2015 KBAppKit. All rights reserved.
//

#import "KBColor.h"

#import <objc/runtime.h>

static void *KBBackgroundStyleKey;

@implementation NSColor (KBColor)

- (NSBackgroundStyle)backgroundStyle {
  id result = objc_getAssociatedObject(self, &KBBackgroundStyleKey);
  if (result) return [result integerValue];
  return NSBackgroundStyleLight; // Default (Maybe try to autodetect?)
}

- (void)setBackgroundStyle:(NSBackgroundStyle)backgroundStyle {
  objc_setAssociatedObject(self, &KBBackgroundStyleKey, @(backgroundStyle), OBJC_ASSOCIATION_RETAIN_NONATOMIC);
}

@end

NSColor *KBColorWithStyle(NSColor *color, NSBackgroundStyle backgroundStyle) {
  color.backgroundStyle = backgroundStyle;
  return color;
}

NSColor *KBColorFromRGBA(uint32_t rgb, CGFloat alpha, NSBackgroundStyle backgroundStyle) {
  NSColor *color = [NSColor colorWithRed:((float)((rgb & 0xFF0000) >> 16))/255.0 green:((float)((rgb & 0xFF00) >> 8))/255.0 blue:((float)(rgb & 0xFF))/255.0 alpha:alpha];
  color.backgroundStyle = backgroundStyle;
  return color;
}

