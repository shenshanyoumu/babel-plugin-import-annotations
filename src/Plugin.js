// node的path模块，用于路径拼接
import { join } from 'path';

// ES6 import时的辅助函数
import {
  addSideEffect,
  addDefault,
  addNamed
} from '@babel/helper-module-imports';

// 将类似TimerComponent字符串转换为timer-component形式，主要用于将组件引用转换为对应文件夹的引入
function camel2Dash(_str) {
  const str = _str[0].toLowerCase() + _str.substr(1);
  return str.replace(/([A-Z])/g, $1 => `-${$1.toLowerCase()}`);
}

// 将类似TimerComponent字符串转化为timer_component形式
function camel2Underline(_str) {
  const str = _str[0].toLowerCase() + _str.substr(1);
  return str.replace(/([A-Z])/g, $1 => `_${$1.toLowerCase()}`);
}

// Windows系统上，对文件路径分隔符的替换
function winPath(path) {
  return path.replace(/\\/g, '/');
}

export default class Plugin {
  constructor(
    libraryName,
    libraryDirectory,
    style,
    camel2DashComponentName,
    camel2UnderlineComponentName,
    fileName,
    customName,
    transformToDefaultImport,
    types,
    index = 0
  ) {
    this.libraryName = libraryName;

    // 默认为外部模块的lib文件夹进行按需加载转换
    this.libraryDirectory =
      typeof libraryDirectory === 'undefined' ? 'lib' : libraryDirectory;
    this.camel2DashComponentName =
      typeof camel2DashComponentName === 'undefined'
        ? true
        : camel2DashComponentName;
    this.camel2UnderlineComponentName = camel2UnderlineComponentName;
    this.style = style || false;
    this.fileName = fileName || '';
    this.customName = customName;
    this.transformToDefaultImport =
      typeof transformToDefaultImport === 'undefined'
        ? true
        : transformToDefaultImport;

    // types表示Babel内置的AST节点类型
    this.types = types;

    //针对多个babel-plugin-import插件实例对象设置
    this.pluginStateKey = `importPluginState${index}`;
  }

  //
  getPluginState(state) {
    if (!state[this.pluginStateKey]) {
      state[this.pluginStateKey] = {}; // eslint-disable-line
    }
    return state[this.pluginStateKey];
  }

  isInGlobalScope(path, name, pluginState) {
    const parentPath = path.findParent(_path =>
      _path.scope.hasOwnBinding(pluginState.specified[name])
    );
    return !!parentPath && parentPath.isProgram();
  }

  /**
   * import插件的辅助函数
   * @param {*} methodName 处理该节点类型的函数名
   * @param {*} file 导入的文件对象
   * @param {*} pluginState 当前处理该节点类型的插件实例对象状态
   */
  importMethod(methodName, file, pluginState) {
    if (!pluginState.selectedMethods[methodName]) {
      const libraryDirectory = this.libraryDirectory;
      const style = this.style;
      const transformedMethodName = this.camel2UnderlineComponentName // eslint-disable-line
        ? camel2Underline(methodName)
        : this.camel2DashComponentName
        ? camel2Dash(methodName)
        : methodName;
      const path = winPath(
        this.customName
          ? this.customName(transformedMethodName)
          : join(
              this.libraryName,
              libraryDirectory,
              transformedMethodName,
              this.fileName
            ) // eslint-disable-line
      );
      pluginState.selectedMethods[methodName] = this.transformToDefaultImport // eslint-disable-line
        ? addDefault(file.path, path, { nameHint: methodName })
        : addNamed(file.path, methodName, path);
      if (style === true) {
        addSideEffect(file.path, `${path}/style`);
      } else if (style === 'css') {
        addSideEffect(file.path, `${path}/style/css`);
      } else if (typeof style === 'function') {
        const stylePath = style(path, file);
        if (stylePath) {
          addSideEffect(file.path, stylePath);
        }
      }
    }
    return Object.assign({}, pluginState.selectedMethods[methodName]);
  }

  /**
   * import插件的辅助函数
   * @param {*} node
   * @param {*} props
   * @param {*} path
   * @param {*} state
   */
  buildExpressionHandler(node, props, path, state) {
    const file = (path && path.hub && path.hub.file) || (state && state.file);
    const types = this.types;
    const pluginState = this.getPluginState(state);
    props.forEach(prop => {
      if (!types.isIdentifier(node[prop])) return;
      if (pluginState.specified[node[prop].name]) {
        node[prop] = this.importMethod(
          pluginState.specified[node[prop].name],
          file,
          pluginState
        ); // eslint-disable-line
      }
    });
  }

  /**
   * import插件的辅助函数
   * @param {*} node
   * @param {*} prop
   * @param {*} path
   * @param {*} state
   */
  buildDeclaratorHandler(node, prop, path, state) {
    const file = (path && path.hub && path.hub.file) || (state && state.file);
    const types = this.types;
    const pluginState = this.getPluginState(state);
    if (!types.isIdentifier(node[prop])) return;
    if (
      pluginState.specified[node[prop].name] &&
      path.scope.hasBinding(node[prop].name) &&
      path.scope.getBinding(node[prop].name).path.type === 'ImportSpecifier'
    ) {
      node[prop] = this.importMethod(node[prop].name, file, pluginState); // eslint-disable-line
    }
  }

