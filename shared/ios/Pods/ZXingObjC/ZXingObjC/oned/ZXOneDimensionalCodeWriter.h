/*
 * Copyright 2012 ZXing authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#import "ZXWriter.h"

@class ZXBoolArray;

/**
 * Encapsulates functionality and implementation that is common to one-dimensional barcodes.
 */
@interface ZXOneDimensionalCodeWriter : NSObject <ZXWriter>

- (ZXBoolArray *)encode:(NSString *)contents;
- (BOOL)isNumeric:(NSString *)contents;
- (int)appendPattern:(ZXBoolArray *)target pos:(int)pos pattern:(const int[])pattern patternLen:(int)patternLen startColor:(BOOL)startColor;
- (int)defaultMargin;

@end
