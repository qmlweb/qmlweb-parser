import QtQuick 2.0

Item {
  signal simpleSignal;
  signal signalWithParams(string someParam)
  signal anotherSignal(string someParam, int param2);
}
