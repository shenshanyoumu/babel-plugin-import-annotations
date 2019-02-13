// 断言库
import assert from 'assert';
import Plugin from './Plugin';

/**
 *
 * @param {*} {types}，其中types是Babel对JS文件解析后生成的AST节点类型。所有Babel插件就是针对AST特定节点进行处理
 */
export default function({ types }) {
  // Babel-plugin-import可以针对多个外部模块进行按需加载，因此需要设置插件实例列表
  let plugins = null;

  // Only for test
  global.__clearBabelAntdPlugin = () => {
    plugins = null;
  };

  //Babel插件，其实就是返回visitor属性的对象；在visitor属性对象中具有一系列方法，这些方法针对不同的AST节点进行操作
  function applyInstance(method, args, context) {
    for (const plugin of plugins) {
      if (plugin[method]) {
        plugin[method].apply(plugin, [...args, context]);
      }
    }
  }

  // 几乎所有Babel插件针对AST节点类型，都应该包含enter、exit钩子函数。当然是否需要处理当前AST节点，需要根据插件定义的节点类型处理能力而定
  const Program = {
    // Babel插件在访问AST第一个节点时，需要根据Babel配置中插件的选项属性来初始化插件实例；而后在访问其他AST节点时直接使用该插件实例即可
    enter(path, { opts = {} }) {
      if (!plugins) {
        if (Array.isArray(opts)) {
          plugins = opts.map((
            // 下面配置在Babel配置文件按需设置
            {
              libraryName, //引入的外部模块名称，比如antd
              libraryDirectory, //外部模块打包后暴露的文件夹，默认为lib文件夹
              style, //是直接引入经过编译后的外部模块的样式文件，还是引入外部模块的原生样式文件
              camel2DashComponentName, //是否将引入的组件名称转换为"-"分割的文件路径
              camel2UnderlineComponentName, //是否将引入的组件名转为"_"分割的文件路径
              fileName, //自定义文件名
              customName, //自定义引入的组件路径名
              transformToDefaultImport //如果外部模块没有export default，则设置为false
            },
            index
          ) => {
            assert(libraryName, 'libraryName should be provided');
            return new Plugin(
              libraryName,
              libraryDirectory,
              style,
              camel2DashComponentName,
              camel2UnderlineComponentName,
              fileName,
              customName,
              transformToDefaultImport,
              types,
              index
            );
          });
        } else {
          // Babel-plugin-import插件在Babel配置文件中，既可以专注于特定的某个外部模块进行按需加载，因此配置选项为对象；也可以针对多个外部模块按需加载，因此配置选项为数组
          assert(opts.libraryName, 'libraryName should be provided');
          plugins = [
            new Plugin(
              opts.libraryName,
              opts.libraryDirectory,
              opts.style,
              opts.camel2DashComponentName,
              opts.camel2UnderlineComponentName,
              opts.fileName,
              opts.customName,
              opts.transformToDefaultImport,
              types
            )
          ];
        }
      }

      //插件实例开始处理AST节点的钩子函数
      applyInstance('ProgramEnter', arguments, this); // eslint-disable-line
    },
    exit() {
      // 插件实例结束处理AST节点的钩子函数
      applyInstance('ProgramExit', arguments, this); // eslint-disable-line
    }
  };

  // Babel-plugin-import插件只需要处理下面这些AST节点类型即可，注意Babel定义了大量的AST节点类型
  const methods = [
    'ImportDeclaration',
    'CallExpression',
    'MemberExpression',
    'Property',
    'VariableDeclarator',
    'ArrayExpression',
    'LogicalExpression',
    'ConditionalExpression',
    'IfStatement',
    'ExpressionStatement',
    'ReturnStatement',
    'ExportDefaultDeclaration',
    'BinaryExpression',
    'NewExpression'
  ];

  //下面就是Babel插件的典型形式，即具有visitor属性的对象
  const ret = {
    visitor: { Program }
  };

  // 针对AST特定节点进行处理
  for (const method of methods) {
    ret.visitor[method] = function() {
      // eslint-disable-line
      applyInstance(method, arguments, ret.visitor); // eslint-disable-line
    };
  }

  // 返回插件
  return ret;
}
