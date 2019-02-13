# babel-plugin-import

在 Babel 配置中引入该插件，可以针对 [antd](https://github.com/ant-design/ant-design), [antd-mobile](https://github.com/ant-design/ant-design-mobile), lodash, [material-ui](http://material-ui.com/)等库进行按需加载.

[![NPM version](https://img.shields.io/npm/v/babel-plugin-import.svg?style=flat)](https://npmjs.org/package/babel-plugin-import)
[![Build Status](https://img.shields.io/travis/ant-design/babel-plugin-import.svg?style=flat)](https://travis-ci.org/ant-design/babel-plugin-import)

---

## 为什么需要 babel-plugin-import

- [English Instruction](https://ant.design/docs/react/getting-started#Import-on-Demand)
- [中文说明](https://ant.design/docs/react/getting-started-cn#%E6%8C%89%E9%9C%80%E5%8A%A0%E8%BD%BD)

## 如何在项目中添加 babel-plugin-import

- [babelrc](https://babeljs.io/docs/usage/babelrc/)
- [babel-loader](https://github.com/babel/babel-loader)

## 例子

#### `{ "libraryName": "antd" }`

```javascript
import { Button } from 'antd';
ReactDOM.render(<Button>xxxx</Button>);

      ↓ ↓ ↓ ↓ ↓ ↓

var _button = require('antd/lib/button');
ReactDOM.render(<_button>xxxx</_button>);
```

#### `{ "libraryName": "antd", style: "css" }`

```javascript
import { Button } from 'antd';
ReactDOM.render(<Button>xxxx</Button>);

      ↓ ↓ ↓ ↓ ↓ ↓

var _button = require('antd/lib/button');
require('antd/lib/button/style/css');
ReactDOM.render(<_button>xxxx</_button>);
```

#### `{ "libraryName": "antd", style: true }`

```javascript
import { Button } from 'antd';
ReactDOM.render(<Button>xxxx</Button>);

      ↓ ↓ ↓ ↓ ↓ ↓

var _button = require('antd/lib/button');
require('antd/lib/button/style');
ReactDOM.render(<_button>xxxx</_button>);
```

备注 : 配置 `style: true` 则在项目编译阶段，可以对引入的 antd 样式文件进行编译，从而可以压缩打包尺寸；而配置`style: "css"`, 则直接引入经过打包后的 antd 样式文件

## 使用方式

```bash
npm install babel-plugin-import --save-dev
```

通过 `.babelrc` 配置文件或者 babel-loader 模块编程引入.

```js
{
  "plugins": [["import", options]]
}
```

### options

`options` can be object.

```javascript
{
  "libraryName": "antd",
  "style": true,   // or 'css'
}
```

```javascript
{
  "libraryName": "lodash",
  "libraryDirectory": "", //表示从库的package.json的main入口；否则默认为lib文件夹
  "camel2DashComponentName": false,  // default: true，将引入的组件名转化为"-"连接的文件名
}
```

```javascript
{
  "libraryName": "@material-ui/core",
  "libraryDirectory": "components",  // default: lib
  "camel2DashComponentName": false,  // default: true
}
```

~`options` can be an array.~ It's not available in babel@7+

For Example:

```javascript
[
  {
    libraryName: 'antd',
    libraryDirectory: 'lib', // default: lib
    style: true
  },
  {
    libraryName: 'antd-mobile'
  }
];
```

`Options` can't be an array in babel@7+, but you can add plugins with name to support multiple dependencies.

For Example:

```javascrit
// .babelrc
"plugins": [
  ["import", { "libraryName": "antd", "libraryDirectory": "lib"}, "ant"],
  ["import", { "libraryName": "antd-mobile", "libraryDirectory": "lib"}, "antd-mobile"]
]
```

#### style

- `["import", { "libraryName": "antd" }]`: import js modularly
- `["import", { "libraryName": "antd", "style": true }]`: import js and css modularly (LESS/Sass source files)
- `["import", { "libraryName": "antd", "style": "css" }]`: import js and css modularly (css built files)

If option style is a `Function`, `babel-plugin-import` will auto import the file which filepath equal to the function return value. This is useful for the components library developers.

e.g.

- `` ["import", { "libraryName": "antd", "style": (name) => `${name}/style/2x` }] ``: import js and css modularly & css file path is `ComponentName/style/2x`

If a component has no style, you can use the `style` function to return a `false` and the style will be ignored.

e.g.

```js
[
  'import',
  {
    libraryName: 'antd',
    style: (name: string, file: Object) => {
      if (name === 'antd/lib/utils') {
        return false;
      }
      return `${name}/style/2x`;
    }
  }
];
```

#### customName

使用 `customName` 来自定义导入文件路径.

插件默认导入文件的基础路径为 lib 目录，并且默认将引入的组件名转换为按照"-"连接的结构:

```typescript
import { TimePicker } from "antd"
↓ ↓ ↓ ↓ ↓ ↓
var _button = require('antd/lib/time-picker');
```

设置 `camel2DashComponentName` 为 `false`来阻止组件名称的转换:

```typescript
import { TimePicker } from "antd"
↓ ↓ ↓ ↓ ↓ ↓
var _button = require('antd/lib/TimePicker');
```

在 Babel 配置文件中，使用 `customName` 来自定义导入组件路径:

```js
[
  'import',
  {
    libraryName: 'antd',
    customName: (name: string) => {
      if (name === 'TimePicker') {
        return 'antd/lib/custom-time-picker';
      }
      return `antd/lib/${name}`;
    }
  }
];
```

上面编译后的结果为:

```typescript
import { TimePicker } from "antd"
↓ ↓ ↓ ↓ ↓ ↓
var _button = require('antd/lib/custom-time-picker');
```

#### transformToDefaultImport

如果打包后的模块没有`default`导出，则设置 `false`

### 备注

babel-plugin-import will not work properly if you add the library to the webpack config [vendor](https://webpack.github.io/docs/code-splitting.html#split-app-and-vendor-code).
