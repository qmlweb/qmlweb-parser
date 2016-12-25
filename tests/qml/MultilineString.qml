import QtQuick 2.0

Item {
  property string foo: "foo\""
  property string bar: "foo
                        hello
                        world
                       "
  property string test: '
  \'
  '
}
