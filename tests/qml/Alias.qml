import QtQuick 2.0

Item {
  property alias childX: child.x
  property alias textFontPointSize: text.font.pointSize

  Item {
    id: child
    x: 125
  }

  Text {
    id: text
  }
}
