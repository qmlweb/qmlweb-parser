import QtQuick 2.5

Rectangle {
  width: 75
  height: 15
  color: 'green'

  Rectangle {
    width: 10
    height: 10
  }
  Item {
    Rectangle {
      height: 20
      width: 20
    }
  }
  Item {
    width: 10
    height: 12
    x: 30
    border.width: 2
  }
}
