import QtQuick 2.5

Rectangle {
  width: 75
  height: 15
  color: 'green'
  border.width: 2

  property int number: 10
  property var foo: {}
  property var bar: []
  property Item item: Item {}
}
