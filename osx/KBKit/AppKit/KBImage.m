//
//  KBImage.m
//  KBAppKit
//
//  Created by Gabriel on 6/12/15.
//  Copyright (c) 2015 KBAppKit. All rights reserved.
//

#import "KBImage.h"
#import <QuartzCore/QuartzCore.h>

@implementation NSImage (KBImage)

- (NSImage *)kb_imageTintedWithColor:(NSColor *)tint {
  if (!tint) return [self copy];

  CIFilter *colorGenerator = [CIFilter filterWithName:@"CIConstantColorGenerator"];
  CIColor *color = [[CIColor alloc] initWithColor:tint];

  [colorGenerator setValue:color forKey:kCIInputColorKey];

  CIFilter *colorFilter = [CIFilter filterWithName:@"CIColorControls"];

  [colorFilter setValue:[colorGenerator valueForKey:kCIOutputImageKey] forKey:kCIInputImageKey];
  [colorFilter setValue:[NSNumber numberWithFloat:3.0] forKey:kCIInputSaturationKey];
  [colorFilter setValue:[NSNumber numberWithFloat:0.35] forKey:kCIInputBrightnessKey];
  [colorFilter setValue:[NSNumber numberWithFloat:1.0] forKey:kCIInputContrastKey];

  CIFilter *monochromeFilter = [CIFilter filterWithName:@"CIColorMonochrome"];
  CIImage *baseImage = [CIImage imageWithData:[self TIFFRepresentation]];

  [monochromeFilter setValue:baseImage forKey:kCIInputImageKey];
  [monochromeFilter setValue:[CIColor colorWithRed:0.75 green:0.75 blue:0.75] forKey:kCIInputColorKey];
  [monochromeFilter setValue:[NSNumber numberWithFloat:1.0] forKey:kCIInputIntensityKey];

  CIFilter *compositingFilter = [CIFilter filterWithName:@"CIMultiplyCompositing"];

  [compositingFilter setValue:[colorFilter valueForKey:kCIOutputImageKey] forKey:kCIInputImageKey];
  [compositingFilter setValue:[monochromeFilter valueForKey:kCIOutputImageKey] forKey:kCIInputBackgroundImageKey];

  CIImage *outputImage = [compositingFilter valueForKey:kCIOutputImageKey];

  CGRect extend = [outputImage extent];
  CGSize size = self.size;
  NSImage *tintedImage = [[NSImage alloc] initWithSize: size];

  [tintedImage lockFocus];
  {
    CGContextRef contextRef = [[NSGraphicsContext currentContext] graphicsPort];
    CIContext *ciContext = [CIContext contextWithCGContext:contextRef options:[NSDictionary dictionaryWithObject:[NSNumber numberWithBool:YES] forKey:kCIContextUseSoftwareRenderer]];
    CGRect rect = CGRectMake(0, 0, size.width, size.height);
    [ciContext drawImage:outputImage inRect:rect fromRect:extend];
  }
  [tintedImage unlockFocus];
  
  return tintedImage;
}

@end
