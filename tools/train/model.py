"""GlyphNet: tiny CNN for 28x28 handwritten characters. The TS inference in src/recog/cnn.ts mirrors this."""
import torch.nn as nn


def conv_bn(cin, cout):
    return [nn.Conv2d(cin, cout, 3, padding=1, bias=False), nn.BatchNorm2d(cout), nn.ReLU(inplace=True)]


class GlyphNet(nn.Module):
    def __init__(self, num_classes: int, width: float = 1.0):
        super().__init__()
        c1, c2, c3 = int(16 * width), int(32 * width), int(64 * width)
        self.features = nn.Sequential(
            *conv_bn(1, c1), *conv_bn(c1, c1), nn.MaxPool2d(2),  # 14x14
            *conv_bn(c1, c2), *conv_bn(c2, c2), nn.MaxPool2d(2),  # 7x7
            *conv_bn(c2, c3), nn.MaxPool2d(2),  # 3x3
        )
        self.head = nn.Sequential(nn.Flatten(), nn.Dropout(0.3), nn.Linear(c3 * 9, num_classes))
        self.width = width

    def forward(self, x):
        return self.head(self.features(x))
