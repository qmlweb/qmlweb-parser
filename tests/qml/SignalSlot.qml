import QtQuick 2.0

Item {
  signal simpleSignal;
  signal signalWithParams(string someParam)

  onSimpleSignal: {
    console.log('foo');
  }

  onSignalWithParams: {
    console.log('foo' + someParam);
  }
}
