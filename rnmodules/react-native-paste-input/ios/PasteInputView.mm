#ifdef RCT_NEW_ARCH_ENABLED
#import "PasteInputView.h"

#import <react/renderer/components/RNPasteInputViewSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNPasteInputViewSpec/EventEmitters.h>
#import <react/renderer/components/RNPasteInputViewSpec/Props.h>
#import <react/renderer/components/RNPasteInputViewSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"
#import "Utils.h"

using namespace facebook::react;

@interface PasteInputView () <RCTPasteInputViewViewProtocol>

@end

@implementation PasteInputView {
    UIView * _view;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<PasteInputViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const PasteInputViewProps>();
    _props = defaultProps;

    _view = [[UIView alloc] init];

    self.contentView = _view;
  }

  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
    const auto &oldViewProps = *std::static_pointer_cast<PasteInputViewProps const>(_props);
    const auto &newViewProps = *std::static_pointer_cast<PasteInputViewProps const>(props);

    if (oldViewProps.color != newViewProps.color) {
        NSString * colorToConvert = [[NSString alloc] initWithUTF8String: newViewProps.color.c_str()];
        [_view setBackgroundColor: [Utils hexStringToColor:colorToConvert]];
    }

    [super updateProps:props oldProps:oldProps];
}

Class<RCTComponentViewProtocol> PasteInputViewCls(void)
{
    return PasteInputView.class;
}

@end
#endif
