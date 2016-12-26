import QtQuick 2.0

MyItem {
  property var aFunction: function(){}
  property var bFunction: function(h) {
    return 21;
  }
  cFunction: function (a,b, c) {
    a /= 2;
    return a - b + c;
  }
}
