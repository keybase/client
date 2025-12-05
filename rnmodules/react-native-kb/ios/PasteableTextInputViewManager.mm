#import "PasteableTextInputViewManager.h"
#import "PasteableTextInputView.h"
#import <React/RCTUIManager.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <React/RCTViewComponentView.h>
#import <RNKbSpec/RNKbSpec.h>
#import <react/renderer/components/RNKbSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNKbSpec/EventEmitters.h>
#import <react/renderer/components/RNKbSpec/Props.h>
#import <react/renderer/components/RNKbSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

@interface PasteableTextInputViewManager () <RCTPasteableTextInputViewProtocol>
@end
#endif

@implementation PasteableTextInputViewManager

RCT_EXPORT_MODULE(PasteableTextInput)

#ifdef RCT_NEW_ARCH_ENABLED
- (UIView *)view {
  return [[PasteableTextInputView alloc] init];
}
#else
- (UIView *)view {
  return [[PasteableTextInputView alloc] init];
}

RCT_EXPORT_VIEW_PROPERTY(onPasteImage, RCTDirectEventBlock)
#endif

@end