  // 进入特定AST节点的钩子函数
  ProgramEnter(path, state) {
    const pluginState = this.getPluginState(state);
    pluginState.specified = Object.create(null);
    pluginState.libraryObjs = Object.create(null);
    pluginState.selectedMethods = Object.create(null);
    pluginState.pathsToRemove = [];
  }

  // 离开特定AST节点的钩子函数
  ProgramExit(path, state) {
    this.getPluginState(state).pathsToRemove.forEach(
      p => !p.removed && p.remove()
    );
  }

  // 处理AST中ImportDeclaration节点的函数，这就是import插件的能力所在。参数path和state由Babel编译器注入
  ImportDeclaration(path, state) {
    const { node } = path;

    // path maybe removed by prev instances.
    if (!node) return;

    const { value } = node.source;
    const libraryName = this.libraryName;
    const types = this.types;
    const pluginState = this.getPluginState(state);
    if (value === libraryName) {
      node.specifiers.forEach(spec => {
        if (types.isImportSpecifier(spec)) {
          pluginState.specified[spec.local.name] = spec.imported.name;
        } else {
          pluginState.libraryObjs[spec.local.name] = true;
        }
      });
      pluginState.pathsToRemove.push(path);
    }
  }

  // 处理AST中CallExpression节点的函数，这就是import插件的能力所在。参数path和state由Babel编译器注入
  CallExpression(path, state) {
    const { node } = path;
    const file = (path && path.hub && path.hub.file) || (state && state.file);
    const { name } = node.callee;
    const types = this.types;
    const pluginState = this.getPluginState(state);

    if (types.isIdentifier(node.callee)) {
      if (pluginState.specified[name]) {
        node.callee = this.importMethod(
          pluginState.specified[name],
          file,
          pluginState
        );
      }
    }

    node.arguments = node.arguments.map(arg => {
      const { name: argName } = arg;
      if (
        pluginState.specified[argName] &&
        path.scope.hasBinding(argName) &&
        path.scope.getBinding(argName).path.type === 'ImportSpecifier'
      ) {
        return this.importMethod(
          pluginState.specified[argName],
          file,
          pluginState
        );
      }
      return arg;
    });
  }

  // 处理AST中MemberExpression节点的函数，这就是import插件的能力所在。参数path和state由Babel编译器注入
  MemberExpression(path, state) {
    const { node } = path;
    const file = (path && path.hub && path.hub.file) || (state && state.file);
    const pluginState = this.getPluginState(state);

    // multiple instance check.
    if (!node.object || !node.object.name) return;

    if (pluginState.libraryObjs[node.object.name]) {
      // antd.Button -> _Button
      path.replaceWith(
        this.importMethod(node.property.name, file, pluginState)
      );
    } else if (pluginState.specified[node.object.name]) {
      node.object = this.importMethod(
        pluginState.specified[node.object.name],
        file,
        pluginState
      );
    }
  }

  // 处理AST中Property节点的函数，这就是import插件的能力所在。参数path和state由Babel编译器注入
  Property(path, state) {
    const { node } = path;
    this.buildDeclaratorHandler(node, 'value', path, state);
  }

  // 处理AST中VariableDeclarator节点的函数，这就是import插件的能力所在。参数path和state由Babel编译器注入
  VariableDeclarator(path, state) {
    const { node } = path;
    this.buildDeclaratorHandler(node, 'init', path, state);
  }

  // 处理AST中ArrayExpression节点的函数，这就是import插件的能力所在。参数path和state由Babel编译器注入
  ArrayExpression(path, state) {
    const { node } = path;
    const props = node.elements.map((_, index) => index);
    this.buildExpressionHandler(node.elements, props, path, state);
  }

  LogicalExpression(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['left', 'right'], path, state);
  }

  ConditionalExpression(path, state) {
    const { node } = path;
    this.buildExpressionHandler(
      node,
      ['test', 'consequent', 'alternate'],
      path,
      state
    );
  }

  IfStatement(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['test'], path, state);
    this.buildExpressionHandler(node.test, ['left', 'right'], path, state);
  }

  ExpressionStatement(path, state) {
    const { node } = path;
    const { types } = this;
    if (types.isAssignmentExpression(node.expression)) {
      this.buildExpressionHandler(node.expression, ['right'], path, state);
    }
  }

  ReturnStatement(path, state) {
    const types = this.types;
    const file = (path && path.hub && path.hub.file) || (state && state.file);
    const { node } = path;
    const pluginState = this.getPluginState(state);

    if (
      node.argument &&
      types.isIdentifier(node.argument) &&
      pluginState.specified[node.argument.name] &&
      this.isInGlobalScope(path, node.argument.name, pluginState)
    ) {
      node.argument = this.importMethod(node.argument.name, file, pluginState);
    }
  }

  ExportDefaultDeclaration(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['declaration'], path, state);
  }

  BinaryExpression(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['left', 'right'], path, state);
  }

  /**
   *
   * @param {*} path 表示待导入的模块路径对象
   * @param {*} state 处理当前节点的插件实例状态
   */
  NewExpression(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['callee', 'arguments'], path, state);
  }
}
