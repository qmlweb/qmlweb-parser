import QtQuick 2.0

Item {
  width: 20
  height: 10

  NumberAnimation on x {
    from: 0; to: 10; duration: 50
    running: true
  }
}
